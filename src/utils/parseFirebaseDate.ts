export function parseFirebaseDate(date: unknown): Date | null {

  if (!date) return null;

  // Timestamp real do Firebase
  if (date && typeof date === 'object' && 'toDate' in date && typeof (date as { toDate: unknown }).toDate === 'function') {
    return (date as { toDate: () => Date }).toDate();
  }

  // Objeto serializado via JSON
  if (date && typeof date === 'object' && '_seconds' in date && typeof (date as { _seconds: unknown })._seconds === 'number') {
    return new Date((date as { _seconds: number })._seconds * 1000);
  }

  // Já é Date
  if (date instanceof Date) {
    return date;
  }

  return null;
}