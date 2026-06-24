import { AdminShell } from "@/components/admin/admin-shell";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { galleryImages } from "@/lib/data/mock";

export default function AdminGalleryPage() {
  return (
    <AdminShell title="写真ギャラリー管理">
      <GalleryManager initialImages={galleryImages} />
    </AdminShell>
  );
}
