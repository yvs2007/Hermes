export function slugifyTitle(title: string, suffix?: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
  if (!suffix) return base;
  return `${base}-${suffix.slice(0, 6)}`;
}
