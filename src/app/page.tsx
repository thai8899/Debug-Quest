"use client";
import { useEffect, useState } from "react";
import type { Scan } from "@/lib/types";
import { PlaytesterPanel } from "@/components/PlaytesterPanel";

export default function Home() {
  const [url, setUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [scan, setScan] = useState<Scan | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("scan");
    if (!id) return;
    void (async () => {
      const r = await fetch(`/api/scans/${id}`);
      if (r.ok) setScan(await r.json());
    })();
  }, []);

  async function start() {
    setErr("");
    const r = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoUrl: url,
        ...(liveUrl.trim() ? { liveUrl: liveUrl.trim() } : {}),
      }),
    });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    setScan(j);
    const u = new URL(window.location.href);
    u.searchParams.set("scan", j.id);
    window.history.replaceState({}, "", u);
  }

  useEffect(() => {
    if (!scan || scan.status !== "running") return;
    const t = setInterval(async () => setScan(await (await fetch(`/api/scans/${scan.id}`)).json()), 1500);
    return () => clearInterval(t);
  }, [scan]);

  const card = { background: "#1a1b34", borderRadius: 12, padding: 16, marginTop: 16 } as const;
  const applied = scan?.bugs.filter((b) => b.applied) ?? [];

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      <h1>Debug Quest</h1>
      <p style={{ opacity: 0.7 }}>Your AI did the work. Now earn it.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo"
            style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #444", background: "#14152b", color: "inherit" }} />
          <button onClick={start} style={{ padding: "12px 20px", borderRadius: 8, border: 0, background: "#6c5ce7", color: "white", cursor: "pointer" }}>Scan</button>
        </div>
        <input
          value={liveUrl}
          onChange={(e) => setLiveUrl(e.target.value)}
          placeholder="Live app URL (optional)"
          style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1px solid #444", background: "#14152b", color: "inherit" }}
        />
      </div>
      {err && <p style={{ color: "#ff7675" }}>{err}</p>}
      {scan && (
        <>
          <div style={card}>
            <b>{scan.owner}/{scan.repo}</b> · {scan.status === "running" ? "⏳ " : ""}{scan.step}
            {scan.error && scan.status === "error" && <p style={{ color: "#ff7675" }}>{scan.error}</p>}
            {scan.testsBefore?.ran && scan.testsAfter?.ran && (
              <p>Tests: <b>{scan.testsBefore.failing} failing → {scan.testsAfter.failing} failing</b></p>
            )}
          </div>

          {scan.playtest && <PlaytesterPanel playtest={scan.playtest} />}

          {scan.status === "done" && (
            <div style={card}>
              <p>🔒 {applied.length} bug(s) found and fixed on a new branch. Fix is locked.</p>
              <ul style={{ listStyle: "none", padding: 0, margin: "12px 0", display: "flex", flexDirection: "column", gap: 10 }}>
                {applied.map((b) => (
                  <li
                    key={b.id}
                    style={{
                      background: "#14152b",
                      borderRadius: 10,
                      padding: 12,
                      border: "1px solid #2a2b4a",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span>{b.bugType} in <code>{b.file}</code></span>
                      {typeof b.findingIndex === "number" &&
                        scan.playtest?.findings?.[b.findingIndex] != null && (
                        <a
                          href={`#finding-${b.findingIndex}`}
                          style={{
                            fontSize: 12,
                            textDecoration: "none",
                            background: "#2d2a55",
                            color: "#a29bfe",
                            borderRadius: 999,
                            padding: "3px 10px",
                          }}
                        >
                          🤖 Found by Playtester
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {scan.dryRun || !scan.prUrl ? (
                <p style={{ color: "#ffeaa7", margin: 0 }}>Dry run: PR skipped</p>
              ) : (
                <a href={scan.prUrl} target="_blank" style={{ color: "#a29bfe" }}>View pull request (main untouched)</a>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
