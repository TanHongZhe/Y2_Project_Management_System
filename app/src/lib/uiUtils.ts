/** Greeting based on time of day */
export function greeting(firstName: string): string {
  const h = new Date().getHours();
  if (h < 12) return `Good morning, ${firstName}`;
  if (h < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

/** Relative due-date label for todos */
export interface RelDate { text: string; isOverdue: boolean; isSoon: boolean }
export function relativeDate(ts: number): RelDate {
  const dayMs = 86_400_000;
  const days = Math.round((ts - Date.now()) / dayMs);
  if (days === 0)  return { text: 'Today',           isOverdue: false, isSoon: true };
  if (days === 1)  return { text: 'Tomorrow',         isOverdue: false, isSoon: true };
  if (days === -1) return { text: 'Yesterday',        isOverdue: true,  isSoon: false };
  if (days > 1 && days <= 6)   return { text: `in ${days} days`,             isOverdue: false, isSoon: days <= 3 };
  if (days >= 7)               return { text: `in ${Math.round(days / 7)}w`,  isOverdue: false, isSoon: false };
  if (days < -1 && days >= -6) return { text: `${Math.abs(days)}d ago`,       isOverdue: true,  isSoon: false };
  return { text: `${Math.round(Math.abs(days) / 7)}w ago`, isOverdue: true, isSoon: false };
}

/** Human-readable "X ago" for timestamps */
export function relativeTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24)     return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)      return `${d}d ago`;
  if (d < 30)     return `${Math.floor(d / 7)}w ago`;
  if (d < 365)    return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/** Word count from markdown / plain text */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
