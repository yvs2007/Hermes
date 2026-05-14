"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In Phase 5 this fires off to Sentry. For now just log.
    console.error(error);
  }, [error]);

  return (
    <main className="verity-prose">
      <h1>Off the press</h1>
      <p>Something failed while compiling this page.</p>
      <pre style={{ whiteSpace: "pre-wrap", color: "var(--accent)" }}>
        {error.message}
      </pre>
      <button type="button" className="upgrade-button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
