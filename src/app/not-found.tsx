import Link from "next/link";

export default function NotFound() {
  return (
    <main className="verity-prose">
      <h1>404 — Off the press</h1>
      <p>We didn&rsquo;t find a compiled story at that address.</p>
      <p>
        <Link href="/">Return to the front page</Link>.
      </p>
    </main>
  );
}
