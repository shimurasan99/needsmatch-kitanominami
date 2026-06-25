"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { readMemberOverrides, writeMemberOverride } from "@/lib/data/member-overrides";
import type { MajorIndustry, Member, RoleName } from "@/types/domain";

const roles: RoleName[] = ["主催", "幹事", "準役員", "一般会員"];
const majorIndustries: MajorIndustry[] = ["サービス業（飲食・美容など）", "保険・建築業", "IT・販売業", "その他"];

export function MemberEditForm({ member }: { member: Member }) {
  const merged = useMemo(() => ({ ...member, ...(readMemberOverrides()[member.id] ?? {}) }), [member]);
  const [profileImageUrl, setProfileImageUrl] = useState(merged.profileImageUrl);
  const [position, setPosition] = useState<RoleName>(merged.position);
  const [isTableLeader, setIsTableLeader] = useState(merged.isTableLeader);
  const [industry, setIndustry] = useState(merged.industry);
  const [majorIndustry, setMajorIndustry] = useState<MajorIndustry>(merged.majorIndustry);
  const [facebookUrl, setFacebookUrl] = useState(merged.facebookUrl);
  const [instagramUrl, setInstagramUrl] = useState(merged.instagramUrl);
  const [websiteUrl, setWebsiteUrl] = useState(merged.websiteUrl);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const overrides = readMemberOverrides();
    const next = { ...member, ...(overrides[member.id] ?? {}) };
    setProfileImageUrl(next.profileImageUrl);
    setPosition(next.position);
    setIsTableLeader(next.isTableLeader);
    setIndustry(next.industry);
    setMajorIndustry(next.majorIndustry);
    setFacebookUrl(next.facebookUrl);
    setInstagramUrl(next.instagramUrl);
    setWebsiteUrl(next.websiteUrl);
  }, [member]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    writeMemberOverride(member.id, { profileImageUrl, position, isTableLeader, industry, majorIndustry, facebookUrl, instagramUrl, websiteUrl });
    setSaved(true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded border border-slate-200 bg-white p-5 shadow-soft">
        <Image src={profileImageUrl || "/images/member-1.svg"} alt={member.name} width={260} height={260} className="aspect-square w-full rounded object-cover" />
        <p className="mt-4 text-xs font-bold text-forest">会員No.{member.memberNo}</p>
        <h2 className="mt-1 text-2xl font-black text-deep">{member.name}</h2>
        <p className="mt-1 text-sm text-slate-600">{member.email}</p>
      </aside>

      <form onSubmit={save} className="rounded border border-slate-200 bg-white p-5 shadow-soft">
        {saved && <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-forest">保存しました。会員紹介ページへ反映されます。</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">写真URL</span>
            <input value={profileImageUrl} onChange={(e) => setProfileImageUrl(e.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">役職</span>
            <select value={position} onChange={(e) => setPosition(e.target.value as RoleName)} className="focus-ring rounded border border-slate-200 px-3 py-3">
              {roles.map((role) => <option key={role}>{role}</option>)}
            </select>
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-bold text-slate-600">業種</span>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-bold text-slate-600">大業種</span>
            <select value={majorIndustry} onChange={(e) => setMajorIndustry(e.target.value as MajorIndustry)} className="focus-ring rounded border border-slate-200 px-3 py-3">
              {majorIndustries.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">Facebook URL</span>
            <input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">Instagram URL</span>
            <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-bold text-slate-600">ホームページ URL</span>
            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
          </label>
          <label className="flex items-center gap-3 rounded border border-slate-200 bg-snow p-4 md:col-span-2">
            <input type="checkbox" checked={isTableLeader} onChange={(e) => setIsTableLeader(e.target.checked)} className="h-5 w-5" />
            <span className="font-bold text-deep">テーブルリーダー権限あり</span>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-5 py-3 text-sm font-bold text-white">
            <Save size={18} />
            保存する
          </button>
          <a href="/admin/members" className="focus-ring rounded border border-slate-200 px-5 py-3 text-sm font-bold">一覧へ戻る</a>
        </div>
      </form>
    </div>
  );
}
