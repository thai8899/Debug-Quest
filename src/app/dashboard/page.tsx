"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, LockOpen, Bug, FlaskConical } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type Stats = {
  xpTotal: number;
  level: number;
  xpSeries: { bucket: string; xp_sum: number }[];
  passRate: { bug_category: string; pass_rate: number }[];
  weakCategories: string[];
  bugsFixedTotal: number;
  testsFixedTotal: number;
};

const LOCKED_TILES = [
  "Tutor",
  "Canvas reminders",
  "Research",
  "Trip planner",
  "Vocabulary",
  "Curiosity feed",
  "Daily recap",
  "Idea bot",
  "Project helper",
  "Diet & routine",
] as const;

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats?userId=demo")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Stats API responded with ${res.status}`);
        return res.json();
      })
      .then((data: Stats) => setStats(data))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
        <p className="font-pixel text-[10px] text-sev-high">Failed to load dashboard: {error}</p>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
        <p className="font-pixel text-xs text-accent">LOADING STATS...</p>
      </main>
    );
  }

  const xpTotal = stats.xpTotal ?? 0;
  const level = stats.level ?? 1;
  const xpIntoLevel = xpTotal % 200;
  const xpProgress = xpIntoLevel / 200;
  const xpSeries = stats.xpSeries ?? [];
  const passRate = stats.passRate ?? [];
  const weakCategories = stats.weakCategories ?? [];
  const bugsFixedTotal = stats.bugsFixedTotal ?? 0;
  const testsFixedTotal = stats.testsFixedTotal ?? 0;

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-pixel text-lg text-accent">DEBUG QUEST</h1>
          <p className="mt-2 text-sm opacity-60">Dashboard · demo data is seeded</p>
        </div>
        <Link href="/" className="text-sm text-sev-low hover:underline">
          ← Back to scan
        </Link>
      </div>

      {/* Top row: level, XP + progress, bugs fixed, tests fixed */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border-2 border-accent bg-panel p-5">
          <div className="font-pixel text-[9px] text-accent">LEVEL</div>
          <div className="mt-3 font-pixel text-3xl text-accent">LVL {level}</div>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="font-pixel text-[9px] opacity-60">TOTAL XP</div>
          <div className="mt-2 text-3xl font-bold">{xpTotal}</div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.min(100, xpProgress * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs opacity-50">
            {xpIntoLevel} / 200 XP to level {level + 1}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center gap-2 font-pixel text-[9px] opacity-60">
            <Bug size={12} /> BUGS FIXED
          </div>
          <div className="mt-3 text-4xl font-bold text-sev-low">{bugsFixedTotal}</div>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center gap-2 font-pixel text-[9px] opacity-60">
            <FlaskConical size={12} /> TESTS FIXED
          </div>
          <div className="mt-3 text-4xl font-bold text-accent">{testsFixedTotal}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-xl border border-line bg-panel p-5">
          <h3 className="mb-4 font-pixel text-[10px] text-accent">XP OVER TIME</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={xpSeries}>
              <XAxis
                dataKey="bucket"
                tickFormatter={(tick) =>
                  new Date(tick).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }
                stroke="#2a2a55"
                tick={{ fill: "#8a8ab0", fontSize: 11 }}
              />
              <YAxis stroke="#2a2a55" tick={{ fill: "#8a8ab0", fontSize: 11 }} width={36} />
              <Tooltip
                contentStyle={{ backgroundColor: "#151530", border: "1px solid #2a2a55", borderRadius: 8 }}
                labelStyle={{ color: "#00e5a0" }}
                labelFormatter={(label) => new Date(String(label)).toLocaleString()}
              />
              <Line type="monotone" dataKey="xp_sum" stroke="#00e5a0" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="h-80 rounded-xl border border-line bg-panel p-5">
          <h3 className="mb-4 font-pixel text-[10px] text-accent">YOUR TRAINING FOCUS</h3>
          <p className="mb-2 text-xs opacity-50">Pass rate by bug category · weakest highlighted</p>
          <ResponsiveContainer width="100%" height="75%">
            <BarChart data={passRate}>
              <XAxis
                dataKey="bug_category"
                stroke="#2a2a55"
                tick={{ fill: "#8a8ab0", fontSize: 10 }}
              />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                stroke="#2a2a55"
                tick={{ fill: "#8a8ab0", fontSize: 11 }}
                width={40}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#151530", border: "1px solid #2a2a55", borderRadius: 8 }}
                formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "pass rate"]}
              />
              <Bar dataKey="pass_rate" radius={[4, 4, 0, 0]}>
                {passRate.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={weakCategories.includes(entry.bug_category) ? "#ff5d73" : "#00e5a0"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Assistants */}
      <section>
        <h2 className="mb-4 font-pixel text-xs">YOUR ASSISTANTS</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Link
            href="/scan/demo"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-accent bg-accent/10 p-6 text-center transition hover:bg-accent/20"
          >
            <LockOpen className="text-accent" size={28} />
            <h3 className="font-pixel text-[10px] leading-4 text-accent">Code Debugger</h3>
            <p className="text-xs text-accent/70">Unlocked</p>
          </Link>

          {LOCKED_TILES.map((tile, i) => (
            <div
              key={tile}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-panel/60 p-6 text-center opacity-45"
            >
              <Lock className="text-sev-medium" size={24} />
              <h3 className="font-pixel text-[9px] leading-4 text-gray-400">{tile}</h3>
              <p className="text-xs opacity-60">Unlocks at Level {i + 3}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
