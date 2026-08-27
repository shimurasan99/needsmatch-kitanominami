export function normalizeExternalUrl(value: string) {
  const url = value.trim();
  if (!url) return "";
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  return `https://${url.replace(/^\/+/, "")}`;
}
