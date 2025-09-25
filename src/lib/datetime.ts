import { DateTime } from 'luxon';

export function getCurrentDateISO(timezone: string): string {
  return DateTime.now().setZone(timezone).toFormat('yyyy-LL-dd');
}

export function getDayRange(
  dateInput: string | undefined,
  timezone: string
): { start: Date; end: Date; isoDate: string } {
  const isoDate = dateInput ?? getCurrentDateISO(timezone);
  const start = DateTime.fromISO(`${isoDate}T00:00:00`, { zone: timezone }).toUTC();
  const end = start.plus({ days: 1 });
  return { start: start.toJSDate(), end: end.toJSDate(), isoDate };
}

export function getSevenDayRange(
  endDateInput: string | undefined,
  timezone: string
): { start: Date; end: Date; endIsoDate: string; startIsoDate: string } {
  const { isoDate: endIsoDate } = getDayRange(endDateInput, timezone);
  const endStart = DateTime.fromISO(`${endIsoDate}T00:00:00`, {
    zone: timezone,
  }).toUTC();
  const start = endStart.minus({ days: 6 });
  const end = endStart.plus({ days: 1 });
  const startIsoDate = start.setZone(timezone).toFormat('yyyy-LL-dd');
  return { start: start.toJSDate(), end: end.toJSDate(), endIsoDate, startIsoDate };
}
