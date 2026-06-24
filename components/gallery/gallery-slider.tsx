"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readGalleryImages, subscribeGalleryImages } from "@/lib/data/gallery-overrides";
import type { GalleryImage } from "@/types/domain";

export function GallerySlider({ images: initialImages, compact = false }: { images: GalleryImage[]; compact?: boolean }) {
  const [images, setImages] = useState(initialImages.slice(0, 10));
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const refresh = () => setImages(readGalleryImages(initialImages));
    refresh();
    return subscribeGalleryImages(refresh);
  }, [initialImages]);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [images.length]);

  useEffect(() => {
    if (activeIndex > images.length - 1) setActiveIndex(0);
  }, [activeIndex, images.length]);

  const activeImage = useMemo(() => images[activeIndex] ?? images[0], [activeIndex, images]);

  if (!activeImage) return null;

  function move(delta: number) {
    setActiveIndex((current) => (current + delta + images.length) % images.length);
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded border border-slate-200 bg-deep shadow-soft">
        <div className={compact ? "relative aspect-[4/3] sm:aspect-[16/9]" : "relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9]"}>
          {images.map((image, index) => (
            <Image
              key={image.id}
              src={image.imageUrl}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 1120px, 100vw"
              className={`object-cover transition-opacity duration-700 ${index === activeIndex ? "opacity-100" : "opacity-0"}`}
              unoptimized={image.imageUrl.startsWith("data:")}
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(7,55,99,0),rgba(7,55,99,0.82))] px-4 pb-4 pt-16 text-white sm:px-6 sm:pb-6">
            <p className="text-lg font-black sm:text-2xl">{activeImage.title}</p>
            {activeImage.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-white/90 sm:text-base">{activeImage.description}</p>}
          </div>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => move(-1)}
                className="focus-ring absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-deep shadow-soft hover:bg-white"
                aria-label="前の写真"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                className="focus-ring absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-deep shadow-soft hover:bg-white"
                aria-label="次の写真"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
        </div>
      </div>
      {images.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2.5 rounded-full transition-all ${index === activeIndex ? "w-9 bg-forest" : "w-2.5 bg-slate-300 hover:bg-lake"}`}
              aria-label={`${image.title}を表示`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
