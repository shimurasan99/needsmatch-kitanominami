// Apply only edits made since the form loaded; preserve other operators' edits.
export function mergeEditedRecords<T extends { id: string }>(current: T[], baseline: T[], edited: T[]): T[] {
  const original = new Map(baseline.map((item) => [item.id, item]));
  const desired = new Map(edited.map((item) => [item.id, item]));
  const latest = new Map(current.map((item) => [item.id, item]));
  const conflict = () => { throw new Error("同じ情報が別の運営者によって変更されています。再読み込みしてから変更内容を確認してください。"); };
  for (const old of baseline) {
    if (!desired.has(old.id)) {
      const now = latest.get(old.id);
      if (now && JSON.stringify(now) !== JSON.stringify(old)) conflict();
      latest.delete(old.id);
    }
  }
  for (const item of edited) {
    const old = original.get(item.id);
    const now = latest.get(item.id);
    if (!old) {
      if (now && JSON.stringify(now) !== JSON.stringify(item)) conflict();
      latest.set(item.id, item);
      continue;
    }
    const changed = (Object.keys(item) as (keyof T)[]).filter((key) => JSON.stringify(item[key]) !== JSON.stringify(old[key]));
    if (!changed.length) continue;
    if (!now) conflict();
    const merged = { ...now! };
    for (const key of changed) {
      if (JSON.stringify(now![key]) !== JSON.stringify(old[key]) && JSON.stringify(now![key]) !== JSON.stringify(item[key])) conflict();
      merged[key] = item[key];
    }
    latest.set(item.id, merged);
  }
  // Keep the displayed order, then append records another operator added.
  return [...edited.map((item) => latest.get(item.id)).filter((item): item is T => !!item), ...current.filter((item) => !desired.has(item.id) && !original.has(item.id))];
}
