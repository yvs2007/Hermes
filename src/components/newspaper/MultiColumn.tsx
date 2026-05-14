import type { ReactNode } from "react";

/**
 * MultiColumn renders broadsheet-style two-column body copy with a vertical
 * column rule. Children should be paragraphs (`<p>`) or column-spanning
 * callouts (which set `column-span: all` themselves).
 *
 * The `body-cols` class (defined in globals.css) handles column-count, the
 * column-rule, justified text, and the mobile collapse to a single column.
 */
export function MultiColumn({ children }: { children: ReactNode }) {
  return <div className="body-cols">{children}</div>;
}
