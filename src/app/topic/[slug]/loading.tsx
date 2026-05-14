export default function Loading() {
  return (
    <main className="verity-main" aria-busy="true">
      <article className="lead-rail">
        <div className="lead-eyebrow">Compiling…</div>
        <h2 className="lead-headline" style={{ color: "var(--ink-soft)" }}>
          Setting type…
        </h2>
        <p className="lead-deck">Pulling source articles, attributing claims, surfacing disagreements.</p>
      </article>
      <aside className="side-rail" aria-label="Loading">
        <div className="side-eyebrow">Also Compiled Today</div>
      </aside>
    </main>
  );
}
