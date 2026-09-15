import type { AssignmentTable, Member } from "@/types/domain";

// A seating record needs names and matching attributes, not profile photos or contacts.
export function compactTableAssignment(tables: AssignmentTable[]): AssignmentTable[] {
  return tables.map((table) => ({
    tableName: table.tableName,
    seats: table.seats.map((seat) => ({
      member: seat.member ? compactMember(seat.member) : undefined,
      guestName: seat.guestName,
      guestCompany: seat.guestCompany,
      isLeader: seat.isLeader
    }))
  }));
}

function compactMember(member: Member): Member {
  return {
    id: member.id, name: member.name, memberNo: member.memberNo ?? "", company: member.company ?? "",
    industry: member.industry ?? "", majorIndustry: member.majorIndustry, position: member.position,
    isTableLeader: member.isTableLeader, status: member.status, isVisible: member.isVisible,
    kana: "", email: "", phone: "", facebookUrl: "", instagramUrl: "", websiteUrl: "", profileImageUrl: "", bio: ""
  };
}
