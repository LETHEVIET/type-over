export type Preferences = {
  sound: boolean;
  opacity: number; // 0..1
  fontSize: number; // px
};

export const DEFAULT_PREFS: Preferences = {
  sound: false,
  opacity: 0.9,
  fontSize: 16,
};

function getStorageArea() {
  // Prefer sync when available, fallback to local
  // @ts-ignore - sync may be undefined in some browsers
  return (browser.storage && (browser.storage.sync || browser.storage.local)) || browser.storage.local;
}

export async function getPrefs(): Promise<Preferences> {
  const storage = getStorageArea();
  try {
    const data = await storage.get("typeover:prefs");
    const prefs = (data?.["typeover:prefs"] ?? {}) as Partial<Preferences>;
    return { ...DEFAULT_PREFS, ...prefs };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function setPrefs(update: Partial<Preferences>): Promise<Preferences> {
  const storage = getStorageArea();
  const current = await getPrefs();
  const next: Preferences = { ...current, ...update };
  try {
    await storage.set({ ["typeover:prefs"]: next });
  } catch {}
  return next;
}
