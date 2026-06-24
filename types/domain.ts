export type RoleName = "管理者" | "主催" | "幹事" | "準役員" | "一般会員";
export type MajorIndustry = "サービス業（飲食・美容など）" | "保険・建築業" | "IT・販売業" | "その他";
export type MemberStatus = "在籍" | "休会" | "退会";
export type MeetingStatus = "下書き" | "確定" | "終了";
export type ParticipantStatus = "参加" | "欠席" | "未定" | "ゲスト";

export type Member = {
  id: string;
  memberNo: string;
  name: string;
  kana: string;
  company: string;
  email: string;
  phone: string;
  facebookUrl: string;
  instagramUrl: string;
  websiteUrl: string;
  industry: string;
  majorIndustry: MajorIndustry;
  profileImageUrl: string;
  bio: string;
  position: RoleName;
  isTableLeader: boolean;
  status: MemberStatus;
  isVisible: boolean;
};

export type Meeting = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
  note: string;
  applicationDeadline: string;
  status: MeetingStatus;
};

export type Participant = {
  id: string;
  meetingId: string;
  memberId?: string;
  guestName?: string;
  guestCompany?: string;
  status: ParticipantStatus;
};

export type GalleryImage = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  alt: string;
};

export type AssignmentSeat = {
  member?: Member;
  guestName?: string;
  guestCompany?: string;
  isLeader: boolean;
};

export type AssignmentTable = {
  tableName: string;
  seats: AssignmentSeat[];
};
