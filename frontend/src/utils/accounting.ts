export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// A thin non-breaking space after the Naira sign, not the currency style's
// own glyph spacing, is what keeps it from visually colliding with the
// first digit in fonts with tight/negative Naira-sign side-bearing.
export function formatMoney(value: number): string {
  const grouped = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return `₦ ${grouped}`;
}

export function getToday(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}
