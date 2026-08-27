export async function fetchSharedState<T>(key: string): Promise<T | null> {
  const response = await fetch(`/api/site-state/${encodeURIComponent(key)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  const result = await response.json() as { payload: T | null };
  return result.payload;
}

export async function saveSharedState<T>(key: string, payload: T): Promise<T> {
  const response = await fetch(`/api/site-state/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await readError(response));
  const result = await response.json() as { payload: T };
  return result.payload;
}

async function readError(response: Response) {
  try {
    const result = await response.json() as { error?: string };
    return result.error || "保存に失敗しました。";
  } catch {
    return "保存に失敗しました。";
  }
}
