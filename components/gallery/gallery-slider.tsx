"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchGalleryImages, subscribeGalleryImages } from "@/lib/data/gallery-overrides";
import type { GalleryImage } from "@/types/domain";

export function GallerySlider({ images: initialImages, compact = false }: { images: GalleryImage[]; compact?: boolean }) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [message, setMessage] = useState("写真を読み込んでいます...");
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) setPaused(true);
    const update = () => { if (preference.matches) setPaused(true); };
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      void fetchGalleryImages(initialImages).then((next) => { if (active && request === revision) { setImages(next); setMessage(""); } }).catch(() => { if (active && request === revision) setMessage("最新の写真を読み込めませんでした。再読み込みしてください。"); });
    };
    refresh();
    const unsubscribe = subscribeGalleryImages(refresh);
    window.addEventListener("focus", refresh);
    return () => { active = false; unsubscribe(); window.removeEventListener("focus", refresh); };
  }, [initialImages]);

  useEffect(() => {
    if (images.length <= 1 || paused || hovered) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [images.length, paused, hovered]);

  useEffect(() => {
    if (activeIndex > images.length - 1) setActiveIndex(0);
  }, [activeIndex, images.length]);

  const activeImage = useMemo(() => images[activeIndex] ?? images[0], [activeIndex, images]);

  if (!activeImage) return message ? <p className="text-sm text-slate-600">{message}</p> : null;

  function move(delta: number) {
    setActiveIndex((current) => (current + delta + images.length) % images.length);
  }

  return (
    <div className="space-y-4" role="region" aria-label="写真ギャラリー" onFocusCapture={() => setPaused(true)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {message && <p className="text-sm text-slate-600">{message}</p>}
      <div className="relative overflow-hidden rounded border border-slate-200 bg-deep shadow-soft">
        <div className={compact ? "relative aspect-[4/3] sm:aspect-[16/9]" : "relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9]"}>
          {images.map((image, index) => (
            <Image
              key={image.id}
              src={image.imageUrl || "/images/gallery-1.svg"}
              alt={index === activeIndex ? image.alt : ""}
              aria-hidden={index !== activeIndex}
              fill
              sizes="(min-width: 1024px) 1120px, 100vw"
              className={`object-cover transition-opacity duration-700 motion-reduce:transition-none ${index === activeIndex ? "opacity-100" : "opacity-0"}`}
              unoptimized
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
          <button type="button" onClick={() => setPaused((current) => !current)} className="focus-ring inline-flex items-center gap-1 rounded border border-slate-200 px-3 py-1 text-sm font-bold" aria-label={paused ? "写真の自動切り替えを再開" : "写真の自動切り替えを停止"}>
            {paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "再開" : "一時停止"}
          </button>
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2.5 rounded-full transition-all ${index === activeIndex ? "w-9 bg-forest" : "w-2.5 bg-slate-300 hover:bg-lake"}`}
              aria-label={`${image.title}を表示`}
              aria-current={index === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
