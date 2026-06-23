import type { AssignmentTable, MajorIndustry, Meeting, Member, Participant } from "@/types/domain";

const majorIndustries: MajorIndustry[] = ["サービス業（飲食・美容など）", "保険・建築業", "IT・販売業", "その他"];

const memberRows = [
  ["880", "鈴木 優", "一般社団法人日本営業実践スキル協会", "営業研修・営業支援", "主催"],
  ["4769", "渡辺 穣", "株式会社ライフプラザパートナーズ", "保険代理店・資産運用", "幹事"],
  ["4797", "浅里 綾夏", "株式会社グロウ", "美容商材ディーラー", "幹事"],
  ["4727", "伊藤 瞳", "未来を創る幸福コンサルタント", "コンサルティング", "準役員"],
  ["6789", "中川 裕紀", "オフィス凛", "事務代行・営業代行", "準役員"],
  ["6808", "井野 俊彦", "株式会社アセットコネクション", "家計相談・資産運用", "準役員"],
  ["7846", "亀嶋 有希", "saqina", "健康美容", "準役員"],
  ["4794", "野口 貴之", "ラディックス株式会社", "DX推進・OA機器", "一般会員"],
  ["4881", "向畑 太輔", "thankfulwork", "ファッションスタイリスト", "一般会員"],
  ["5235", "菅咲 伎桂", "開成結社", "僧侶・葬儀・供養", "一般会員"],
  ["6313", "渡辺 匠", "渡辺造園", "造園業", "一般会員"],
  ["6716", "髙橋 惺司", "Bar あを衣", "飲食業", "一般会員"],
  ["7834", "石神 亜矢子", "株式会社訪問理美容LINK", "訪問理美容・美容商材販売", "一般会員"],
  ["7871", "岡本 英弥", "ヒデ磨き", "靴磨き・革製品メンテナンス", "一般会員"],
  ["7855", "木林 朋之", "有限会社ヤマキガラス", "ガラス・サッシ販売施工", "一般会員"],
  ["7857", "吉村 勇紀", "クリエイティブラボ株式会社", "Web広告・動画制作・SNS運用", "一般会員"],
  ["8678", "三浦 昂大", "株式会社Bord", "建設・美装・リフォーム", "一般会員"],
  ["8676", "三浦 涼華", "ドクターネイル爪革命 札幌本店", "フットケア", "一般会員"],
  ["8791", "浜田 翠", "CASALBER JURABKAUR", "婚活・交流イベント", "一般会員"],
  ["8876", "中川 麻衣", "株式会社ライズエム", "ネイルサロン・婚活カウンセラー", "一般会員"],
  ["8877", "髙谷 理佳", "ドクターネイル爪革命 札幌本店", "フットケア・無料相談", "一般会員"],
  ["9187", "野々村 亮", "株式会社内装いちばん", "建築・リフォーム業", "一般会員"],
  ["9136", "橋本 啓太", "はしもと行政書士事務所", "行政書士", "一般会員"],
  ["9602", "平澤 裕", "Liralive", "パーソナルジム", "一般会員"],
  ["9563", "大西 浩之", "株式会社 新和ホーム", "建設業・新築リフォーム", "一般会員"],
  ["9566", "前阪 去枝", "カラーメンタリング", "カウンセリング", "一般会員"],
  ["9626", "八木 悠磨", "一般社団法人カジュアルコーチング", "教育プログラム・コーチング", "一般会員"],
  ["9147", "中本 怜男", "レイズ株式会社", "情報通信業・ソフトウェア開発", "一般会員"],
  ["9714", "坂本 彩", "坂本 彩", "SNS集客サポート・Webデザイン", "一般会員"],
  ["9715", "萩原 新", "合同会社Riberte", "ITコンサルタント・YouTube", "一般会員"],
  ["9710", "島田 尚幸", "株式会社フィールド", "外構工事・遺品整理・特殊清掃", "一般会員"],
  ["9740", "藤井 善貴", "株式会社エステート221", "不動産業全般", "一般会員"]
] as const;

export const members: Member[] = memberRows.map(([memberNo, name, company, industry, position], index) => {
  const n = index + 1;
  return {
    id: `m-${n}`,
    memberNo,
    name,
    kana: "",
    company,
    email: `member${n}@example.com`,
    phone: `011-000-${String(1000 + n)}`,
    facebookUrl: "https://www.facebook.com/",
    instagramUrl: "https://www.instagram.com/",
    websiteUrl: "https://example.com/",
    industry,
    majorIndustry: inferMajorIndustry(industry, index),
    profileImageUrl: `/images/member-${(index % 6) + 1}.svg`,
    bio: `${company}。${industry}を通じて、北のみなみ支部でのつながりと紹介を大切にしています。`,
    position,
    isTableLeader: index < 7,
    status: "在籍",
    isVisible: true
  };
});

function inferMajorIndustry(industry: string, index: number): MajorIndustry {
  if (/美容|ネイル|フット|飲食|婚活|靴磨き|カウンセリング|ジム|健康/.test(industry)) return "サービス業（飲食・美容など）";
  if (/保険|建築|リフォーム|建設|造園|ガラス|不動産|外構/.test(industry)) return "保険・建築業";
  if (/Web|SNS|IT|ソフトウェア|DX|動画|広告/.test(industry)) return "IT・販売業";
  return majorIndustries[index % majorIndustries.length];
}

export const meetings: Meeting[] = [
  {
    id: "meeting-2026-04",
    title: "2026年4月 北のみなみ月例会",
    date: "2026-04-17",
    startTime: "16:00",
    endTime: "18:00",
    venueName: "札幌ビジネス交流ラウンジ",
    venueAddress: "北海道札幌市中央区北1条西1丁目",
    note: "過去開催分",
    applicationDeadline: "2026-04-14",
    status: "終了"
  },
  {
    id: "meeting-2026-05",
    title: "2026年5月 北のみなみ月例会",
    date: "2026-05-15",
    startTime: "16:00",
    endTime: "18:00",
    venueName: "札幌ビジネス交流ラウンジ",
    venueAddress: "北海道札幌市中央区北1条西1丁目",
    note: "過去開催分",
    applicationDeadline: "2026-05-12",
    status: "終了"
  },
  {
    id: "meeting-2026-07",
    title: "2026年7月 北のみなみ月例会",
    date: "2026-07-17",
    startTime: "16:00",
    endTime: "18:00",
    venueName: "札幌ビジネス交流ラウンジ",
    venueAddress: "北海道札幌市中央区北1条西1丁目",
    note: "毎月第3金曜日開催。受付は15:45からです。",
    applicationDeadline: "2026-07-14",
    status: "確定"
  }
];

export const participants: Participant[] = [
  ...members.slice(0, 18).map((member) => ({ id: `p-${member.id}`, meetingId: "meeting-2026-07", memberId: member.id, status: "参加" as const })),
  { id: "guest-1", meetingId: "meeting-2026-07", guestName: "ゲスト 太郎", guestCompany: "ゲスト商事", status: "ゲスト" },
  { id: "guest-2", meetingId: "meeting-2026-07", guestName: "ゲスト 花子", guestCompany: "サンプル企画", status: "ゲスト" }
];

export const galleryImages = [
  { id: "g1", title: "北のみなみ支部 メインビジュアル", imageUrl: "/images/kitanominami-main.webp", alt: "札幌すすきのと北のみなみ支部のメインビジュアル" },
  { id: "g2", title: "北のみなみ支部 ロゴ", imageUrl: "/images/kitanominami-logo.jpg", alt: "北のみなみ支部ロゴ" },
  { id: "g3", title: "北海道の食を楽しむ懇親", imageUrl: "/images/gallery-3.svg", alt: "北海道の食を楽しむ懇親" },
  { id: "g4", title: "ビジネス紹介タイム", imageUrl: "/images/gallery-4.svg", alt: "ビジネス紹介タイム" }
];

export const messengerThreads = [
  { id: "thread-1", name: "連絡用スレッド", url: "https://www.facebook.com/messages/t/8306300582745011" }
];

export const pastAssignments: AssignmentTable[] = [
  { tableName: "Aテーブル", seats: members.slice(0, 5).map((member, i) => ({ member, isLeader: i === 0 })) },
  { tableName: "Bテーブル", seats: members.slice(5, 10).map((member, i) => ({ member, isLeader: i === 0 })) },
  { tableName: "Cテーブル", seats: members.slice(10, 15).map((member, i) => ({ member, isLeader: i === 0 })) },
  { tableName: "Dテーブル", seats: members.slice(15, 20).map((member, i) => ({ member, isLeader: i === 0 })) }
];
