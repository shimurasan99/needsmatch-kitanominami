"use client";

import { Download, Eye, Plus, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { participantStorageKey, readStoredParticipants, writeStoredParticipants, type StoredGuestEntry } from "@/lib/data/participant-storage";
import type { Member, Participant, ParticipantStatus } from "@/types/domain";

type MemberAttendanceStatus = Extract<ParticipantStatus, "参加" | "欠席" | "未定">;
type GuestType = "新規" | "他支部";

type GuestEntry = StoredGuestEntry;

const statusOptions: MemberAttendanceStatus[] = ["参加", "欠席", "未定"];

const statusSelectClasses: Record<MemberAttendanceStatus, string> = {
  参加: "border-forest/30 bg-blue-50 text-forest",
  欠席: "border-accent/30 bg-red-50 text-accent",
  未定: "border-slate-200 bg-white text-slate-600"
};

const statusBadgeClasses: Record<MemberAttendanceStatus, string> = {
  参加: "bg-blue-50 text-forest ring-1 ring-forest/20",
  欠席: "bg-red-50 text-accent ring-1 ring-accent/20",
  未定: "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
};

function createInitialStatuses(members: Member[], initialParticipants: Participant[]) {
  const next = Object.fromEntries(members.map((member) => [member.id, "未定"])) as Record<string, MemberAttendanceStatus>;

  initialParticipants.forEach((participant) => {
    if (participant.memberId && statusOptions.includes(participant.status as MemberAttendanceStatus)) {
      next[participant.memberId] = participant.status as MemberAttendanceStatus;
    }
  });

  return next;
}

function csvValue(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function ParticipantManager({
  meetingId,
  initialMembers,
  initialParticipants
}: {
  meetingId: string;
  initialMembers: Member[];
  initialParticipants: Participant[];
}) {
  const storageKey = participantStorageKey(meetingId);
  const [statuses, setStatuses] = useState<Record<string, MemberAttendanceStatus>>(() => createInitialStatuses(initialMembers, initialParticipants));
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [isGuestFormOpen, setIsGuestFormOpen] = useState(false);
  const [isParticipantListOpen, setIsParticipantListOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestCompany, setGuestCompany] = useState("");
  const [guestIndustry, setGuestIndustry] = useState("");
  const [guestType, setGuestType] = useState<GuestType>("新規");
  const [guestBranchName, setGuestBranchName] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const saved = readStoredParticipants(meetingId);
    if (saved) {
      if (saved.statuses) setStatuses({ ...createInitialStatuses(initialMembers, initialParticipants), ...saved.statuses } as Record<string, MemberAttendanceStatus>);
      if (Array.isArray(saved.guests)) setGuests(saved.guests);
    }
    setIsReady(true);
  }, [initialMembers, initialParticipants, meetingId, storageKey]);

  useEffect(() => {
    if (!isReady) return;
    writeStoredParticipants(meetingId, { statuses, guests });
  }, [guests, isReady, meetingId, statuses]);

  const counts = useMemo(() => {
    return initialMembers.reduce(
      (acc, member) => {
        acc[statuses[member.id] ?? "未定"] += 1;
        return acc;
      },
      { 参加: 0, 欠席: 0, 未定: 0 } as Record<MemberAttendanceStatus, number>
    );
  }, [initialMembers, statuses]);

  const attendingMembers = useMemo(() => initialMembers.filter((member) => statuses[member.id] === "参加"), [initialMembers, statuses]);
  const totalAttendees = attendingMembers.length + guests.length;

  function updateStatus(memberId: string, status: MemberAttendanceStatus) {
    setStatuses((current) => ({ ...current, [memberId]: status }));
  }

  function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guestName.trim()) return;

    setGuests((current) => [
      ...current,
      {
        id: `guest-${Date.now()}`,
        name: guestName.trim(),
        company: guestCompany.trim(),
        industry: guestIndustry.trim(),
        type: guestType,
        branchName: guestType === "他支部" ? guestBranchName.trim() : ""
      }
    ]);
    setGuestName("");
    setGuestCompany("");
    setGuestIndustry("");
    setGuestType("新規");
    setGuestBranchName("");
    setIsGuestFormOpen(false);
  }

  function exportCsv() {
    const memberRows = initialMembers.map((member) => [
      member.memberNo,
      member.name,
      member.company ?? "",
      member.industry,
      statuses[member.id] ?? "未定",
      "",
      ""
    ]);
    const guestRows = guests.map((guest) => ["ゲスト", guest.name, guest.company, guest.industry, "参加", guest.type, guest.branchName]);
    const rows = [["会員番号", "名前", "会社名", "業種", "出欠", "種別", "支部名"], ...memberRows, ...guestRows];
    const csv = rows.map((row) => row.map(csvValue).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${meetingId}-participants.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded border border-slate-200 bg-white p-4 shadow-soft sm:grid-cols-4">
        <Stat label="参加" value={`${counts.参加 + guests.length}名`} className="text-forest" />
        <Stat label="欠席" value={`${counts.欠席}名`} className="text-accent" />
        <Stat label="未定" value={`${counts.未定}名`} className="text-slate-600" />
        <Stat label="ゲスト" value={`${guests.length}名`} className="text-deep" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsGuestFormOpen((current) => !current)}
          className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-deep hover:bg-snow"
        >
          <UserPlus size={16} />
          ゲスト手動追加
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-deep hover:bg-snow"
        >
          <Download size={16} />
          CSV出力
        </button>
      </div>

      {isGuestFormOpen && (
        <form onSubmit={addGuest} className="rounded border border-slate-200 bg-white p-4 shadow-soft">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">名前</span>
              <input value={guestName} onChange={(event) => setGuestName(event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" required />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">会社名</span>
              <input value={guestCompany} onChange={(event) => setGuestCompany(event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">業種</span>
              <input value={guestIndustry} onChange={(event) => setGuestIndustry(event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">新規 / 他支部</span>
              <select value={guestType} onChange={(event) => setGuestType(event.target.value as GuestType)} className="focus-ring rounded border border-slate-200 px-3 py-3">
                <option>新規</option>
                <option>他支部</option>
              </select>
            </label>
            {guestType === "他支部" && (
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-bold text-slate-600">支部名</span>
                <input value={guestBranchName} onChange={(event) => setGuestBranchName(event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
              </label>
            )}
          </div>
          <button type="submit" className="focus-ring mt-4 inline-flex items-center gap-2 rounded bg-forest px-5 py-3 text-sm font-bold text-white hover:bg-deep">
            <Plus size={16} />
            ゲストを追加
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-100 bg-snow px-4 py-3">
          <h2 className="font-black text-deep">会員名簿</h2>
          <p className="mt-1 text-sm text-slate-600">会員名簿全員分の出欠を選択できます。</p>
        </div>
        {initialMembers.map((member) => {
          const status = statuses[member.id] ?? "未定";
          return (
            <div key={member.id} className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:grid-cols-[1fr_150px] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-deep">{member.name}</p>
                  <span className={`rounded px-2 py-1 text-xs font-bold ${statusBadgeClasses[status]}`}>{status}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{member.company}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{member.industry}</p>
              </div>
              <select
                value={status}
                onChange={(event) => updateStatus(member.id, event.target.value as MemberAttendanceStatus)}
                className={`focus-ring rounded border px-3 py-2 text-sm font-bold ${statusSelectClasses[status]}`}
              >
                {statusOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setIsParticipantListOpen((current) => !current)}
          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded bg-forest px-5 py-3 text-sm font-bold text-white shadow-soft hover:bg-deep sm:w-auto"
        >
          <Eye size={17} />
          参加者一覧を見る
        </button>
      </div>

      {isParticipantListOpen && (
        <div className="rounded border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-black text-deep">参加者一覧</h2>
              <p className="mt-1 text-sm text-slate-600">参加会員 {attendingMembers.length}名 / ゲスト {guests.length}名 / 合計 {totalAttendees}名</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {attendingMembers.map((member) => (
              <ParticipantCard key={member.id} name={member.name} company={member.company} industry={member.industry} label="会員" />
            ))}
            {guests.map((guest) => (
              <ParticipantCard
                key={guest.id}
                name={guest.name}
                company={guest.company || "会社名未入力"}
                industry={guest.industry || "業種未入力"}
                label={guest.type === "他支部" && guest.branchName ? `他支部: ${guest.branchName}` : guest.type}
                onRemove={() => setGuests((current) => current.filter((item) => item.id !== guest.id))}
              />
            ))}
            {totalAttendees === 0 && <p className="text-sm font-bold text-slate-500">参加者はまだ選択されていません。</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded border border-slate-100 bg-snow p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${className}`}>{value}</p>
    </div>
  );
}

function ParticipantCard({
  name,
  company,
  industry,
  label,
  onRemove
}: {
  name: string;
  company: string;
  industry: string;
  label: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded border border-slate-200 bg-snow p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-deep">{name}</p>
          <span className="rounded bg-white px-2 py-1 text-xs font-bold text-forest ring-1 ring-forest/20">{label}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{company}</p>
        <p className="mt-1 text-xs font-bold text-slate-500">{industry}</p>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} className="focus-ring rounded border border-slate-200 bg-white p-2 text-accent hover:bg-red-50" aria-label={`${name}を削除`}>
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
