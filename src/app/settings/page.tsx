"use client";

import { useEffect, useState } from "react";
import { SITE_NAME } from "@/lib/constants";

interface Settings {
  llm_provider?: string;
  llm_api_key?: string;
  llm_base_url?: string;
  llm_synth_model?: string;
  llm_analyze_model?: string;
  llm_embed_model?: string;
  [key: string]: string | undefined;
}

interface SourceRow {
  domain: string;
  display_name: string;
  category: string;
  rss_feed_urls: string;
  bias_rating: string;
  credibility_score: number;
  factual_reporting: string;
  is_active: number;
  notes: string | null;
}

const PROVIDERS = [
  { value: "ollama", label: "Ollama (Local)", needsKey: false },
  { value: "openai", label: "OpenAI", needsKey: true },
  { value: "anthropic", label: "Anthropic", needsKey: true },
  { value: "vllm", label: "vLLM (Local)", needsKey: false },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);

  // Auto-pipeline
  const [pipelineEnabled, setPipelineEnabled] = useState(false);
  const [pipelineInterval, setPipelineInterval] = useState(5);
  const [pipelineLastRun, setPipelineLastRun] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineSaving, setPipelineSaving] = useState(false);

  // Sources
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newName, setNewName] = useState("");
  const [newRss, setNewRss] = useState("");
  const [newCategory, setNewCategory] = useState("business");

  // Wayback
  const [wbQuery, setWbQuery] = useState("");
  const [wbFrom, setWbFrom] = useState("");
  const [wbTo, setWbTo] = useState("");
  const [wbSearching, setWbSearching] = useState(false);
  const [wbResult, setWbResult] = useState<{ found: number; ingested: number; articles: Array<{ url: string; title: string; domain: string; stored: boolean }> } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings ?? {}))
      .catch(() => {});
    loadSources();
    loadPipelineStatus();
  }, []);

  function loadPipelineStatus() {
    fetch("/api/auto-pipeline")
      .then((r) => r.json())
      .then((d) => {
        setPipelineEnabled(d.enabled ?? false);
        setPipelineInterval(d.intervalMinutes ?? 5);
        setPipelineLastRun(d.lastRun ?? null);
      })
      .catch(() => {});
  }

  async function savePipelineSettings(enabled: boolean, interval: number) {
    setPipelineSaving(true);
    try {
      await fetch("/api/auto-pipeline", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, intervalMinutes: interval }),
      });
      setPipelineEnabled(enabled);
      setPipelineInterval(interval);
    } catch { /* ignore */ }
    setPipelineSaving(false);
  }

  async function runPipelineNow() {
    setPipelineRunning(true);
    try {
      const r = await fetch("/api/auto-pipeline", { method: "POST" });
      const d = await r.json();
      const s = d.stats?.pipeline;
      const ingestStats = s?.ingest?.stats;
      const synthStats = s?.synthesis?.stats;
      setPipelineLastRun(d.stats?.ranAt ?? new Date().toISOString());
      setIngestResult(
        `Pipeline: ${ingestStats?.itemsStored ?? 0} articles ingested, ${synthStats?.freshSyntheses ?? 0} stories synthesized`,
      );
    } catch (e) {
      setIngestResult(`Pipeline error: ${(e as Error).message}`);
    }
    setPipelineRunning(false);
  }

  function loadSources() {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((d) => setSources(d.sources ?? []))
      .catch(() => {});
  }

  const provider = settings.llm_provider ?? "ollama";
  const needsKey = PROVIDERS.find((p) => p.value === provider)?.needsKey ?? false;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!r.ok) throw new Error("Failed to save settings");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function runIngest() {
    setIngesting(true);
    setIngestResult(null);
    try {
      const r = await fetch("/api/ingest", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Ingest failed");
      const s = d.stats;
      setIngestResult(`Done — ${s.itemsStored} new articles from ${s.sources} sources`);
    } catch (e) {
      setIngestResult(`Error: ${(e as Error).message}`);
    } finally {
      setIngesting(false);
    }
  }

  async function toggleSource(domain: string, active: boolean) {
    await fetch("/api/sources", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "toggle", domain, active }),
    });
    setSources((prev) =>
      prev.map((s) => (s.domain === domain ? { ...s, is_active: active ? 1 : 0 } : s)),
    );
  }

  async function addSource() {
    if (!newDomain.trim()) return;
    const r = await fetch("/api/sources", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "add",
        source: {
          domain: newDomain.trim(),
          displayName: newName.trim() || newDomain.trim(),
          category: newCategory,
          rssFeeds: newRss
            .split("\n")
            .map((u) => u.trim())
            .filter(Boolean),
        },
      }),
    });
    if (r.ok) {
      setNewDomain("");
      setNewName("");
      setNewRss("");
      setShowAddSource(false);
      loadSources();
    }
  }

  async function deleteSource(domain: string) {
    const r = await fetch("/api/sources", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    if (r.ok) loadSources();
  }

  async function searchWayback() {
    if (!wbQuery.trim()) return;
    setWbSearching(true);
    setWbResult(null);
    try {
      const r = await fetch("/api/wayback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: wbQuery.trim(),
          from: wbFrom || undefined,
          to: wbTo || undefined,
          limit: 20,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setWbResult(d);
    } catch {
      setWbResult({ found: 0, ingested: 0, articles: [] });
    } finally {
      setWbSearching(false);
    }
  }

  function update(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  const activeSources = sources.filter((s) => s.is_active);

  return (
    <main className="verity-prose" style={{ maxWidth: 720 }}>
      <h1>{SITE_NAME} Settings</h1>

      {/* ─── NEWS SOURCES ─── */}
      <h2>News Sources</h2>
      <p style={{ margin: "0 0 12px" }}>
        {activeSources.length} active / {sources.length} total. Toggle sources on or off, or add your own.
      </p>

      <div className="sources-grid">
        {sources.map((src) => {
          const feeds: string[] = JSON.parse(src.rss_feed_urls || "[]");
          const isCustom = src.notes?.includes("User-added");
          return (
            <div
              key={src.domain}
              className="source-row"
              style={{ opacity: src.is_active ? 1 : 0.5 }}
            >
              <label className="source-toggle">
                <input
                  type="checkbox"
                  checked={!!src.is_active}
                  onChange={() => toggleSource(src.domain, !src.is_active)}
                />
                <strong>{src.display_name}</strong>
                <span className="source-domain">{src.domain}</span>
              </label>
              <span className="source-meta">
                <span className="source-badge">{src.category}</span>
                <span className="source-badge">{src.bias_rating}</span>
                <span className="source-feeds">{feeds.length} feed{feeds.length !== 1 ? "s" : ""}</span>
                {isCustom && (
                  <button
                    type="button"
                    className="source-delete"
                    onClick={() => deleteSource(src.domain)}
                    title="Remove custom source"
                  >
                    x
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {!showAddSource ? (
        <button
          type="button"
          onClick={() => setShowAddSource(true)}
          className="settings-btn-secondary"
          style={{ marginTop: 12 }}
        >
          + Add Custom Source
        </button>
      ) : (
        <div className="add-source-form">
          <h3>Add Custom Source</h3>
          <label>
            <span>Domain</span>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g., zerohedge.com"
            />
          </label>
          <label>
            <span>Display Name</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., ZeroHedge"
            />
          </label>
          <label>
            <span>Category</span>
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              <option value="wire">Wire</option>
              <option value="us-national">US National</option>
              <option value="international">International</option>
              <option value="business">Business</option>
            </select>
          </label>
          <label>
            <span>RSS Feed URLs (one per line)</span>
            <textarea
              value={newRss}
              onChange={(e) => setNewRss(e.target.value)}
              placeholder={"https://example.com/feed/rss\nhttps://example.com/markets/rss"}
              rows={3}
            />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={addSource} className="settings-btn-primary">
              Add Source
            </button>
            <button type="button" onClick={() => setShowAddSource(false)} className="settings-btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─��─ WAYBACK MACHINE ─── */}
      <h2>Historical Articles (Wayback Machine)</h2>
      <p style={{ margin: "0 0 12px" }}>
        Pull archived articles from a date range. Useful when a current story is a development
        of past events — get the historical context into your database for richer synthesis.
      </p>

      <div className="wayback-form">
        <label>
          <span>Topic / Keywords</span>
          <input
            type="text"
            value={wbQuery}
            onChange={(e) => setWbQuery(e.target.value)}
            placeholder="e.g., fed interest rate, tesla earnings"
          />
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ flex: 1 }}>
            <span>From</span>
            <input
              type="date"
              value={wbFrom}
              onChange={(e) => setWbFrom(e.target.value)}
            />
          </label>
          <label style={{ flex: 1 }}>
            <span>To</span>
            <input
              type="date"
              value={wbTo}
              onChange={(e) => setWbTo(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={searchWayback}
          disabled={wbSearching || !wbQuery.trim()}
          className="settings-btn-primary"
        >
          {wbSearching ? "Searching archive..." : "Search Wayback Machine"}
        </button>

        {wbResult && (
          <div className="wayback-results">
            <p>
              Found <strong>{wbResult.found}</strong> archived articles.
              Ingested <strong>{wbResult.ingested}</strong> new articles into your database.
            </p>
            {wbResult.articles.length > 0 && (
              <ul className="wayback-list">
                {wbResult.articles.map((a, i) => (
                  <li key={i} className={a.stored ? "wayback-new" : "wayback-existing"}>
                    <span className="wayback-domain">{a.domain}</span>
                    <span className="wayback-title">{a.title}</span>
                    {a.stored && <span className="wayback-badge">NEW</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ─── INGESTION ─── */}
      <h2>News Ingestion</h2>
      <p style={{ marginTop: 0 }}>
        Fetch the latest articles from all active RSS sources and store them locally.
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          type="button"
          onClick={runIngest}
          disabled={ingesting}
          className="settings-btn-primary"
        >
          {ingesting ? "Ingesting..." : "Ingest Now"}
        </button>
        {ingestResult && (
          <span style={{ fontSize: 14, color: ingestResult.startsWith("Error") ? "red" : "green" }}>
            {ingestResult}
          </span>
        )}
      </div>

      {/* ─── AUTO-PIPELINE ─── */}
      <h2>Auto-Pipeline</h2>
      <p style={{ margin: "0 0 12px" }}>
        When enabled, Hermes automatically ingests new articles and synthesizes stories
        on a timer. This is the foundation for Plutus — articles are assessed the moment they arrive.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="source-toggle" style={{ fontSize: 16 }}>
          <input
            type="checkbox"
            checked={pipelineEnabled}
            onChange={(e) => savePipelineSettings(e.target.checked, pipelineInterval)}
            disabled={pipelineSaving}
          />
          <strong>Enable auto-pipeline</strong>
        </label>

        <label>
          <span style={{ fontWeight: 600 }}>Interval (minutes)</span>
          <select
            value={pipelineInterval}
            onChange={(e) => savePipelineSettings(pipelineEnabled, parseInt(e.target.value, 10))}
            disabled={pipelineSaving}
            style={{ display: "block", width: "100%", padding: "8px 12px", marginTop: 4 }}
          >
            <option value={2}>Every 2 minutes</option>
            <option value={5}>Every 5 minutes</option>
            <option value={10}>Every 10 minutes</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every hour</option>
          </select>
        </label>

        {pipelineLastRun && (
          <p style={{ fontSize: 13, color: "var(--ink-soft, #666)", margin: 0 }}>
            Last run: {new Date(pipelineLastRun).toLocaleString()}
          </p>
        )}

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="button"
            onClick={runPipelineNow}
            disabled={pipelineRunning}
            className="settings-btn-primary"
          >
            {pipelineRunning ? "Running pipeline..." : "Run Pipeline Now"}
          </button>
        </div>
      </div>

      {/* ─── LLM PROVIDER ─── */}
      <h2>LLM Provider</h2>
      <p>
        All settings stored locally in SQLite. Your API key never leaves your machine.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label>
          <span style={{ fontWeight: 600 }}>Provider</span>
          <select
            value={provider}
            onChange={(e) => update("llm_provider", e.target.value)}
            style={{ display: "block", width: "100%", padding: "8px 12px", marginTop: 4 }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {needsKey && (
          <label>
            <span style={{ fontWeight: 600 }}>API Key</span>
            <input
              type="password"
              value={settings.llm_api_key ?? ""}
              onChange={(e) => update("llm_api_key", e.target.value)}
              placeholder={provider === "openai" ? "sk-..." : "sk-ant-..."}
              style={{ display: "block", width: "100%", padding: "8px 12px", marginTop: 4 }}
            />
            <span style={{ fontSize: 13, color: "var(--ink-soft, #666)" }}>
              Stored locally. Never sent anywhere except the provider&rsquo;s API.
            </span>
          </label>
        )}

        {!needsKey && (
          <label>
            <span style={{ fontWeight: 600 }}>Base URL</span>
            <input
              type="text"
              value={settings.llm_base_url ?? "http://localhost:11434"}
              onChange={(e) => update("llm_base_url", e.target.value)}
              placeholder="http://localhost:11434"
              style={{ display: "block", width: "100%", padding: "8px 12px", marginTop: 4 }}
            />
          </label>
        )}

        <h3>Models</h3>
        <label>
          <span style={{ fontWeight: 600 }}>Synthesis Model</span>
          <input
            type="text"
            value={settings.llm_synth_model ?? ""}
            onChange={(e) => update("llm_synth_model", e.target.value)}
            placeholder="e.g., deepseek-r1-distill-qwen-32b"
            style={{ display: "block", width: "100%", padding: "8px 12px", marginTop: 4 }}
          />
        </label>

        <label>
          <span style={{ fontWeight: 600 }}>Analysis Model</span>
          <input
            type="text"
            value={settings.llm_analyze_model ?? ""}
            onChange={(e) => update("llm_analyze_model", e.target.value)}
            placeholder="e.g., gemma3:4b"
            style={{ display: "block", width: "100%", padding: "8px 12px", marginTop: 4 }}
          />
        </label>

        <label>
          <span style={{ fontWeight: 600 }}>Embedding Model</span>
          <input
            type="text"
            value={settings.llm_embed_model ?? ""}
            onChange={(e) => update("llm_embed_model", e.target.value)}
            placeholder="e.g., nomic-embed-text"
            style={{ display: "block", width: "100%", padding: "8px 12px", marginTop: 4 }}
          />
        </label>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="settings-btn-primary"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && <span style={{ color: "green" }}>Saved</span>}
          {error && <span style={{ color: "red" }}>{error}</span>}
        </div>
      </div>
    </main>
  );
}
