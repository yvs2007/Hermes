import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

const LONG_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function formatLongDate(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return LONG_DATE_FMT.format(date);
}

const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function formatRefreshedAt(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${TIME_FMT.format(date)} UTC`;
}

export function formatVolumeIssue(d: Date = new Date()): {
  volume: string;
  issue: string;
} {
  // Volume increments yearly from launch year (2026 == Vol. I).
  const launchYear = 2026;
  const volume = romanize(d.getUTCFullYear() - launchYear + 1);
  // Issue is day-of-year, zero-padded to three digits.
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const diff = d.getTime() - start;
  const day = Math.floor(diff / 86_400_000);
  const issue = String(day).padStart(3, "0");
  return { volume: `Vol. ${volume}`, issue: `No. ${issue}` };
}

function romanize(n: number): string {
  if (n <= 0) return String(n);
  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let result = "";
  let remaining = n;
  for (const [value, sym] of numerals) {
    while (remaining >= value) {
      result += sym;
      remaining -= value;
    }
  }
  return result;
}

/**
 * Tiny helper for the byline: "Reuters, AP, Bloomberg, FT, BBC and WSJ".
 */
export function joinDisplayNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const head = names.slice(0, -1).join(", ");
  return `${head}, and ${names[names.length - 1]}`;
}
