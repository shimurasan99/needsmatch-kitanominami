import Image from "next/image";
import { galleryImages } from "@/lib/data/mock";

export default function AboutPage() {
  return (
    <div className="bg-snow">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm font-bold text-forest">ABOUT NEEDS MATCH</p>
        <h1 className="mt-3 text-4xl font-black text-deep">ニーズマッチと北のみなみ支部</h1>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <Article title="ニーズマッチとは">
            <p>
              ニーズマッチは「その日その場で、あなたのビジネスが拡大する」という考え方を大切にする会員制ビジネス交流会です。理念は「貢献」「感謝」「承認」。デール・カーネギー著『人を動かす』を行動指針に、紹介、商談、学びの機会を提供します。
            </p>
            <p>
              会員はいずれかの支部に所属し、支部は月に一度の月例会を開催します。カーネギーのエピソード共有、テーブル商談、リアル支部でのコンタクトタイムを通じて、参加者同士の接点を増やします。
            </p>
            <p>
              ゲスト参加は全支部合計で直近1年間に2回まで。ゲスト参加費は3,000円、入会金は11,000円、月会費は8,580円です。
            </p>
          </Article>
          <Article title="北のみなみ支部ってどんなところ？">
            <p>
              北のみなみ支部は、北海道・札幌で毎月第3金曜日 16:00〜18:00に開催される対面式のビジネス交流会です。道内各地だけでなく道外からも参加者が集まります。
            </p>
            <p>
              人脈づくりやビジネスチャンスの創出はもちろん、北海道の食や自然、イベントも楽しめる支部です。北海道でビジネスを発展させたい方、北海道経済に貢献したい方、北海道が好きな方に向いています。
            </p>
          </Article>
        </div>
      </section>

      <section id="gallery" className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-forest">GALLERY</p>
          <h2 className="mt-3 text-3xl font-black text-deep">写真ギャラリー</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {galleryImages.map((image) => (
              <a key={image.id} href={image.imageUrl} target="_blank" rel="noreferrer" className="focus-ring overflow-hidden rounded border border-slate-200 bg-snow">
                <Image src={image.imageUrl} alt={image.alt} width={800} height={560} className="aspect-[4/3] w-full object-cover" />
                <p className="p-3 text-sm font-semibold">{image.title}</p>
              </a>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">画像の追加・削除は運営専用ページのギャラリー管理から行います。</p>
        </div>
      </section>
    </div>
  );
}

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded border border-slate-200 bg-white p-6 shadow-soft">
      <h2 className="text-2xl font-black text-deep">{title}</h2>
      <div className="mt-5 grid gap-4 leading-8 text-slate-700">{children}</div>
    </article>
  );
}
