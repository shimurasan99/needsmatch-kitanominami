const versions = new Map<string, string | null>();

export async function fetchSharedState<T>(key: string): Promise<T | null> {
  const response = await fetch(`/api/site-state/${encodeURIComponent(key)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  const result = await response.json() as { payload: T | null; updatedAt: string | null };
  versions.set(key, result.updatedAt);
  return result.payload;
}

export async function saveSharedState<T>(key: string, payload: T): Promise<T> {
  if (!versions.has(key)) await fetchSharedState(key);
  return writeState(key, payload, versions.get(key) ?? null);
}

// Reapply the smallest edit to the latest record when another operator saved first.
export async function updateSharedState<T>(key: string, update: (current: T | null) => T): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`/api/site-state/${encodeURIComponent(key)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await readError(response));
    const current = await response.json() as { payload: T | null; updatedAt: string | null };
    try { return await writeState(key, update(current.payload), current.updatedAt); }
    catch (error) { if (!(error instanceof StateConflictError) || attempt === 4) throw error; }
  }
  throw new Error("更新が重なりました。もう一度保存してください。");
}

class StateConflictError extends Error {}

async function writeState<T>(key: string, payload: T, version: string | null): Promise<T> {
  const response = await fetch(`/api/site-state/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "If-Match": version ?? "new" },
    body: JSON.stringify(payload)
  });
  if (response.status === 409) throw new StateConflictError(await readError(response));
  if (!response.ok) throw new Error(await readError(response));
  const result = await response.json() as { payload: T; updatedAt: string };
  versions.set(key, result.updatedAt);
  return result.payload;
}

async function readError(response: Response) {
  if (response.status === 401 || response.status === 403) return "ログインの有効期限が切れています。運営ページから再度ログインしてください。";
  try {
    const result = await response.json() as { error?: string };
    return result.error || "保存に失敗しました。";
  } catch {
    return "保存に失敗しました。";
  }
}
