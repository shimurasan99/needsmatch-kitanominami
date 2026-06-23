import { ButtonLink } from "@/components/ui/button-link";
import { messengerThreads } from "@/lib/data/mock";

export default function MemberThreadsPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-black text-deep">メッセンジャースレッド</h1>
      <div className="mt-6 grid gap-3">
        {messengerThreads.map((thread) => (
          <div key={thread.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white p-4">
            <p className="font-bold text-deep">{thread.name}</p>
            <ButtonLink href={thread.url} external variant="secondary">開く</ButtonLink>
          </div>
        ))}
      </div>
    </section>
  );
}
