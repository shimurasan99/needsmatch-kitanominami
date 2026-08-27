import { MemberDetailClient } from "@/components/members/member-detail-client";
import { members } from "@/lib/data/mock";

export default function MemberDetailPage({ params }: { params: { id: string } }) {
  return <MemberDetailClient memberId={params.id} initialMembers={members} />;
}
