import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE, SITE_NAMEPLATE_SUB, SECTIONS } from "@/lib/constants";
import { formatVolumeIssue } from "@/lib/utils";
import { Dateline } from "@/components/newspaper/Dateline";

interface MastheadProps {
  outletCount: number;
}

export function Masthead({ outletCount }: MastheadProps) {
  const { volume, issue } = formatVolumeIssue();
  return (
    <header className="masthead-wrap">
      <div className="top-rule">
        <span>
          {volume} &middot; {issue}
        </span>
        <span>{SITE_NAMEPLATE_SUB}</span>
        <span>Edition: Local</span>
      </div>
      <Link href="/" className="block no-underline">
        <h1 className="masthead-title">{SITE_NAME}</h1>
      </Link>
      <p className="masthead-tag">{SITE_TAGLINE}</p>
      <Dateline outletCount={outletCount} />
      <nav className="sections" aria-label="Sections">
        {SECTIONS.map((s) => (
          <Link key={s.slug} href={s.slug}>
            {s.label}
          </Link>
        ))}
        <span className="sections-spacer" aria-hidden />
        <Link href="/settings">Settings</Link>
      </nav>
    </header>
  );
}
