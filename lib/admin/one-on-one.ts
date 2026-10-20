export const ONE_ON_ONE_BUCKET = "admin-one-on-one";
export const MAX_ONE_ON_ONE_SIZE = 3 * 1024 * 1024;
export function oneOnOneType(bytes: Uint8Array) {
  const starts = (prefix: number[]) => prefix.every((v, i) => bytes[i] === v);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return { extension: "pdf", mime: "application/pdf" };
  if (starts([0xff, 0xd8, 0xff])) return { extension: "jpg", mime: "image/jpeg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { extension: "png", mime: "image/png" };
  if (new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return { extension: "webp", mime: "image/webp" };
  throw new Error("PDF・JPEG・PNG・WebP形式のファイルを選択してください。");
}
