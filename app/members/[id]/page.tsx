import { MemberDetailClient } from "@/components/members/member-detail-client";
import { members } from "@/lib/data/mock";

export default async function MemberDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  return <MemberDetailClient memberId={params.id} initialMembers={members} />;
}
