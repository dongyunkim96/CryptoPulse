import { create } from 'zustand';
export const STORAGE_KEY = 'cryptopulse.watchlist.v1';
export function parseFavorites(raw: string | null): string[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(v)
      ? [
          ...new Set(
            v.filter((s): s is string => typeof s === 'string' && /^[a-z0-9-]{1,100}$/.test(s)),
          ),
        ].slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
function read() {
  try {
    return parseFavorites(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}
function persist(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}
export const useWatchlist = create<{
  ids: string[];
  storageError: boolean;
  toggle: (id: string) => void;
  clear: () => void;
  sync: (raw: string | null) => void;
}>((set) => ({
  ids: read(),
  storageError: false,
  toggle: (id) =>
    set((s) => {
      const ids = s.ids.includes(id) ? s.ids.filter((i) => i !== id) : [...s.ids, id];
      return { ids, storageError: !persist(ids) };
    }),
  clear: () => set({ ids: [], storageError: !persist([]) }),
  sync: (raw) => set({ ids: parseFavorites(raw) }),
}));
