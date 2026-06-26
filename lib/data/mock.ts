import type { AssignmentTable, DealResult, GalleryImage, MajorIndustry, Meeting, Member, Participant } from "@/types/domain";

const majorIndustries: MajorIndustry[] = ["サービス業（飲食・美容など）", "保険・建築業", "IT・販売業", "その他"];

const memberProfileImages: Record<string, string> = {
  "鈴木 優": "/images/members/m-suzuki-yu.png",
  "渡辺 穣": "/images/members/m-watanabe-minoru.jpg",
  "浅里 綾夏": "/images/members/m-asari-ayaka.jpg",
  "飛山 佳枝": "/images/members/m-hiyama-yoshie.jpg",
  "伊藤 瞳": "/images/members/m-ito-hitomi.jpg",
  "中川 裕紀": "/images/members/m-nakagawa-yuki.jpg",
  "井野 俊彦": "/images/members/m-ino-toshihiko.jpg",
  "亀嶋 有希": "/images/members/m-kamejima-yuki.png",
  "佐藤 正人": "/images/members/m-sato-masato.jpg",
  "野口 貴之": "/images/members/m-noguchi-takayuki.jpg",
  "向畑 太輔": "/images/members/m-mukohata-taisuke.jpg",
  "菅咲 伎桂": "/images/members/m-sugasaki-kika.jpg",
  "渡辺 匠": "/images/members/m-watanabe-takumi.jpg",
  "髙橋 惺司": "/images/members/m-takahashi-seiji.jpg",
  "山形 佳奈": "/images/members/m-yamagata-kana.jpg",
  "石神 亜矢子": "/images/members/m-ishigami-ayako.png",
  "岡本 英弥": "/images/members/m-okamoto-hideya.png",
  "長尾 冴子": "/images/members/m-nagao-saeko.png",
  "佐藤 美奈子": "/images/members/m-sato-minako.png",
  "村上 季隆": "/images/members/m-murakami-toshitaka.png",
  "木林 朋之": "/images/members/m-kibayashi-tomoyuki.png",
  "吉村 勇紀": "/images/members/m-yoshimura-yuki.png",
  "三浦 昂大": "/images/members/m-miura-akihiro.png",
  "三浦 涼華": "/images/members/m-miura-suzuka.png",
  "吉澤 由季子": "/images/members/m-yoshizawa-yukiko.png",
  "浜田 翠": "/images/members/m-hamada-midori.png",
  "水口 遼人": "/images/members/m-mizuguchi-ryoto.png",
  "中川 麻衣": "/images/members/m-nakagawa-mai.png",
  "髙谷 理佳": "/images/members/m-takatani-rika.png",
  "野々村 亮": "/images/members/m-nonomura-ryo.jpg",
  "橋本 啓太": "/images/members/m-hashimoto-keita.jpg",
  "渡邊 凌": "/images/members/m-watanabe-ryo.jpg",
  "大西 浩之": "/images/members/m-onishi-hiroyuki.jpg",
  "坂本 彩": "/images/members/m-sakamoto-aya.jpg",
  "萩原 新": "/images/members/m-hagiwara-arata.jpg",
  "島田 尚幸": "/images/members/m-shimada-naoyuki.jpg",
  "藤井 善貴": "/images/members/m-fujii-yoshiki.jpg",
  "平澤 裕": "/images/members/m-hirasawa-yu.jpg",
  "前阪 去枝": "/images/members/m-maesaka-sarie.jpg",
  "佐藤 隼也": "/images/members/m-sato-junya.jpg",
  "西森 菜月": "/images/members/m-nishimori-natsuki.jpg",
  "八木 悠磨": "/images/members/m-yagi-yuma.jpg",
  "中本 怜男": "/images/members/m-nakamoto-reo.jpg",
  "佐藤 彰洋": "/images/members/m-sato-akihiro.jpg"
};

const memberRows = [
  ["880", "鈴木 優", "一般社団法人日本営業実践スキル協会", "営業研修", "主催"],
  ["4769", "渡辺 穣", "株式会社ライフプラザパートナーズ", "保険代理店", "幹事"],
  ["4797", "浅里 綾夏", "株式会社グロウ", "美容商材ディーラー事業部卸", "事務局長"],
  ["656", "飛山 佳枝", "アイボットデザイン合同会社", "広告制作、営業塾運営", "支部サポーター"],
  ["4727", "伊藤 瞳", "未来を創る幸福コンサルタント", "コンサルティング業", "準役員"],
  ["6789", "中川 裕紀", "オフィス凛", "事務、営業代行", "準役員"],
  ["6808", "井野 俊彦", "株式会社アセットコネクション", "家計の相談窓口", "準役員"],
  ["7846", "亀嶋 有希", "saqina", "健康美容", "準役員"],
  ["9147", "佐藤 正人", "株式会社ベストハウジングサービス", "建設業", "準役員"],
  ["4794", "野口 貴之", "ラディックス株式会社", "DX推進事業", "役員"],
  ["4881", "向畑 太輔", "thankfulwork", "ファッションスタイリスト", "役員"],
  ["5235", "菅咲 伎桂", "開成結社", "宗教", "役員"],
  ["6313", "渡辺 匠", "渡辺造園", "造園業", "一般会員"],
  ["6716", "髙橋 惺司", "Barあを衣", "飲食業", "幹事"],
  ["7197", "山形 佳奈", "Relaxation＆脱毛 Ｌ-エル-", "エステ、脱毛", "一般会員"],
  ["7834", "石神 亜矢子", "株式会社訪問理美容LINK", "訪問理美容・ヘアスタイリスト・美容商材販売", "一般会員"],
  ["7871", "岡本 英弥", "ヒデ磨き", "靴磨き/革製品メンテナンス/修理修繕/Bar", "一般会員"],
  ["7845", "長尾 冴子", "Live＆Bar Latir", "ジャズシンガー、イベント企画、飲食", "一般会員"],
  ["7869", "佐藤 美奈子", "（株）武蔵—takezo—", "建築業：リフォーム、リノベーション", "一般会員"],
  ["7840", "村上 季隆", "株式会社北海道バイオインダストリー", "食品製造業", "一般会員"],
  ["7855", "木林 朋之", "有限会社ヤマキガラス", "ガラス・サッシ販売取り付け", "一般会員"],
  ["7857", "吉村 勇紀", "クリエイティブラボ株式会社", "Web広告、動画制作、飲食店", "一般会員"],
  ["8678", "三浦 昂大", "株式会社Bord", "建設", "一般会員"],
  ["8676", "三浦 涼華", "ドクターネイル爪革命 札幌本店", "フットケア", "一般会員"],
  ["8776", "吉澤 由季子", "季巡り-kimeguri-", "ヘルスケア、コーチング", "一般会員"],
  ["8791", "浜田 翠", "CASALBER JURAKU", "BAR", "一般会員"],
  ["8873", "水口 遼人", "合同会社Lifter", "清掃", "一般会員"],
  ["8876", "中川 麻衣", "株式会社ライズエム", "サロン業", "一般会員"],
  ["8877", "髙谷 理佳", "ドクターネイル爪革命札幌本店", "フットケア", "一般会員"],
  ["9187", "野々村 亮", "株式会社内装いちばん", "建築・リフォーム業", "一般会員"],
  ["9136", "橋本 啓太", "はしもと行政書士事務所", "行政書士", "一般会員"],
  ["9602", "平澤 裕", "Liralive", "パーソナルジム", "一般会員"],
  ["9563", "大西 浩之", "株式会社 新和ホーム", "建設業", "一般会員"],
  ["9566", "前阪 去枝", "カラーメンタリング", "カウンセリング", "一般会員"],
  ["9589", "佐藤 隼也", "株式会社ガレージライン", "中古車販売買取整備レンタカー", "一般会員"],
  ["9739", "西森 菜月", "チャチャチャワールド", "家族に応援される起業コーチ", "一般会員"],
  ["9626", "八木 悠磨", "一般社団法人カジュアルコーチング", "夢を叶える教育プログラムの運営", "一般会員"],
  ["9147", "中本 怜男", "レイズ株式会社", "情報通信業・ソフトウェア開発", "一般会員"],
  ["9719", "佐藤 彰洋", "有限会社パウアンドカンパニー", "IT系", "一般会員"],
  ["9714", "坂本 彩", "坂本 彩", "SNS集客サポート・WEBデザイン", "一般会員"],
  ["9715", "萩原 新", "合同会社Riberte/あらた", "ITコンサルタント/Youtuber", "一般会員"],
  ["9710", "島田 尚幸", "株式会社フィールド", "外構工事・遺品整理・特殊清掃", "一般会員"],
  ["9740", "藤井 善貴", "株式会社エステート221", "不動産業全般", "一般会員"],
  ["6419", "渡邊 凌", "株式会社ジョンソン", "携帯電話・不動産・自動車", "一般会員"]
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
    profileImageUrl: memberProfileImages[name] ?? `/images/member-${(index % 6) + 1}.svg`,
    bio: `${company}。${industry}を通じて、北のみなみ支部でのつながりと紹介を大切にしています。`,
    position,
    isTableLeader: position !== "一般会員",
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
    id: "meeting-2026-06",
    title: "2026年6月 北のみなみ月例会",
    date: "2026-06-19",
    startTime: "16:00",
    endTime: "18:00",
    venueName: "札幌ビジネス交流ラウンジ",
    venueAddress: "北海道札幌市中央区北1条西1丁目",
    note: "過去開催分",
    applicationDeadline: "2026-06-16",
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

export const galleryImages: GalleryImage[] = [
  {
    id: "g1",
    title: "6月19日定例会集合写真",
    description: "この日は34名の方が参加しました！",
    imageUrl: "/images/gallery/gallery-01.jpg",
    alt: "6月19日定例会集合写真"
  },
  {
    id: "g2",
    title: "3月定例会テーブル商談の様子",
    description: "テーブル内で商談を行っている様子です",
    imageUrl: "/images/gallery/gallery-02.jpg",
    alt: "3月定例会テーブル商談の様子"
  },
  {
    id: "g3",
    title: "４月４周年定例会テーブル商談の様子①",
    description: "この日は全国からニーズマッチ会員が集まり、商談が行われました",
    imageUrl: "/images/gallery/gallery-03.jpg",
    alt: "４月４周年定例会テーブル商談の様子①"
  },
  {
    id: "g4",
    title: "４月４周年定例会テーブル商談の様子②",
    description: "この日は全国からニーズマッチ会員が集まり、商談が行われました",
    imageUrl: "/images/gallery/gallery-04.jpg",
    alt: "４月４周年定例会テーブル商談の様子②"
  },
  {
    id: "g5",
    title: "4月４周年定例会集合写真",
    description: "北のみなみ支部４周年！全国からたくさんのニーズマッチ会員にお集まりいただきました",
    imageUrl: "/images/gallery/gallery-05.jpg",
    alt: "4月４周年定例会集合写真"
  },
  {
    id: "g6",
    title: "４周年ゴルフコンペ",
    description: "道外から来ていただいてる方に、北海道をさらに楽しんでもらうためゴルフコンペも開催されています",
    imageUrl: "/images/gallery/gallery-06.jpg",
    alt: "４周年ゴルフコンペ"
  },
  {
    id: "g7",
    title: "3月定例会集合写真",
    description: "新規ゲスト様や他支部からの参加もいただきました",
    imageUrl: "/images/gallery/gallery-07.jpg",
    alt: "3月定例会集合写真"
  },
  {
    id: "g8",
    title: "カーネギー「人を動かす」のシェア",
    description: "「人を動かす」の著書からエピソードを紹介し、テーブルごとにディスカッションを行います",
    imageUrl: "/images/gallery/gallery-08.jpg",
    alt: "カーネギー「人を動かす」のシェア"
  },
  {
    id: "g9",
    title: "アイスブレイクタイム",
    description: "参加者全員の簡単な自己紹介が行われます",
    imageUrl: "/images/gallery/gallery-09.jpg",
    alt: "アイスブレイクタイム"
  },
  {
    id: "g10",
    title: "定例会の様子",
    description: "テーブル商談だけでなく、10分間ショートセミナーでお役立ち情報を得られる時間も！",
    imageUrl: "/images/gallery/gallery-10.jpg",
    alt: "定例会の様子"
  }
];

export const messengerThreads = [
  { id: "thread-1", name: "連絡用スレッド", url: "https://www.facebook.com/messages/t/8306300582745011" }
];

export const dealResults: DealResult[] = [
  {
    id: "deal-1",
    fromMemberName: "井野 俊彦",
    toMemberName: "吉村 勇紀",
    month: "2026-05",
    industry: "イベント",
    description: "出会いイベント「いのっちングアプリ」の共同開催。吉村さんが経営するダイニングバーSTRIDEでお客様を集め７：７のマッチングイベントがこれまで３回行われました。",
    sales: 210000,
    imageUrl: "/images/deals/deal-inocching-app.jpg"
  },
  {
    id: "deal-2",
    fromMemberName: "鈴木 優",
    toMemberName: "吉村 勇紀",
    month: "2026-06",
    industry: "IT",
    description: "鈴木優さんのお客様からシステム制作の依頼を吉村勇紀さんに紹介され、商談が成立し大型案件の契約となりました",
    sales: 2000000,
    imageUrl: "/images/deals/deal-system-production.jpg"
  },
  {
    id: "deal-3",
    fromMemberName: "井野 俊彦",
    toMemberName: "吉村 勇紀",
    month: "2026-02",
    industry: "イベント",
    description: "ゲームイベント「いのっちングゲーム」の共同開催。総勢24名の参加者を集めゲームイベントが開催されました。",
    sales: 120000,
    imageUrl: "/images/deals/deal-inocching-game.jpg"
  }
];

export const pastAssignments: AssignmentTable[] = [
  { tableName: "Aテーブル", seats: members.slice(0, 5).map((member, i) => ({ member, isLeader: i === 0 })) },
  { tableName: "Bテーブル", seats: members.slice(5, 10).map((member, i) => ({ member, isLeader: i === 0 })) },
  { tableName: "Cテーブル", seats: members.slice(10, 15).map((member, i) => ({ member, isLeader: i === 0 })) },
  { tableName: "Dテーブル", seats: members.slice(15, 20).map((member, i) => ({ member, isLeader: i === 0 })) }
];

function seatByName(name: string, guestCompany?: string) {
  const member = members.find((item) => item.name === name);
  return {
    member,
    guestName: member ? undefined : name,
    guestCompany,
    isLeader: Boolean(member?.isTableLeader)
  };
}

export const june2026Assignments: AssignmentTable[] = [
  { tableName: "Aテーブル", seats: ["鈴木 優", "向畑 太輔", "三浦 涼華", "木林 朋之", "中本 怜男"].map((name) => seatByName(name)) },
  { tableName: "Bテーブル", seats: ["渡辺 穣", "菅咲 伎桂", "浜田 翠", "橋本 啓太", "萩原 新"].map((name) => seatByName(name)) },
  { tableName: "Cテーブル", seats: ["浅里 綾夏", "髙橋 惺司", "中川 麻衣", "野々村 亮", "岡本 英弥"].map((name) => seatByName(name)) },
  { tableName: "Dテーブル", seats: [seatByName("伊藤 瞳"), seatByName("石神 亜矢子"), seatByName("髙谷 理佳"), seatByName("立山 大就", "他支部からの参加"), seatByName("坂本 彩")] },
  { tableName: "Eテーブル", seats: ["中川 裕紀", "野口 貴之", "平澤 裕", "島田 尚幸", "三浦 昂大"].map((name) => seatByName(name)) },
  { tableName: "Fテーブル", seats: ["井野 俊彦", "吉村 勇紀", "前阪 去枝", "大西 浩之", "八木 悠磨"].map((name) => seatByName(name)) },
  { tableName: "Gテーブル", seats: [seatByName("亀嶋 有希"), seatByName("佐藤 真由美", "ゲスト参加"), seatByName("渡辺 匠"), seatByName("藤井 善貴")] }
];

export const pastAssignmentsByMeetingId: Record<string, AssignmentTable[]> = {
  "meeting-2026-04": pastAssignments,
  "meeting-2026-05": pastAssignments,
  "meeting-2026-06": june2026Assignments
};

export const recentPastAssignments: AssignmentTable[] = [
  ...june2026Assignments,
  { tableName: "前回Aテーブル", seats: [members[1], members[6], members[11], members[16], members[21]].filter(Boolean).map((member, i) => ({ member, isLeader: i === 0 })) },
  { tableName: "前回Bテーブル", seats: [members[2], members[7], members[12], members[17], members[22]].filter(Boolean).map((member, i) => ({ member, isLeader: i === 0 })) },
  { tableName: "前回Cテーブル", seats: [members[3], members[8], members[13], members[18], members[23]].filter(Boolean).map((member, i) => ({ member, isLeader: i === 0 })) },
  { tableName: "前回Dテーブル", seats: [members[4], members[9], members[14], members[19], members[24]].filter(Boolean).map((member, i) => ({ member, isLeader: i === 0 })) }
];
