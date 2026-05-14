import { formatLongDate, formatVolumeIssue } from "@/lib/utils";

interface DatelineProps {
  outletCount: number;
  /** Override for SSR-stable rendering (defaults to today). */
  date?: Date;
}

export function Dateline({ outletCount, date = new Date() }: DatelineProps) {
  const longDate = formatLongDate(date);
  const { volume, issue } = formatVolumeIssue(date);
  return (
    <div className="dateline-row" aria-label="Edition dateline" data-vol={volume} data-iss={issue}>
      <span>{longDate}</span>
      <span>Compiled hourly from {outletCount} whitelisted outlets</span>
      <span>journal-trader.local</span>
    </div>
  );
}
