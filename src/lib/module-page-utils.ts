function toDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

export function getStartOfWeek(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  const day = nextDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  nextDate.setDate(nextDate.getDate() + diff);
  return nextDate;
}

export function isSameWeek(date: string, referenceDate: Date) {
  return (
    getStartOfWeek(toDate(date)).getTime() ===
    getStartOfWeek(referenceDate).getTime()
  );
}

export function formatMinutes(value: number) {
  const totalMinutes = Math.max(0, Math.round(value));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes} min`;
}

export function sortEntriesByDate<T extends { date: string; createdAt?: string }>(
  entries: T[],
) {
  return [...entries].sort((left, right) => {
    const byDate = right.date.localeCompare(left.date);
    if (byDate !== 0) return byDate;
    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  });
}
