"use client";

import { CalendarCog, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { countMeetingAttendees, subscribeStoredParticipants } from "@/lib/data/participant-storage";
import type { Meeting, Member, Participant } from "@/types/domain";

type StoredMeetingSettings = {
  date: string;
  startTime: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
};

function storageKey(meetingId: string) {
  return `nm_meeting_settings_${meetingId}`;
}

export function MeetingSettingsPanel({
  meeting,
  members,
  participants
}: {
  meeting: Meeting;
  members: Member[];
  participants: Participant[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(() => participants.filter((participant) => participant.status === "参加" || participant.status === "ゲスト").length);
  const [settings, setSettings] = useState<StoredMeetingSettings>({
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    venueName: meeting.venueName,
    venueAddress: meeting.venueAddress
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(meeting.id));
      if (raw) setSettings({ ...settings, ...(JSON.parse(raw) as Partial<StoredMeetingSettings>) });
    } catch {
      setSettings({
        date: meeting.date,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        venueName: meeting.venueName,
        venueAddress: meeting.venueAddress
      });
    }

    const refreshCount = () => setAttendeeCount(countMeetingAttendees(meeting.id, members, participants));
    refreshCount();
    return subscribeStoredParticipants(meeting.id, refreshCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.id, members, participants]);

  function update(field: keyof StoredMeetingSettings, value: string) {
    setSaved(false);
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(storageKey(meeting.id), JSON.stringify(settings));
    setSaved(true);
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-deep hover:bg-snow"
      >
        <CalendarCog size={16} />
        月例会設定
      </button>

      {isOpen && (
        <form onSubmit={save} className="mt-4 grid gap-4 rounded border border-slate-200 bg-snow p-4 md:grid-cols-2">
          {saved && <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-forest md:col-span-2">保存しました。</p>}
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">日時</span>
            <input type="date" value={settings.date} onChange={(event) => update("date", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">開始</span>
              <input type="time" value={settings.startTime} onChange={(event) => update("startTime", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">終了</span>
              <input type="time" value={settings.endTime} onChange={(event) => update("endTime", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
            </label>
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">会場</span>
            <input value={settings.venueName} onChange={(event) => update("venueName", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">会場住所</span>
            <input value={settings.venueAddress} onChange={(event) => update("venueAddress", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
          </label>
          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="text-sm font-bold text-slate-600">参加人数</p>
            <p className="mt-1 text-3xl font-black text-forest">{attendeeCount}名</p>
            <p className="mt-1 text-xs font-bold text-slate-500">参加者管理から自動反映</p>
          </div>
          <div className="flex items-end md:justify-end">
            <button type="submit" className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-5 py-3 text-sm font-bold text-white">
              <Save size={16} />
              保存
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
