import { AlertTriangle, Crown } from "lucide-react";
import type { AssignmentTable } from "@/types/domain";

export function TableAssignmentView({ tables, score, warnings }: { tables: AssignmentTable[]; score: number; warnings: string[] }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-bold text-slate-500">最適化スコア</p>
          <p className="text-2xl font-black text-deep">{score}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring rounded bg-forest px-4 py-2 text-sm font-bold text-white">保存</button>
          <button className="focus-ring rounded border border-slate-200 px-4 py-2 text-sm font-bold">公開切替</button>
          <button className="focus-ring rounded border border-slate-200 px-4 py-2 text-sm font-bold">PDF出力</button>
          <button className="focus-ring rounded border border-slate-200 px-4 py-2 text-sm font-bold">CSV出力</button>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle size={18} />条件違反の警告</div>
          <ul className="grid gap-1">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {tables.map((table) => (
          <article key={table.tableName} className="rounded border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-deep">{table.tableName}</h2>
              <button className="focus-ring rounded border border-slate-200 px-3 py-1 text-xs font-bold">テーブル名編集</button>
            </div>
            <div className="grid gap-2">
              {table.seats.map((seat, index) => (
                <div key={`${table.tableName}-${seat.member?.id ?? seat.guestName}-${index}`} className="flex items-center justify-between rounded bg-snow p-3">
                  <div>
                    <p className="font-bold text-deep">{seat.member?.name ?? seat.guestName}</p>
                    <p className="text-xs text-slate-600">{seat.member?.industry ?? seat.guestCompany ?? "ゲスト"}</p>
                  </div>
                  {seat.isLeader && <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-1 text-xs font-bold text-forest"><Crown size={14} />リーダー</span>}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
