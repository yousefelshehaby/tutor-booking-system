const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

/** "2026-07" -> "يوليو 2026" */
export function formatMonth(month: string): string {
  const [year, monthNum] = month.split("-");
  const index = Number(monthNum) - 1;
  const name = ARABIC_MONTHS[index] ?? month;
  return `${name} ${year}`;
}
