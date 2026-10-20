"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Member } from "@/types/domain";
import type { JoiningRecord } from "@/lib/admin/routine-record";
import { compareMemberNumber } from "@/lib/admin/routine-record";
import type { Operations } from "@/lib/admin/operations";
import { safeHttpUrl } from "@/lib/admin/operations";
import { fetchManagedMembers } from "@/lib/data/member-overrides";
import { adminButton as button, adminInput as input, adminJson, usePrivateRecord } from "./private-record";
import { csvCell } from "@/lib/data/csv-export";

export function MemberResources({ initialMembers }: { initialMembers: Member[] }) {
  const r = usePrivateRecord<JoiningRecord>("joining");
  const [members, setMembers] = useState<Member[]>([]), [operations, setOperations] = useState<Operations | null>(null), [error, setError] = useState("");
  const [search, setSearch] = useState(""), [includeFormer, setIncludeFormer] = useState(false), [fileMember, setFileMember] = useState("");
  const [sortMode, setSortMode] = useState("number");
  useEffect(() => {
    let active = true;
    Promise.all([fetchManagedMembers(initialMembers), adminJson("/api/admin/operations")]).then(([m, o]) => { if (active) { setMembers(m); setOperations(o.data); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [initialMembers]);
  const joined = (id: string) => r.data?.members.find(m => m.memberId === id);
  const visible = members.filter(m => (includeFormer || m.status !== "退会") && `${m.name} ${m.memberNo} ${m.company}`.includes(search)).sort((a, b) => sortMode === "number"
    ? compareMemberNumber(a, b)
    : (joined(a.id)?.joinedMonth || "9999").localeCompare(joined(b.id)?.joinedMonth || "9999") || (a.kana || a.name).localeCompare(b.kana || b.name, "ja"));
  function edit(memberId: string, patch: Partial<JoiningRecord["members"][number]>) {
    if (!r.data) return;
    r.change({ members: [...r.data.members.filter(m => m.memberId !== memberId), { memberId, joinedMonth: "", source: "", ...joined(memberId), ...patch }] });
  }
  function csv() {
    const rows = [["入会月", "NM-ID", "氏名", "会社名", "在籍状況", "根拠・確認メモ"], ...visible.map(m => [joined(m.id)?.joinedMonth || "未確認", m.memberNo, m.name, m.company, m.status, joined(m.id)?.source || ""])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = sortMode === "number" ? "会員番号順-入会順の参考.csv" : "会員入会月順.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="space-y-5">
    <p>初期表示は会員番号の小さい順（入会順の参考）です。番号から入会日を確定するものではありません。同じ番号の方も別人として表示します。確認済みの入会月順にも切り替えられます。</p>
    <p className="text-sm">2026年4月・5月の入会月は運営議事録から確認できた方のみ参考入力しています。その他の方は記録を確認して入力してください。編集後は「入会情報を保存」を押してください。</p>
    <Link className="font-bold text-forest underline" href="/admin/operations">10分セミナー・受講状況の管理へ</Link>
    <label className="block max-w-md">表示順<select className={input} value={sortMode} onChange={e => setSortMode(e.target.value)}><option value="number">会員番号順（入会順の参考）</option><option value="joined">確認済みの入会月順（未確認は末尾）</option></select></label>
    <div className="flex flex-wrap gap-3"><button className={button} disabled={!r.data || r.busy} onClick={r.save}>入会情報を保存</button><button className={button} disabled={r.busy} onClick={r.reload}>再読み込み</button><button className={button} disabled={!r.data} onClick={csv}>表示中の並び順をCSV保存</button>{r.dirty && <span>未保存の変更あり</span>}</div>
    {(error || r.error) && <p role="alert" className="text-red-700">{error || r.error}</p>}{r.message && <p role="status">{r.message}</p>}
    <label className="block">氏名・番号・会社で検索<input className={input} value={search} onChange={e => setSearch(e.target.value)} /></label>
    <label className="flex gap-2"><input type="checkbox" checked={includeFormer} onChange={e => setIncludeFormer(e.target.checked)} />退会した会員も表示する</label>
    {!r.data && !r.error && <p>読み込み中…</p>}
    <fieldset disabled={r.busy || !r.data} className="space-y-3">
      {visible.map(m => <article key={m.id} className="grid gap-3 rounded border bg-white p-4 sm:grid-cols-2">
        <div><h2 className="font-bold">{m.name}　<span className="text-sm font-normal">NM-ID {m.memberNo}</span></h2><p className="text-sm">{m.company} ／ {m.status}</p><p className="font-bold text-forest">{joined(m.id)?.joinedMonth || "入会月未確認"}</p></div>
        <label>入会月<input type="month" className={input} value={joined(m.id)?.joinedMonth || ""} onChange={e => edit(m.id, { joinedMonth: e.target.value })} /></label>
        <label>根拠・確認メモ<input className={input} maxLength={1000} value={joined(m.id)?.source || ""} onChange={e => edit(m.id, { source: e.target.value })} /></label>
        <div className="flex items-center"><button className={button} onClick={() => setFileMember(m.id)}>1on1シートを保管・確認</button></div>
      </article>)}
    </fieldset>
    {fileMember && <OneOnOneFiles key={fileMember} member={members.find(m => m.id === fileMember)!} oldUrl={safeHttpUrl(operations?.memberNotes.find(n => n.memberId === fileMember)?.oneOnOneUrl || "")} close={() => setFileMember("")} />}
  </div>;
}

function OneOnOneFiles({ member, oldUrl, close }: { member: Member; oldUrl: string; close: () => void }) {
  const [files, setFiles] = useState<{ name: string; createdAt: string; size: number }[]>([]), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const endpoint = `/api/admin/one-on-one/${encodeURIComponent(member.id)}`;
  useEffect(() => { let active = true; adminJson(endpoint).then(r => { if (active) { setFiles(r.files); setLoaded(true); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [endpoint]);
  return <section role="dialog" aria-modal="true" aria-label={`${member.name}の1on1シート`} className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4">
    <div className="mx-auto my-8 max-w-2xl space-y-4 rounded bg-white p-6">
      <h2 className="text-xl font-bold">{member.name}さんの1on1シート</h2>
      <p className="text-sm">運営専用の非公開保管です。PDF・JPEG・PNG・WebP（3MB以下）。新しい版を追加しても過去版は残ります。ダウンロードは運営ログインが必要です。</p>
      {oldUrl && <p><a className="underline" href={oldUrl} target="_blank" rel="noreferrer">従来の1on1シートURL</a><span className="block text-xs">外部リンク先の閲覧権限は元の所有者の設定に従います。HPへ保管するにはファイルを取得して下から追加してください。</span></p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status">{message}</p>}
      <form onSubmit={async e => {
        e.preventDefault(); if (busy) return; const form = e.currentTarget; setBusy(true); setError(""); setMessage("");
        try {
          await adminJson(endpoint, { method: "POST", body: new FormData(form) });
          form.reset(); setMessage("ファイルを非公開で保存しました。");
          const r = await adminJson(endpoint); setFiles(r.files); setLoaded(true);
        } catch (e) { setError(e instanceof Error ? e.message : "アップロード失敗"); } finally { setBusy(false); }
      }} className="space-y-3">
        <input aria-label="保管する1on1シート" className="block w-full" type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required disabled={busy} />
        <button className={button} disabled={busy}>{busy ? "保存中…" : "新しい版をアップロード"}</button>
      </form>
      <p className="text-xs">新しい順に最大100件を表示します。ファイル名は保存日時に置き換わります。</p>
      {files.map(f => <a key={f.name} className="block rounded border p-3 underline" href={`${endpoint}?file=${encodeURIComponent(f.name)}`} target="_blank" rel="noreferrer">{new Date(f.createdAt).toLocaleString("ja-JP")} ／ {f.name.split(".").pop()?.toUpperCase()} ／ {Math.ceil(f.size / 1024)}KB をダウンロード</a>)}
      {loaded && !files.length && <p>HPにはまだファイルが保管されていません。</p>}
      <button className={button} disabled={busy} onClick={close}>閉じる</button>
    </div>
  </section>;
}
