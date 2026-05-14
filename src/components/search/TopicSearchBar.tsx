"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { COMPILE_MODES, type CompileMode } from "@/lib/constants";
import { SOURCE_WHITELIST } from "@/lib/source-whitelist";
import { useSynthesis } from "@/hooks/useSynthesis";

interface Suggestion {
  title: string;
  source: string;
}

export function TopicSearchBar() {
  const router = useRouter();
  const { synthesize, loading: synthLoading, error } = useSynthesis();

  const [mode, setMode] = useState<CompileMode>("freeform");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [text, setText] = useState("");
  const [textarea, setTextarea] = useState("");
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(
    () =>
      new Set(
        ["reuters.com", "apnews.com", "bbc.com", "bloomberg.com", "ft.com"].filter((d) =>
          SOURCE_WHITELIST.some((s) => s.domain === d),
        ),
      ),
  );

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const cfg = useMemo(() => COMPILE_MODES.find((m) => m.value === mode)!, [mode]);
  const busy = synthLoading;

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setSuggestions(d.suggestions ?? []);
        setShowSuggestions((d.suggestions ?? []).length > 0);
        setSelectedIdx(-1);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }, []);

  function onTextChange(value: string) {
    setText(value);
    if (cfg.input === "text" && mode !== "links") {
      fetchSuggestions(value);
    }
  }

  function pickSuggestion(s: Suggestion) {
    setText(s.title);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIdx >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[selectedIdx]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setShowSuggestions(false);

    if (cfg.input === "text" && !text.trim()) return;
    if (cfg.input === "textarea" && !textarea.trim()) return;

    const payload =
      cfg.input === "text"
        ? mode === "headline"
          ? { mode, headline: text.trim() }
          : { mode, query: text.trim() }
        : {
            mode,
            urls: textarea
              .split(/\r?\n/)
              .map((u) => u.trim())
              .filter(Boolean),
          };
    if (mode === "compare") {
      (payload as { domains?: string[] }).domains = Array.from(selectedDomains);
    }
    const result = await synthesize(payload);
    if (result?.story?.slug) {
      router.push(`/topic/${result.story.slug}`);
    }
  }

  function toggleDomain(domain: string) {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  return (
    <form className="compose" onSubmit={onSubmit} aria-busy={busy}>
      {/* Default: clean chat-like bar. Advanced: shows mode selector. */}
      {showAdvanced ? (
        <div className="compose-head">
          <span className="mode-label">Compile</span>
          <select
            className="mode-select"
            value={mode}
            onChange={(e) => setMode(e.target.value as CompileMode)}
            aria-label="Compile mode"
            disabled={busy}
          >
            {COMPILE_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showAdvanced ? (
        <div className="mode-hint">{cfg.hint}</div>
      ) : null}

      {cfg.showSourcePicker ? (
        <div className="source-picker">
          <span className="picker-label">Restrict to:</span>
          {SOURCE_WHITELIST.map((s) => (
            <label key={s.domain}>
              <input
                type="checkbox"
                checked={selectedDomains.has(s.domain)}
                onChange={() => toggleDomain(s.domain)}
                disabled={busy}
              />
              {s.displayName}
            </label>
          ))}
        </div>
      ) : null}

      <div className="compose-body" ref={wrapperRef}>
        {cfg.input === "text" ? (
          <div className="compose-input-wrap">
            <input
              className="compose-input"
              type="text"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onKeyDown={onKeyDown}
              placeholder={
                showAdvanced
                  ? cfg.placeholder
                  : "Ask Hermes anything — compare topics, find connections, explore events..."
              }
              disabled={busy}
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="suggestions-dropdown" role="listbox">
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.title}-${s.source}`}
                    className={`suggestion-item${i === selectedIdx ? " suggestion-active" : ""}`}
                    role="option"
                    aria-selected={i === selectedIdx}
                    onMouseDown={() => pickSuggestion(s)}
                    onMouseEnter={() => setSelectedIdx(i)}
                  >
                    <span className="suggestion-title">{s.title}</span>
                    <span className="suggestion-source">{s.source}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <textarea
            className="compose-input compose-textarea"
            value={textarea}
            onChange={(e) => setTextarea(e.target.value)}
            placeholder={cfg.placeholder}
            disabled={busy}
          />
        )}
        <button type="submit" className="compose-action" disabled={busy}>
          {synthLoading ? "Compiling\u2026" : "Compile"}
        </button>
      </div>

      <div className="compose-footer">
        <button
          type="button"
          className="advanced-toggle"
          onClick={() => {
            setShowAdvanced((v) => !v);
            if (!showAdvanced) setMode("freeform");
          }}
        >
          {showAdvanced ? "Simple" : "Advanced"}
        </button>
      </div>

      {error ? (
        <div className="compose-error" role="alert">
          {error}
        </div>
      ) : null}
    </form>
  );
}
