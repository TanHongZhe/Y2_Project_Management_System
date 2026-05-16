import { USERS } from './users';

// @mention handles — derived from USERS so the list stays in sync. Lowercase,
// spaces stripped. e.g. "Hong Zhe" → `@hongzhe`, "Wei Zen" → `@weizen`.
// Plus the special `@all` broadcast that fans out to every non-guest user.
export interface MentionHandle {
  handle: string;
  userId: string;
  name: string;
  initials: string;
  color: string;
  avatarUrl: string;
  isBroadcast?: boolean;  // true for @all
}

// Sentinel userId for @all — never matches a real user, expanded by
// extractMentionedUserIds at notification time.
export const ALL_USER_ID = '__all__';

const TEAM_HANDLES: MentionHandle[] = USERS
  .filter((u) => !u.isGuest)
  .map((u) => ({
    // Aria's display name "Aria (AI)" would produce "aria(ai)" which the alpha-only
    // mention regex can't match. Use the plain id "aria" as the handle instead.
    handle: u.isAria ? u.id : u.name.toLowerCase().replace(/\s+/g, ''),
    userId: u.id,
    name: u.name,
    initials: u.initials,
    color: u.color,
    avatarUrl: u.avatarUrl,
  }));

const ALL_HANDLE: MentionHandle = {
  handle: 'all',
  userId: ALL_USER_ID,
  name: 'Everyone',
  initials: 'ALL',
  color: 'var(--accent)',
  avatarUrl: '',
  isBroadcast: true,
};

// `@all` shown first so it's the easy default. Real teammates follow.
export const MENTION_HANDLES: MentionHandle[] = [ALL_HANDLE, ...TEAM_HANDLES];

export const MENTION_MAP: Record<string, string> = Object.fromEntries(
  MENTION_HANDLES.map((m) => [m.handle, m.userId]),
);

// Extract the userIds mentioned in a piece of text. Skips the author so we
// don't notify someone about their own typing. `@all` expands to every real
// teammate except the author.
export function extractMentionedUserIds(text: string, currentUserId?: string): string[] {
  const re = /@([a-zA-Z]{3,})\b/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const uid = MENTION_MAP[m[1].toLowerCase()];
    if (!uid) continue;
    if (uid === ALL_USER_ID) {
      for (const h of TEAM_HANDLES) {
        if (h.userId !== currentUserId && h.userId !== 'aria') found.add(h.userId);
      }
      continue;
    }
    if (uid !== currentUserId) found.add(uid);
  }
  return [...found];
}
