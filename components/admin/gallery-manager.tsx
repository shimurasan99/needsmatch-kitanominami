"use client";

import Image from "next/image";
import { ImagePlus, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { readGalleryImages, writeGalleryImages } from "@/lib/data/gallery-overrides";
import type { GalleryImage } from "@/types/domain";

const maxImages = 10;

export function GalleryManager({ initialImages }: { initialImages: GalleryImage[] }) {
  const [images, setImages] = useState<GalleryImage[]>(initialImages.slice(0, maxImages));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setImages(readGalleryImages(initialImages));
  }, [initialImages]);

  function updateImage(id: string, field: keyof Omit<GalleryImage, "id">, value: string) {
    setSaved(false);
    setImages((current) => current.map((image) => (image.id === id ? { ...image, [field]: value } : image)));
  }

  function addImage() {
    if (images.length >= maxImages) return;
    setSaved(false);
    setImages((current) => [
      ...current,
      {
        id: `gallery-${Date.now()}`,
        title: "新しい写真",
        description: "写真の説明文を入力してください。",
        imageUrl: "/images/gallery-1.svg",
        alt: "北のみなみ支部の写真"
      }
    ]);
  }

  function removeImage(id: string) {
    setSaved(false);
    setImages((current) => current.filter((image) => image.id !== id));
  }

  function saveImages() {
    writeGalleryImages(images);
    setSaved(true);
  }

  function resetImages() {
    setImages(initialImages.slice(0, maxImages));
    writeGalleryImages(initialImages.slice(0, maxImages));
    setSaved(true);
  }

  async function uploadImage(id: string, file: File | undefined) {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    updateImage(id, "imageUrl", dataUrl);
    updateImage(id, "alt", file.name.replace(/\.[^.]+$/, "") || "北のみなみ支部の写真");
  }

  return (
    <div className="space-y-5">
      <div className="rounded border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-forest">GALLERY SETTINGS</p>
            <h2 className="mt-1 text-2xl font-black text-deep">写真と説明文の編集</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">最大10枚まで登録できます。画像URL入力または写真ファイルのアップロードが使えます。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addImage}
              disabled={images.length >= maxImages}
              className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-deep hover:bg-snow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              画像追加
            </button>
            <button type="button" onClick={saveImages} className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-deep">
              <Save size={16} />
              保存
            </button>
          </div>
        </div>
        {saved && <p className="mt-4 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-forest">保存しました。トップページと支部紹介ページのギャラリーへ反映されます。</p>}
      </div>

      <div className="grid gap-4">
        {images.map((image, index) => (
          <article key={image.id} className="grid gap-4 rounded border border-slate-200 bg-white p-4 shadow-soft lg:grid-cols-[280px_1fr]">
            <div>
              <div className="relative overflow-hidden rounded border border-slate-200 bg-snow">
                <Image src={image.imageUrl} alt={image.alt} width={560} height={420} className="aspect-[4/3] w-full object-cover" unoptimized={image.imageUrl.startsWith("data:")} />
                <div className="absolute inset-x-0 bottom-0 bg-deep/72 p-3 text-white">
                  <p className="text-sm font-black">{image.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/90">{image.description}</p>
                </div>
              </div>
              <label className="focus-ring mt-3 flex cursor-pointer items-center justify-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-deep hover:bg-snow">
                <Upload size={16} />
                写真をアップロード
                <input type="file" accept="image/*" onChange={(event) => uploadImage(image.id, event.target.files?.[0])} className="sr-only" />
              </label>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-forest">写真 {index + 1}</p>
                <button type="button" onClick={() => removeImage(image.id)} className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm font-bold text-accent hover:bg-red-50">
                  <Trash2 size={15} />
                  削除
                </button>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">タイトル</span>
                <input value={image.title} onChange={(event) => updateImage(image.id, "title", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">説明文</span>
                <textarea value={image.description} onChange={(event) => updateImage(image.id, "description", event.target.value)} rows={3} className="focus-ring rounded border border-slate-200 px-3 py-3" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">画像URL</span>
                <input value={image.imageUrl} onChange={(event) => updateImage(image.id, "imageUrl", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">代替テキスト</span>
                <input value={image.alt} onChange={(event) => updateImage(image.id, "alt", event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3" />
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={saveImages} className="focus-ring inline-flex items-center gap-2 rounded bg-forest px-5 py-3 text-sm font-bold text-white hover:bg-deep">
          <ImagePlus size={17} />
          ギャラリーを保存
        </button>
        <button type="button" onClick={resetImages} className="focus-ring inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-deep hover:bg-snow">
          <RotateCcw size={17} />
          初期状態に戻す
        </button>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
