import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Handshake, MapPin, MountainSnow, Sparkles, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { galleryImages, meetings, members } from "@/lib/data/mock";

export default function HomePage() {
  const nextMeeting = meetings.find((meeting) => meeting.status === "確定") ?? meetings[0];
  const visibleMembers = members.filter((member) => member.isVisible && member.status === "在籍").slice(0, 4);

  return (
    <>
      <section className="relative overflow-hidden bg-deep text-white">
        <div className="absolute inset-0">
          <Image src="/images/kitanominami-main.webp" alt="札幌すすきのと北のみなみ支部のメインビジュアル" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,55,99,0.94),rgba(0,91,172,0.72)_48%,rgba(35,169,225,0.12))]" />
        </div>
        <div className="relative mx-auto grid min-h-[720px] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.02fr_0.98fr] lg:px-8">
          <div className="max-w-3xl py-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur">
              <MountainSnow size={18} aria-hidden />
              札幌開催・毎月第3金曜日 16:00〜18:00
            </div>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              北海道で、
              <span className="block text-[#BFEFFF]">人とビジネスがつながる場所。</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-100">
              ニーズマッチ 北のみなみ支部は、札幌を拠点に活動する対面式のビジネス交流会です。紹介、商談、学び、そして北海道らしい楽しさが自然に交わる場をつくっています。
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <ButtonLink href="/entry">ゲスト参加する</ButtonLink>
              <ButtonLink href="https://docs.google.com/forms/d/e/1FAIpQLSfqDcLe-KUF0-XvE74QnfXeEl5dmux8DhRtCmz7a4oY_yx0jQ/viewform?fbclid=IwAR3WXWwXkm5T8SAHRFtY5JhhQJJxsSfwEMLPxMj0oJzBMhoa5FlOSo65SX4" external variant="secondary">
                他支部から参加する
              </ButtonLink>
              <ButtonLink href="/members" variant="ghost">会員紹介を見る</ButtonLink>
            </div>
            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              <HeroMetric value="月1回" label="札幌で対面開催" />
              <HeroMetric value="4〜6人" label="テーブル商談" />
              <HeroMetric value="道内外" label="参加者が交流" />
            </div>
          </div>

          <div className="glass-panel rounded border border-white/50 p-5 text-deep">
            <div className="overflow-hidden rounded bg-white">
              <Image src="/images/kitanominami-logo.jpg" alt="北のみなみ支部ロゴ" width={900} height={620} className="aspect-[4/3] w-full object-cover" />
            </div>
            <div className="mt-5 grid gap-4">
              <div>
                <p className="section-kicker">NEXT MEETING</p>
                <h2 className="mt-2 text-2xl font-black">次回定例会</h2>
              </div>
              <div className="grid gap-3 text-sm">
                <Info icon={<CalendarDays size={20} />} label="日程" value={`${nextMeeting.date} ${nextMeeting.startTime}-${nextMeeting.endTime}`} />
                <Info icon={<MapPin size={20} />} label="会場" value={`${nextMeeting.venueName} / ${nextMeeting.venueAddress}`} />
              </div>
              <ButtonLink href="/entry">参加申込へ進む</ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="snow-grid border-b border-slate-200 bg-snow">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <p className="section-kicker">ABOUT</p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-deep">北のみなみ支部の魅力</h2>
          <p className="mt-5 text-lg leading-8 text-slate-700">
            北の大地、北海道で毎月開催される対面式の交流会です。道内外から参加者が集まり、人脈づくり、紹介、商談、北海道らしい楽しみを大切にしています。
          </p>
          <div className="mt-6">
            <ButtonLink href="/about" variant="secondary">支部について詳しく見る</ButtonLink>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["毎月第3金曜", "16:00〜18:00", "予定が立てやすい定期開催"],
            ["札幌開催", "対面式の月例会", "温度感のある商談と交流"],
            ["道内外から", "参加者が集まる", "北海道を軸に広がる人脈"]
          ].map(([title, body, note]) => (
            <div key={title} className="rounded border border-slate-200 bg-white p-6 shadow-soft">
              <Sparkles className="mb-5 text-forest" size={24} />
              <p className="text-lg font-bold text-deep">{title}</p>
              <p className="mt-2 text-sm text-slate-600">{body}</p>
              <p className="mt-5 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">{note}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            <Feature icon={<Handshake size={26} />} title="その場で商談が進む" body="4〜6人のテーブル商談で、PR、質問、紹介、具体的な次の一手までつなげます。" />
            <Feature icon={<UsersRound size={26} />} title="紹介し合える関係性" body="貢献・感謝・承認を大切に、売り込みではなく信頼から始まる交流を目指します。" />
            <Feature icon={<CheckCircle2 size={26} />} title="初参加でも安心" body="参加申込後、役員から流れや持ち物、1on1シートの案内を行います。" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="section-kicker">GALLERY</p>
            <h2 className="mt-3 text-4xl font-black text-deep">写真ギャラリー</h2>
          </div>
          <Link href="/about#gallery" className="text-sm font-bold text-forest">もっと見る</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {galleryImages.map((image) => (
            <div key={image.id} className="overflow-hidden rounded border border-slate-200 bg-white shadow-soft">
              <Image src={image.imageUrl} alt={image.alt} width={640} height={420} className="aspect-[4/3] w-full object-cover" />
              <p className="p-3 text-sm font-semibold">{image.title}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-forest">MEMBERS</p>
              <h2 className="mt-2 text-3xl font-black text-deep">会員紹介</h2>
            </div>
            <ButtonLink href="/join" variant="secondary">入会案内を見る</ButtonLink>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visibleMembers.map((member) => (
              <Link key={member.id} href={`/members/${member.id}`} className="focus-ring rounded border border-slate-200 bg-snow p-5 shadow-soft hover:bg-white">
                <Image src={member.profileImageUrl} alt={member.name} width={96} height={96} className="h-16 w-16 rounded object-cover" />
                <p className="mt-4 font-bold text-deep">{member.name}</p>
                <p className="mt-1 text-sm text-slate-600">{member.industry}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 text-forest">{icon}</span>
      <p>
        <span className="block text-xs font-bold text-slate-500">{label}</span>
        <span className="font-semibold text-deep">{value}</span>
      </p>
    </div>
  );
}

function HeroMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded border border-white/15 bg-white/10 p-4 backdrop-blur">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-200">{label}</p>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <article className="rounded border border-slate-200 bg-snow p-6 shadow-soft">
      <div className="mb-5 grid h-12 w-12 place-items-center rounded bg-forest text-white">{icon}</div>
      <h2 className="text-xl font-black text-deep">{title}</h2>
      <p className="mt-3 leading-7 text-slate-600">{body}</p>
    </article>
  );
}
