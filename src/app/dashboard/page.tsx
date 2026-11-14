"use client";

import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stats?userId=demo')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Stats API responded with ${res.status}`);
        return res.json();
      })
      .then(data => setStats(data))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="min-h-screen bg-gray-950 text-red-400 flex items-center justify-center">Failed to load dashboard: {error}</div>;
  if (!stats) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading...</div>;

  const xpTotal = stats.xpTotal ?? 0;
  const level = stats.level ?? 1;
  const xpSeries = stats.xpSeries ?? [];
  const passRate = stats.passRate ?? [];
  const weakCategories = stats.weakCategories ?? [];
  const testsFixedTotal = stats.testsFixedTotal ?? 0;
  const xpProgress = (xpTotal % 200) / 200;
  
  const lockedTiles = [
    'Tutor', 'Canvas reminders', 'Research', 'Trip planner', 'Vocabulary', 
    'Curiosity feed', 'Daily recap', 'Idea bot', 'Project helper', 'Diet & routine'
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Row: Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-gray-400 text-sm">Current Level</h3>
            <p className="text-4xl font-bold text-blue-400 mt-2">Lvl {level}</p>
          </div>
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-gray-400 text-sm">Total XP</h3>
            <p className="text-3xl font-bold mt-2">{xpTotal}</p>
            <div className="w-full bg-gray-800 h-2 mt-3 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${xpProgress * 100}%` }}></div>
            </div>
          </div>
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-gray-400 text-sm">Tests Fixed</h3>
            <p className="text-4xl font-bold text-green-400 mt-2">{testsFixedTotal}</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 h-80">
            <h3 className="text-gray-400 text-sm mb-4">XP Last 24 Hours</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={xpSeries}>
                <XAxis dataKey="bucket" tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} stroke="#4B5563" />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none' }} />
                <Line type="monotone" dataKey="xp_sum" stroke="#3B82F6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 h-80">
            <h3 className="text-gray-400 text-sm mb-4">Your Training Focus (Pass Rate)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={passRate}>
                <XAxis dataKey="bug_category" stroke="#4B5563" />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none' }} />
                <Bar dataKey="pass_rate" radius={[4, 4, 0, 0]}>
                  {passRate.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={weakCategories.includes(entry.bug_category) ? '#EF4444' : '#10B981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Assistants Grid */}
        <h2 className="text-xl font-bold mt-12 mb-4">Your Assistants</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/scan" className="bg-blue-900/20 border border-blue-500/50 p-6 rounded-xl hover:bg-blue-900/40 transition-colors flex flex-col items-center justify-center text-center cursor-pointer">
            <span className="text-3xl mb-2">🐛</span>
            <h3 className="font-bold text-blue-300">Code Debugger</h3>
            <p className="text-xs text-blue-400/70 mt-2">Unlocked</p>
          </Link>
          
          {lockedTiles.map((tile, i) => (
            <div key={tile} className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl flex flex-col items-center justify-center text-center opacity-50">
              <span className="text-2xl mb-2">🔒</span>
              <h3 className="font-bold text-gray-500">{tile}</h3>
              <p className="text-xs text-gray-600 mt-2">Unlocks at Level {i + 3}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}