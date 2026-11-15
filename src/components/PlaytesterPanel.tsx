"use client";

import { useEffect, useRef, useState } from "react";
import type { ScanPlaytest } from "@/lib/types";

const panel: React.CSSProperties = {
  background: "#1a1b34",
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
};

const feedBox: React.CSSProperties = {
  maxHeight: 220,
  overflowY: "auto",
  background: "#14152b",
  borderRadius: 8,
  padding: 10,
  fontSize: 13,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

function LiveView({ url, live }: { url: string; live: boolean }) {
  const [failed, setFailed] = useState(false);
  const showIframe = live && !failed;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>Live view</div>
      {showIframe ? (
        <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden", background: "#0d0e1a" }}>
          <iframe
            src={url}
            title="TinyFish live browser"
            onError={() => setFailed(true)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, borderRadius: 12 }}
            allow="autoplay; clipboard-read; clipboard-write"
          />
        </div>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" style={{ color: "#a29bfe", fontSize: 14 }}>
          Watch live
        </a>
      )}
    </div>
  );
}

function StepReplay({ steps }: { steps: NonNullable<ScanPlaytest["steps"]> }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const step = steps[idx];

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setIdx((i) => {
        if (i >= steps.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1800);
    return () => clearInterval(t);
  }, [playing, steps.length]);

  if (!step) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
        Screenshot replay · {idx + 1}/{steps.length}
      </div>
      <div style={{ borderRadius: 12, overflow: "hidden", background: "#0d0e1a", aspectRatio: "16 / 9" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={step.imageSrc} alt={step.purpose} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.85 }}>{step.purpose}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" onClick={() => { setPlaying(false); setIdx((i) => Math.max(0, i - 1)); }}
          style={btnStyle} disabled={idx === 0}>Prev</button>
        <button type="button" onClick={() => setPlaying((p) => !p)} style={btnStyle}>
          {playing ? "Pause" : "Autoplay"}
        </button>
        <button type="button" onClick={() => { setPlaying(false); setIdx((i) => Math.min(steps.length - 1, i + 1)); }}
          style={btnStyle} disabled={idx >= steps.length - 1}>Next</button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid #444",
  background: "#14152b",
  color: "inherit",
  cursor: "pointer",
  fontSize: 13,
};

export function PlaytesterPanel({ playtest }: { playtest: ScanPlaytest }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const progress = playtest.events.filter((e) => e.type === "PROGRESS" && e.purpose);
  const running = playtest.status === "running";
  const ended = playtest.status !== "running";

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [progress.length]);

  return (
    <div style={panel}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <b>🤖 Playtester</b>
        <span style={{ fontSize: 12, opacity: 0.7 }}>{playtest.status}</span>
      </div>

      {running && (
        <p style={{ margin: "10px 0 6px", fontSize: 14, color: "#a29bfe" }}>
          <span className="playtest-pulse" style={{ display: "inline-block" }}>●</span>
          {" "}Agent is testing your app…
          <style>{`
            @keyframes playtestPulse { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }
            .playtest-pulse { animation: playtestPulse 1.2s ease-in-out infinite; color: #6c5ce7; }
          `}</style>
        </p>
      )}

      {progress.length > 0 && (
        <div ref={feedRef} style={feedBox}>
          {progress.map((e, i) => (
            <div key={`${e.at}-${i}`} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
              <span style={{ opacity: 0.45, flexShrink: 0 }}>{formatTime(e.at)}</span>
              <span>{e.purpose}</span>
            </div>
          ))}
        </div>
      )}

      {playtest.streamingUrl && (
        <LiveView url={playtest.streamingUrl} live={running && !ended} />
      )}

      {playtest.steps && playtest.steps.length > 0 && (
        <StepReplay steps={playtest.steps} />
      )}

      {ended && playtest.findings.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>
            Findings ({playtest.findings.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {playtest.findings.map((f, i) => (
              <div
                key={i}
                id={`finding-${i}`}
                style={{
                  background: "#14152b",
                  borderRadius: 10,
                  padding: 12,
                  border: "1px solid #2a2b4a",
                  scrollMarginTop: 80,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 4 }}>#{i} · {f.page || "page"}</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{f.action}</div>
                <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
                  <div><span style={{ color: "#55efc4" }}>expected</span> · {f.expected}</div>
                  <div><span style={{ color: "#ff7675" }}>actual</span> · {f.actual}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ended && playtest.notes && !playtest.findings.length && (
        <p style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>{playtest.notes}</p>
      )}

      {playtest.reason && (playtest.status === "skipped" || playtest.status === "error") && (
        <p style={{ marginTop: 10, color: "#ff7675", fontSize: 13 }}>{playtest.reason}</p>
      )}
    </div>
  );
}
