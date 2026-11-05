/**
 * After-Hours Router — Asia/Dhaka timezone by default.
 *
 * Determines whether "now" is within working hours for the configured
 * company. If not, returns the appropriate after-hours policy:
 *   queue                       — queue for the next working hour
 *   auto_reply_with_disclaimer  — auto-reply with an off-hours disclaimer
 *   emergency_only              — only emergency inquiries are answered live
 *
 * Working days: JSON array of weekday numbers (0=Sun, 1=Mon, ..., 6=Sat)
 * Working hours: HH:MM-HH:MM in the configured timezone
 * Holidays: JSON array of {date: "YYYY-MM-DD", name: "..."}
 *
 * The router uses the Intl API for timezone-correct time computation —
 * no moment-timezone dependency needed.
 */
import { db } from './db';

export interface AfterHoursDecision {
  isWorkingHours: boolean;
  /** When working hours resume next — ISO string, or null if >7 days out */
  nextWorkingHour: string | null;
  /** Policy to apply right now */
  policy: 'live' | 'queue' | 'auto_reply_with_disclaimer' | 'emergency_only';
  /** Disclaimer text to append if policy = auto_reply_with_disclaimer */
  disclaimer: string | null;
  /** Reason for the decision — for audit log */
  reason: string;
  /** Timezone used for the decision */
  timezone: string;
  /** Current time in the configured timezone, ISO */
  nowInTz: string;
}

const DEFAULT_TIMEZONE = 'Asia/Dhaka';
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri
const DEFAULT_WORKING_START = '09:00';
const DEFAULT_WORKING_END = '18:00';
const DEFAULT_DISCLAIMER =
  'Thank you for your message. Our team is currently outside working hours (Asia/Dhaka, Sat-Thu 9 AM - 6 PM). We will respond at the start of our next business day. For urgent emergencies, please call our hotline.';

export async function evaluateAfterHours(companyId: string): Promise<AfterHoursDecision> {
  const rule = await db.afterHoursRule.findUnique({ where: { companyId } });
  const timezone = rule?.timezone || DEFAULT_TIMEZONE;
  const workingDays = rule?.workingDays ? JSON.parse(rule.workingDays) : DEFAULT_WORKING_DAYS;
  const workingStart = rule?.workingStart || DEFAULT_WORKING_START;
  const workingEnd = rule?.workingEnd || DEFAULT_WORKING_END;
  const holidays = rule?.holidays ? JSON.parse(rule.holidays) : [];
  const afterHoursPolicy = (rule?.afterHoursPolicy || 'auto_reply_with_disclaimer') as AfterHoursDecision['policy'];
  const disclaimer = rule?.afterHoursDisclaimer || DEFAULT_DISCLAIMER;

  const now = new Date();
  const nowInTz = toZonedTime(now, timezone);
  const todayYyyyMmDd = formatYyyyMmDd(nowInTz);
  const weekday = nowInTz.getDay(); // 0=Sun

  // Check holiday
  const isHoliday = holidays.some((h: any) => h.date === todayYyyyMmDd);
  if (isHoliday) {
    const holidayName = holidays.find((h: any) => h.date === todayYyyyMmDd)?.name || 'public holiday';
    return {
      isWorkingHours: false,
      nextWorkingHour: nextWorkingHourIso(nowInTz, workingDays, workingStart, holidays, timezone),
      policy: afterHoursPolicy,
      disclaimer: afterHoursPolicy === 'auto_reply_with_disclaimer' ? disclaimer : null,
      reason: `public holiday: ${holidayName}`,
      timezone,
      nowInTz: nowInTz.toISOString(),
    };
  }

  // Check working day
  if (!workingDays.includes(weekday)) {
    return {
      isWorkingHours: false,
      nextWorkingHour: nextWorkingHourIso(nowInTz, workingDays, workingStart, holidays, timezone),
      policy: afterHoursPolicy,
      disclaimer: afterHoursPolicy === 'auto_reply_with_disclaimer' ? disclaimer : null,
      reason: `non-working day (weekday=${weekday})`,
      timezone,
      nowInTz: nowInTz.toISOString(),
    };
  }

  // Check working hour
  const [startH, startM] = workingStart.split(':').map(Number);
  const [endH, endM] = workingEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const nowMinutes = nowInTz.getHours() * 60 + nowInTz.getMinutes();

  if (nowMinutes < startMinutes || nowMinutes >= endMinutes) {
    return {
      isWorkingHours: false,
      nextWorkingHour: nextWorkingHourIso(nowInTz, workingDays, workingStart, holidays, timezone),
      policy: afterHoursPolicy,
      disclaimer: afterHoursPolicy === 'auto_reply_with_disclaimer' ? disclaimer : null,
      reason: `outside working hours (${workingStart}-${workingEnd} ${timezone})`,
      timezone,
      nowInTz: nowInTz.toISOString(),
    };
  }

  return {
    isWorkingHours: true,
    nextWorkingHour: null,
    policy: 'live',
    disclaimer: null,
    reason: 'within working hours',
    timezone,
    nowInTz: nowInTz.toISOString(),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Lightweight timezone conversion using Intl.DateTimeFormat — avoids pulling
// in moment-timezone (which is ~50KB minified).

function toZonedTime(date: Date, timeZone: string): Date {
  // Get the wall-clock time in the target timezone
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: any = {};
  for (const p of parts) map[p.type] = p.value;
  // hour12: false can return "24" at midnight — normalize
  if (map.hour === '24') map.hour = '00';
  return new Date(`${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`);
}

function formatYyyyMmDd(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function nextWorkingHourIso(
  nowInTz: Date,
  workingDays: number[],
  workingStart: string,
  holidays: any[],
  timezone: string
): string | null {
  const [startH, startM] = workingStart.split(':').map(Number);
  // Walk forward up to 7 days
  for (let i = 1; i <= 7; i++) {
    const d = new Date(nowInTz.getTime() + i * 24 * 60 * 60 * 1000);
    const zoned = toZonedTime(new Date(d), timezone);
    const weekday = zoned.getDay();
    const dateStr = formatYyyyMmDd(zoned);
    const isHoliday = holidays.some((h: any) => h.date === dateStr);
    if (!isHoliday && workingDays.includes(weekday)) {
      const next = new Date(zoned);
      next.setUTCHours(startH, startM, 0, 0);
      return next.toISOString();
    }
  }
  return null;
}
