import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert 24h time string "HH:MM" to 12h AM/PM display "h:MM AM/PM"
 * "07:00" → "7:00 AM"
 * "13:30" → "1:30 PM"
 * "00:00" → "12:00 AM"
 * "12:00" → "12:00 PM"
 */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '—';
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}
