"use client";

import type { GalleryImage } from "@/types/domain";
import { fetchSharedState, updateSharedState } from "@/lib/data/shared-state";
import { mergeEditedRecords } from "@/lib/data/merge-edited-records";

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
  try { window.localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(next)); } catch { /* Optional browser cache. */ }
  window.dispatchEvent(new Event(GALLERY_UPDATED_EVENT));
}

export async function fetchGalleryImages(fallback: GalleryImage[]) {
  const shared = await fetchSharedState<GalleryImage[]>("gallery");
  const next = (shared ?? fallback).slice(0, 10);
  try { window.localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(next)); } catch { /* Optional browser cache. */ }
  return next;
}

export async function saveGalleryImages(images: GalleryImage[], baseline: GalleryImage[]) {
  const next = await updateSharedState<GalleryImage[]>("gallery", (current) => {
    const merged = mergeEditedRecords(current ?? baseline, baseline, images);
    if (merged.length > 10) throw new Error("他の運営者の追加を含めて画像が10枚を超えています。再読み込みして確認してください。");
    return merged;
  });
  writeGalleryImages(next);
  return next;
}

export function subscribeGalleryImages(listener: () => void) {
  window.addEventListener(GALLERY_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(GALLERY_UPDATED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
