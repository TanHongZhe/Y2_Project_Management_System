export interface AppUser {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatarUrl: string;
  isGuest?: boolean;
}

// DiceBear adventurer-neutral — face-only avatars, hand-picked seeds.
// Note: this style has NO skinColor param; the backgroundColor IS the skin tone
// and expressions come from the seed (intentionally random). URLs are used
// verbatim as chosen from the DiceBear playground.
export const USERS: AppUser[] = [
  {
    id: "hong-zhe",
    name: "Hong Zhe",
    initials: "HZ",
    color: "#4f8ef7",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Riley",
  },
  {
    id: "dzuldiniy",
    name: "Dzuldiniy",
    initials: "DZ",
    color: "#e05c8a",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer-neutral/svg?backgroundColor=ecad80,f2d3b1&seed=Christopher",
  },
  {
    id: "chun-wen",
    name: "Chun Wen",
    initials: "CW",
    color: "#9b6dc9",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Alexander",
  },
  {
    id: "wei-zen",
    name: "Wei Zen",
    initials: "WZ",
    color: "#3aaa6e",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Chase",
  },
  {
    id: "yong-zhi",
    name: "Yong Zhi",
    initials: "YZ",
    color: "#d4a017",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Ryan",
  },
  {
    id: "fangnan",
    name: "Fangnan",
    initials: "FN",
    color: "#e07a3a",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer-neutral/svg?backgroundColor=ecad80,f2d3b1&seed=Adrian",
  },
  {
    id: "yida",
    name: "Yida",
    initials: "YD",
    color: "#1ba8a8",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Eden",
  },
  {
    id: "guest",
    name: "Guest",
    initials: "G",
    color: "#6b7280",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Midnight&backgroundColor=b6e3f4",
    isGuest: true,
  },
];

export const USER_STORAGE_KEY = "pms-user-id";

export function getSavedUserId(): string | null {
  try { return localStorage.getItem(USER_STORAGE_KEY); } catch { return null; }
}

export function saveUserId(id: string) {
  try { localStorage.setItem(USER_STORAGE_KEY, id); } catch {}
}

export function clearUserId() {
  try { localStorage.removeItem(USER_STORAGE_KEY); } catch {}
}

export function getUserById(id: string): AppUser | undefined {
  return USERS.find(u => u.id === id);
}
