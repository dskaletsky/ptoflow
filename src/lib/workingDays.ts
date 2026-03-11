/**
 * Calculate the number of working days between two dates (inclusive),
 * excluding weekends and the provided company holidays.
 */
export function countWorkingDays(
  startDate: Date,
  endDate: Date,
  holidays: Date[] = []
): number {
  const holidaySet = new Set(
    holidays.map((d) => toDateString(d))
  );

  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(toDateString(current));
    if (!isWeekend && !isHoliday) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

function toDateString(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}
