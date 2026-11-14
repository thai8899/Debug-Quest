// Fixed, layered "code canyon at dusk" scene. Pure CSS/SVG, deterministic so SSR and client match.
function rng(seed: number) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); }

export default function Backdrop() {
  const r = rng(7);
  const stars = Array.from({ length: 70 }, () => ({ x: r() * 100, y: r() * 62, s: 1 + r() * 2, d: r() * 4, o: 0.35 + r() * 0.65 }));
  const glyphs = [
    { t: "{ }", x: 8, d: 0, s: 22 }, { t: "=>", x: 24, d: 4, s: 18 }, { t: "</>", x: 41, d: 9, s: 24 },
    { t: ";", x: 58, d: 2, s: 28 }, { t: "[ ]", x: 73, d: 7, s: 20 }, { t: "0 1", x: 90, d: 5, s: 18 },
  ];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ background: "linear-gradient(180deg,#0c0828 0%,#1d1052 38%,#4a1f7a 66%,#c4466f 88%,#ff9a5a 100%)" }}>
      {stars.map((s, i) => (
        <span key={i} className="twinkle absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o, animationDelay: `${s.d}s` }} />
      ))}
      <div className="absolute right-[2.5%] top-[14%] h-14 w-14 rounded-full bg-[#fff4d6]"
        style={{ boxShadow: "0 0 40px 14px rgba(255,236,179,.3), inset -7px -4px 0 rgba(255,200,120,.35)" }} />
      {glyphs.map((g, i) => (
        <span key={i} className="floaty absolute bottom-0 font-mono font-bold text-white/15"
          style={{ left: `${g.x}%`, fontSize: g.s, animationDelay: `${g.d}s` }}>{g.t}</span>
      ))}
      <svg className="absolute bottom-0 h-[30vh] w-full" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <path d="M0 170 Q180 90 360 150 T720 120 T1080 160 T1440 110 V300 H0Z" fill="#5a2a86" opacity=".75" />
        <path d="M0 215 Q220 150 440 205 T900 185 T1440 200 V300 H0Z" fill="#3a1b66" opacity=".9" />
        <path d="M0 260 Q300 215 620 255 T1440 240 V300 H0Z" fill="#1d1050" />
      </svg>
    </div>
  );
}
