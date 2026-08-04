"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { fetchMeetings } from "@/lib/data/meeting-storage";
import type { Meeting } from "@/types/domain";

export function NextMeetingCard({ initialMeetings }: { initialMeetings: Meeting[] }) {
  const [managedMeetings, setManagedMeetings] = useState(initialMeetings);

  useEffect(() => {
    let active = true;
    void fetchMeetings(initialMeetings).then((loadedMeetings) => {
      if (active) setManagedMeetings(loadedMeetings);
    });
    return () => {
      active = false;
    };
  }, [initialMeetings]);

  const nextMeeting = useMemo(() => {
    const today = getTodayInJapan();
    const confirmedMeetings = managedMeetings
      .filter((meeting) => meeting.status === "確定")
      .sort((a, b) => a.date.localeCompare(b.date));
    return confirmedMeetings.find((meeting) => meeting.date >= today)
      ?? confirmedMeetings.at(-1)
      ?? managedMeetings[0];
  }, [managedMeetings]);

  if (!nextMeeting) return null;

  const meetingVenue = [nextMeeting.venueName, nextMeeting.venueAddress]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="glass-panel rounded border border-white/50 p-5 text-deep">
      <div className="overflow-hidden rounded bg-white">
        <Image src="/images/kitanominami-logo.jpg" alt="北のみなみ支部ロゴ" width={900} height={620} className="aspect-[4/3] w-full object-cover" />
      </div>
      <div className="mt-5 grid gap-4">
        <div>
          <p className="section-kicker">NEXT MEETING</p>
          <h2 className="mt-2 text-2xl font-black">次回定例会</h2>
        </div>
        <div className="grid gap-3 text-sm">
          <Info icon={<CalendarDays size={20} />} label="日程" value={`${nextMeeting.date} ${nextMeeting.startTime}-${nextMeeting.endTime}`} />
          <Info icon={<MapPin size={20} />} label="会場" value={meetingVenue || "会場調整中"} />
        </div>
        <ButtonLink href="/entry">参加申込へ進む</ButtonLink>
      </div>
    </div>
  );
}

function getTodayInJapan() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 text-forest">{icon}</span>
      <p>
        <span className="block text-xs font-bold text-slate-500">{label}</span>
        <span className="font-semibold text-deep">{value}</span>
      </p>
    </div>
  );
}
