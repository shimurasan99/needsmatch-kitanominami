import type { AssignmentSeat, AssignmentTable, Member, Participant } from "@/types/domain";

type Result = {
  tables: AssignmentTable[];
  score: number;
  warnings: string[];
};

const tableLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
const officerPositions = new Set(["主催", "幹事", "準役員"]);

export function generateTableAssignment(participants: Participant[], members: Member[], pastTables: AssignmentTable[] = [], attempts = 600, seatsPerTable = 5): Result {
  const targetSize = Math.min(Math.max(seatsPerTable, 4), 8);
  const seats = participants
    .filter((p) => p.status === "参加" || p.status === "ゲスト")
    .map<AssignmentSeat>((p) => {
      const member = p.memberId ? members.find((m) => m.id === p.memberId) : undefined;
      return { member, guestName: p.guestName, guestCompany: p.guestCompany, isLeader: Boolean(member?.isTableLeader) };
    });

  const tableCount = Math.max(1, Math.ceil(seats.length / targetSize));
  let best: Result | null = null;
  const leaders = seats.filter((seat) => seat.member?.isTableLeader);
  const others = seats.filter((seat) => !seat.member?.isTableLeader);
  const pastPairs = buildPastPairs(pastTables);

  for (let i = 0; i < attempts; i++) {
    const tables = Array.from({ length: tableCount }).map((_, index) => ({ tableName: `${tableLabels[index]}テーブル`, seats: [] as AssignmentSeat[] }));
    shuffle([...leaders], i).forEach((seat, index) => tables[index % tableCount].seats.push(seat));
    shuffle([...others], i * 31 + 7).forEach((seat) => {
      const candidates = tables.filter((table) => table.seats.length < targetSize);
      const targetTables = candidates.length > 0 ? candidates : tables;
      const preferred = [...targetTables].sort((a, b) => scoreSeatForTable(seat, a, targetSize, pastPairs) - scoreSeatForTable(seat, b, targetSize, pastPairs))[0];
      preferred.seats.push(seat);
    });
    const scored = scoreTables(tables, pastTables, targetSize);
    if (!best || scored.score < best.score) best = { ...scored, tables: sortTables(scored.tables) };
  }

  return best ?? { tables: [], score: 0, warnings: [] };
}

function sortTables(tables: AssignmentTable[]) {
  return [...tables].sort((a, b) => tableOrder(a.tableName) - tableOrder(b.tableName));
}

function tableOrder(tableName: string) {
  const label = tableName.match(/[A-H]/)?.[0];
  const index = label ? tableLabels.indexOf(label) : -1;
  return index >= 0 ? index : 999;
}

function scoreTables(tables: AssignmentTable[], pastTables: AssignmentTable[], targetSize: number): Result {
  let score = 0;
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
        if (pastPairs.get(key) === "recent") score += 140;
        if (pastPairs.get(key) === "older") score += 35;
      }
    }
  }

  return { tables, score, warnings };
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
      if (pair === "recent") score += 140;
      if (pair === "older") score += 35;
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
  return [a, b].sort().join(":");
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
