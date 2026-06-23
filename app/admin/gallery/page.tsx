import Image from "next/image";
import { AdminShell } from "@/components/admin/admin-shell";
import { galleryImages } from "@/lib/data/mock";

export default function AdminGalleryPage() {
  return (
    <AdminShell title="写真ギャラリー管理">
      <button className="focus-ring mb-4 rounded bg-forest px-4 py-2 text-sm font-bold text-white">画像追加</button>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {galleryImages.map((image) => (
          <article key={image.id} className="rounded border border-slate-200 bg-white p-3">
            <Image src={image.imageUrl} alt={image.alt} width={640} height={420} className="aspect-[4/3] w-full rounded object-cover" />
            <div className="mt-3 flex items-center justify-between">
              <p className="font-bold">{image.title}</p>
              <button className="focus-ring rounded border border-slate-200 px-3 py-1 text-sm font-bold">削除</button>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
