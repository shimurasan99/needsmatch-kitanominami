import type { AssignmentSeat, AssignmentTable, Member, Participant } from "@/types/domain";

type Result = {
  tables: AssignmentTable[];
  score: number;
  warnings: string[];
  repeatedPairs?: number;
};

const officerPositions = new Set(["主催", "事務局長", "幹事", "役員", "支部サポーター", "準役員"]);

export function generateTableAssignment(participants: Participant[], members: Member[], pastTables: AssignmentTable[] = [], attempts = 600, seatsPerTable = 5): Result {
  const targetSize = Number.isFinite(seatsPerTable) ? Math.min(Math.max(Math.floor(seatsPerTable), 4), 8) : 5;
  const seen = new Set<string>();
  const seats = participants
    .filter((p) => p.status === "参加" || p.status === "ゲスト")
    .filter((p) => {
      const key = p.memberId ? `member:${p.memberId}` : `guest:${p.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map<AssignmentSeat>((p) => {
      const member = p.memberId ? members.find((m) => m.id === p.memberId) : undefined;
      return { member, guestName: p.guestName, guestCompany: p.guestCompany, isLeader: Boolean(member?.isTableLeader) };
    });

  if (!seats.length) return { tables: [], score: 0, warnings: [], repeatedPairs: 0 };
  const tableCount = Math.ceil(seats.length / targetSize);
  const capacities = Array.from({ length: tableCount }, (_, i) => Math.floor(seats.length / tableCount) + (i < seats.length % tableCount ? 1 : 0));
  let best: Result | null = null;
  const leaders = seats.filter((seat) => seat.member?.isTableLeader);
  const others = seats.filter((seat) => !seat.member?.isTableLeader);
  const pastPairs = buildPastPairs(pastTables);

  const rounds = Number.isFinite(attempts) ? Math.max(1, Math.min(1200, Math.floor(attempts))) : 600;
  for (let i = 0; i < rounds; i++) {
    const tables = Array.from({ length: tableCount }).map((_, index) => ({ tableName: `${tableLabel(index)}テーブル`, seats: [] as AssignmentSeat[] }));
    shuffle([...leaders], i).forEach((seat, index) => tables[index % tableCount].seats.push(seat));
    shuffle([...others], i * 31 + 7).forEach((seat) => {
      const candidates = tables.filter((table, index) => table.seats.length < capacities[index]);
      const targetTables = candidates.length > 0 ? candidates : tables;
      const preferred = [...targetTables].sort((a, b) => scoreSeatForTable(seat, a, targetSize, pastPairs) - scoreSeatForTable(seat, b, targetSize, pastPairs))[0];
      preferred.seats.push(seat);
    });
    const scored = scoreTables(tables, pastTables, targetSize);
    if (!best || (scored.repeatedPairs ?? 0) < (best.repeatedPairs ?? 0) || (scored.repeatedPairs === best.repeatedPairs && scored.score < best.score)) best = { ...scored, tables: sortTables(scored.tables) };
  }

  // Repair greedy placements with pairwise exchanges before resorting to a full search.
  if (best?.repeatedPairs) {
    for (let pass = 0; pass < 12; pass++) {
      let improvement = 0;
      let swap: [number, number, number, number] | undefined;
      const repeatCount = (table: AssignmentTable) => table.seats.reduce((sum, seat, i) => sum + table.seats.slice(i + 1).filter((other) => seat.member && other.member && pastPairs.has(pairKey(seat.member.id, other.member.id))).length, 0);
      for (let a = 0; a < best.tables.length; a++) for (let b = a + 1; b < best.tables.length; b++) {
        const left = best.tables[a];
        const right = best.tables[b];
        const before = repeatCount(left) + repeatCount(right);
        if (!before) continue;
        for (let i = 0; i < left.seats.length; i++) for (let j = 0; j < right.seats.length; j++) {
          [left.seats[i], right.seats[j]] = [right.seats[j], left.seats[i]];
          const delta = repeatCount(left) + repeatCount(right) - before;
          [left.seats[i], right.seats[j]] = [right.seats[j], left.seats[i]];
          if (delta < improvement) { improvement = delta; swap = [a, b, i, j]; }
        }
      }
      if (!swap) break;
      const [a, b, i, j] = swap;
      [best.tables[a].seats[i], best.tables[b].seats[j]] = [best.tables[b].seats[j], best.tables[a].seats[i]];
    }
    best = scoreTables(best.tables, pastTables, targetSize);
  }

  if (best?.repeatedPairs) {
    const searched = searchWithoutRepeats(seats, capacities, pastPairs);
    if (searched.tables) best = scoreTables(searched.tables, pastTables, targetSize);
    else best.warnings.push(searched.exhausted
      ? "探索上限までに重複ゼロの配置が見つかりませんでした。人数設定の変更や手動調整をお試しください。"
      : "現在の参加者と均等な人数設定では、過去2回との同席重複をゼロにできません。1卓の人数を減らすと回避できる場合があります。");
  }

  return best ?? { tables: [], score: 0, warnings: [] };
}

function sortTables(tables: AssignmentTable[]) {
  return [...tables].sort((a, b) => tableOrder(a.tableName) - tableOrder(b.tableName));
}

function tableOrder(tableName: string) {
  const label = tableName.match(/^[A-Z]+/)?.[0];
  return label ? labelToIndex(label) : 999;
}

function tableLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function labelToIndex(label: string) {
  return label.split("").reduce((acc, character) => acc * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

function scoreTables(tables: AssignmentTable[], pastTables: AssignmentTable[], targetSize: number): Result {
  let score = 0;
  let repeatedPairs = 0;
  const warnings: string[] = [];
  const pastPairs = buildPastPairs(pastTables);

  for (const table of tables) {
    if (Math.abs(table.seats.length - targetSize) >= 2 || table.seats.length <= 3) {
      score += 100;
      warnings.push(`${table.tableName}: 人数が${table.seats.length}人です（設定: ${targetSize}人）`);
    }
    if (!table.seats.some((seat) => seat.member?.isTableLeader)) {
      score += 300;
      warnings.push(`${table.tableName}: テーブルリーダーがいません`);
    }
    const industryCounts = new Map<string, number>();
    const officerCount = table.seats.filter((seat) => seat.member && officerPositions.has(seat.member.position)).length;
    const guestCount = table.seats.filter((seat) => seat.guestName).length;
    const hasGuide = table.seats.some((seat) => seat.member?.isTableLeader || (seat.member && officerPositions.has(seat.member.position)));

    for (const seat of table.seats) {
      if (seat.member) industryCounts.set(seat.member.majorIndustry, (industryCounts.get(seat.member.majorIndustry) ?? 0) + 1);
    }
    for (const count of industryCounts.values()) {
      if (count > 1) score += (count - 1) * 45;
    }
    if (officerCount >= 3) score += 25;
    if (guestCount > 0 && !hasGuide) {
      score += 50;
      warnings.push(`${table.tableName}: ゲスト同席テーブルに役員またはリーダーがいません`);
    }
    const ids = table.seats.map((seat) => seat.member?.id).filter(Boolean) as string[];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = pairKey(ids[i], ids[j]);
        if (pastPairs.has(key)) {
          score += 10000;
          repeatedPairs++;
          warnings.push(`${table.tableName}: ${table.seats.find((seat) => seat.member?.id === ids[i])?.member?.name}さんと${table.seats.find((seat) => seat.member?.id === ids[j])?.member?.name}さんは前回・前々回にも同席しています`);
        }
      }
    }
  }

  return { tables, score, warnings, repeatedPairs };
}

function scoreSeatForTable(seat: AssignmentSeat, table: AssignmentTable, targetSize: number, pastPairs: Map<string, "recent" | "older">) {
  let score = table.seats.length * 8;
  if (table.seats.length >= targetSize) score += 120;

  if (seat.member) {
    const sameIndustryCount = table.seats.filter((item) => item.member?.majorIndustry === seat.member?.majorIndustry).length;
    score += sameIndustryCount * 45;

    for (const currentSeat of table.seats) {
      if (!currentSeat.member) continue;
      const pair = pastPairs.get(pairKey(seat.member.id, currentSeat.member.id));
      if (pair) score += 10000;
    }
  }

  return score;
}

function buildPastPairs(pastTables: AssignmentTable[]) {
  const pairs = new Map<string, "recent" | "older">();
  pastTables.forEach((table) => {
    const ids = table.seats.map((seat) => seat.member?.id).filter(Boolean) as string[];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pairs.set(pairKey(ids[i], ids[j]), "recent");
      }
    }
  });
  return pairs;
}

function pairKey(a: string, b: string) {
  return JSON.stringify([a, b].sort());
}

/** Search both preceding meetings equally; secondary preferences never permit a repeated pair. */
function searchWithoutRepeats(seats: AssignmentSeat[], capacities: number[], pastPairs: Map<string, "recent" | "older">) {
  const conflicts = seats.map((a) => seats.map((b) => Boolean(a.member && b.member && pastPairs.has(pairKey(a.member.id, b.member.id)))));
  const groups: number[][] = capacities.map(() => []);
  let nodes = 0;
  let exhausted = false;
  function search(remaining: number[]): boolean {
    if (!remaining.length) return true;
    if (++nodes > Math.min(100000, Math.floor(2500000 / seats.length))) { exhausted = true; return false; }
    let selected = -1;
    let options: number[] = [];
    let degree = -1;
    for (const candidate of remaining) {
      const legal = groups.flatMap((group, t) => group.length < capacities[t] && group.every((other) => !conflicts[candidate][other]) ? [t] : []);
      if (!legal.length) return false;
      const d = conflicts[candidate].filter(Boolean).length;
      if (selected < 0 || legal.length < options.length || (legal.length === options.length && d > degree)) { selected = candidate; options = legal; degree = d; }
    }
    const emptyCapacities = new Set<number>();
    options.sort((a, b) => {
      const table = (t: number) => ({ tableName: "", seats: groups[t].map((i) => seats[i]) });
      const leaderPenalty = (t: number) => seats[selected].isLeader && groups[t].some((i) => seats[i].isLeader) ? 300 : 0;
      return scoreSeatForTable(seats[selected], table(a), capacities[a], pastPairs) + leaderPenalty(a) - scoreSeatForTable(seats[selected], table(b), capacities[b], pastPairs) - leaderPenalty(b);
    });
    for (const t of options) {
      if (!groups[t].length) {
        if (emptyCapacities.has(capacities[t])) continue;
        emptyCapacities.add(capacities[t]);
      }
      groups[t].push(selected);
      if (search(remaining.filter((i) => i !== selected))) return true;
      groups[t].pop();
      if (exhausted) return false;
    }
    return false;
  }
  const solved = search(seats.map((_, i) => i));
  return { tables: solved ? groups.map((group, i) => ({ tableName: `${tableLabel(i)}テーブル`, seats: group.map((seat) => seats[seat]) })) : undefined, exhausted };
}

function shuffle<T>(items: T[], seed: number) {
  let state = seed + 1;
  for (let i = items.length - 1; i > 0; i--) {
    state = (state * 9301 + 49297) % 233280;
    const j = Math.floor((state / 233280) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
