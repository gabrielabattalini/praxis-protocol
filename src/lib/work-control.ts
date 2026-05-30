import type { WorkControlEntry } from "@/lib/types";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getWorkControlRemainingDays(
  fatalDeadline?: string,
  referenceDate: Date = new Date(),
) {
  if (!fatalDeadline) return null;

  const deadline = new Date(`${fatalDeadline}T00:00:00`);
  if (Number.isNaN(deadline.getTime())) return null;

  return Math.round(
    (startOfDay(deadline).getTime() - startOfDay(referenceDate).getTime()) /
      DAY_IN_MS,
  );
}

export function normalizeWorkControlEntry(
  entry: WorkControlEntry,
): WorkControlEntry {
  return {
    ...entry,
    clientName: entry.clientName.trim(),
    referenceNumber: entry.referenceNumber.trim(),
    entryType: entry.entryType.trim(),
    startDate: entry.startDate?.trim() || undefined,
    fatalDeadline: entry.fatalDeadline?.trim() || undefined,
    progressLabel: entry.progressLabel.trim(),
    notes: entry.notes?.trim() || "",
  };
}
