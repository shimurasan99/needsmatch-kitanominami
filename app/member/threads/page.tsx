import { ThreadDirectory } from "@/components/member/thread-directory";
import { messengerThreads } from "@/lib/data/mock";

export default function MemberThreadsPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-black text-deep">メッセンジャースレッド</h1>
      <ThreadDirectory initialThreads={messengerThreads} />
    </section>
  );
}
