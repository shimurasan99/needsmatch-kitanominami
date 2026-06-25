"use client";

import Image from "next/image";
import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { readMemberAdditions, readMemberOverrides, writeMemberAdditions, applyMemberOverrides } from "@/lib/data/member-overrides";
import type { MajorIndustry, Member, RoleName } from "@/types/domain";

const roles: RoleName[] = ["主催", "幹事", "準役員", "一般会員"];
const majorIndustries: MajorIndustry[] = ["サービス業（飲食・美容など）", "保険・建築業", "IT・販売業", "その他"];

export function MemberManagement({ initialMembers }: { initialMembers: Member[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [members, setMembers] = useState<Member[]>(() => applyMemberOverrides(initialMembers, readMemberOverrides()));
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [newMember, setNewMember] = useState({
    memberNo: "",
    name: "",
    company: "",
    industry: "",
    majorIndustry: "その他" as MajorIndustry,
    position: "一般会員" as RoleName,
    isTableLeader: false
  });

  const sortedMembers = useMemo(() => [...members].sort((a, b) => Number(a.memberNo) - Number(b.memberNo)), [members]);

  function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newMember.memberNo || !newMember.name) return;
    const addition: Member = {
      id: `custom-${Date.now()}`,
      memberNo: newMember.memberNo,
      name: newMember.name,
      kana: "",
      company: newMember.company,
      email: "",
      phone: "",
      facebookUrl: "",
      instagramUrl: "",
      websiteUrl: "",
      industry: newMember.industry,
      majorIndustry: newMember.majorIndustry,
      profileImageUrl: "/images/member-1.svg",
      bio: `${newMember.company}。${newMember.industry}を通じて、北のみなみ支部でのつながりと紹介を大切にしています。`,
      position: newMember.position,
      isTableLeader: newMember.isTableLeader,
      status: "在籍",
      isVisible: true
    };
    const additions = [...readMemberAdditions(), addition];
    writeMemberAdditions(additions);
    setMembers((current) => [...current, addition]);
    setMessage("新規会員を登録しました。");
    setIsNewOpen(false);
  }

  function exportCsv() {
    const rows = [["会員番号", "氏名", "会社名", "業種", "大業種", "役職", "テーブルリーダー", "Facebook URL", "Instagram URL", "ホームページ URL"]];
    sortedMembers.forEach((member) => {
      rows.push([
        member.memberNo,
        member.name,
        member.company,
        member.industry,
        member.majorIndustry,
        member.position,
        member.isTableLeader ? "TRUE" : "FALSE",
        member.facebookUrl,
        member.instagramUrl,
        member.websiteUrl
      ]);
    });
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kitanominami-members.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    const [header, ...body] = rows;
    const imported = body
      .filter((row) => row.some(Boolean))
      .map((row, index) => {
        const get = (label: string) => row[header.indexOf(label)] ?? "";
        const position = roles.includes(get("役職") as RoleName) ? (get("役職") as RoleName) : "一般会員";
        const majorIndustry = majorIndustries.includes(get("大業種") as MajorIndustry) ? (get("大業種") as MajorIndustry) : "その他";
        return {
          id: `import-${Date.now()}-${index}`,
          memberNo: get("会員番号"),
          name: get("氏名"),
          kana: "",
          company: get("会社名"),
          email: "",
          phone: "",
          facebookUrl: get("Facebook URL"),
          instagramUrl: get("Instagram URL"),
          websiteUrl: get("ホームページ URL"),
          industry: get("業種"),
          majorIndustry,
          profileImageUrl: "/images/member-1.svg",
          bio: `${get("会社名")}。${get("業種")}を通じて、北のみなみ支部でのつながりと紹介を大切にしています。`,
          position,
          isTableLeader: get("テーブルリーダー").toUpperCase() === "TRUE",
          status: "在籍" as const,
          isVisible: true
        };
      });
    writeMemberAdditions(imported);
    setMembers([...initialMembers, ...imported]);
    setMessage(`${imported.length}名をCSVからインポートしました。`);
    event.target.value = "";
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setIsNewOpen((current) => !current)} className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-4 py-2 text-sm font-bold text-white">
          <Plus size={16} />
          新規登録
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold">
          <Upload size={16} />
          CSVインポート
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={importCsv} className="sr-only" />
        <button type="button" onClick={exportCsv} className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold">
          <Download size={16} />
          CSVエクスポート
        </button>
      </div>
      {message && <p className="mb-4 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-forest">{message}</p>}
      {isNewOpen && (
        <form onSubmit={addMember} className="mb-5 grid gap-4 rounded border border-slate-200 bg-white p-4 shadow-soft md:grid-cols-2">
          <Input label="会員番号" value={newMember.memberNo} onChange={(value) => setNewMember((current) => ({ ...current, memberNo: value }))} />
          <Input label="氏名" value={newMember.name} onChange={(value) => setNewMember((current) => ({ ...current, name: value }))} />
          <Input label="会社名" value={newMember.company} onChange={(value) => setNewMember((current) => ({ ...current, company: value }))} />
          <Input label="業種" value={newMember.industry} onChange={(value) => setNewMember((current) => ({ ...current, industry: value }))} />
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">大業種</span>
            <select value={newMember.majorIndustry} onChange={(event) => setNewMember((current) => ({ ...current, majorIndustry: event.target.value as MajorIndustry }))} className="focus-ring rounded border border-slate-200 px-3 py-3">
              {majorIndustries.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">役職</span>
            <select value={newMember.position} onChange={(event) => setNewMember((current) => ({ ...current, position: event.target.value as RoleName }))} className="focus-ring rounded border border-slate-200 px-3 py-3">
              {roles.map((role) => <option key={role}>{role}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded border border-slate-200 bg-snow p-4 md:col-span-2">
            <input type="checkbox" checked={newMember.isTableLeader} onChange={(event) => setNewMember((current) => ({ ...current, isTableLeader: event.target.checked }))} className="h-5 w-5" />
            <span className="font-bold text-deep">テーブルリーダー権限あり</span>
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="focus-ring rounded bg-forest px-5 py-3 text-sm font-bold text-white">登録する</button>
          </div>
        </form>
      )}
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-snow text-slate-600">
            <tr>
              <th className="p-3">会員</th>
              <th className="p-3">業種</th>
              <th className="p-3">大業種</th>
              <th className="p-3">役職</th>
              <th className="p-3">状態</th>
              <th className="p-3">表示</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((member) => (
              <tr key={member.id} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <Image src={member.profileImageUrl} alt="" width={40} height={40} className="h-10 w-10 rounded object-cover" />
                    <div><p className="font-bold">{member.name}</p><p className="text-xs text-slate-500">会員No.{member.memberNo}</p></div>
                  </div>
                </td>
                <td className="p-3">{member.industry}</td>
                <td className="p-3">{member.majorIndustry}</td>
                <td className="p-3">{member.position}</td>
                <td className="p-3">{member.status}</td>
                <td className="p-3">{member.isVisible ? "表示" : "非表示"}</td>
                <td className="p-3">
                  <Link href={`/admin/members/${member.id}`} className="focus-ring rounded border border-slate-200 px-3 py-1 font-bold">
                    編集
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
    </label>
  );
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      i++;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.length > 1 || item[0]);
}
