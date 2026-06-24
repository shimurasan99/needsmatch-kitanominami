"use client";

import type { GalleryImage } from "@/types/domain";

export const GALLERY_STORAGE_KEY = "nm_gallery_images_v2";
const GALLERY_UPDATED_EVENT = "nm-gallery-updated";

export function readGalleryImages(fallback: GalleryImage[]) {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(GALLERY_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as GalleryImage[];
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter((image) => image.id && image.imageUrl).slice(0, 10);
  } catch {
    return fallback;
  }
}

export function writeGalleryImages(images: GalleryImage[]) {
  const next = images.slice(0, 10);
  window.localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(GALLERY_UPDATED_EVENT));
}

export function subscribeGalleryImages(listener: () => void) {
  window.addEventListener(GALLERY_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(GALLERY_UPDATED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
