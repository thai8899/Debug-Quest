// Layered case-file backdrop: aurora glows, blueprint grid, ghosted code listing
// drifting at the edges, off-screen radar rings, perspective floor, film grain, one scan line.
const GHOST = `01  export async function loadTodos(userId: string) {
02    const rows = await db.todos.find({ userId });
03    for (let i = 0; i <= rows.length; i++) {
04      const t = rows[i];
05      log.info("todo", t.id, t.title);
06    }
07    return rows.map(normalize);
08  }
09
10  function normalize(t: Todo) {
11    return { ...t, title: t.title.trim() };
12  }
13
14  export function parsePort(v?: string) {
15    const n = parseInt(v);
16    if (n > 0) return n;
17    return 3000;
18  }
19
20  const cache = new Map<string, Todo[]>();
21  cache.set(key, fetchTodos(key));
22  await save(cache.get(key));
23
24  router.post("/todos", async (req, res) => {
25    const { title } = req.body;
26    const todo = await create(title.trim());
27    res.status(201).json(todo);
28  });
29
30  export const retry = (fn, n = 3) =>
31    fn().catch((e) => (n > 0 ? retry(fn, n - 1) : e));`;

const DIFF: Record<number, string> = { 3: "#FF5A36", 5: "#FF5A36", 15: "#FF5A36", 21: "#FF5A36", 26: "#F0A04B", 31: "#F0A04B" };

function Ghost({ side }: { side: "l" | "r" }) {
  const lines = GHOST.split("\n");
  const shifted = side === "r" ? [...lines.slice(11), ...lines.slice(0, 11)] : lines;
  return (
    <div className={`ghost ghost-${side} absolute top-0 ${side === "l" ? "left-0" : "right-0"} h-[200%] w-[34vw] min-w-[300px]`}>
      <pre className="m-0 font-mono text-[12.5px] leading-[1.9] whitespace-pre text-[#9fb4d8]">
        {[...shifted, ...shifted].map((l, i) => {
          const n = parseInt(l.slice(0, 2), 10);
          const hot = DIFF[n];
          return <div key={i} style={hot ? { color: hot, opacity: 0.95, textShadow: `0 0 14px ${hot}55` } : undefined}>{l}</div>;
        })}
      </pre>
    </div>
  );
}

// Real 3D extruded glyph: stacked copies pushed back in Z, spinning slowly.
function Glyph3D({ text, size, color, deep, className, delay = 0 }: { text: string; size: number; color: string; deep: string; className: string; delay?: number }) {
  const layers = Array.from({ length: 9 }, (_, i) => i);
  return (
    <div className={`absolute ${className}`} style={{ width: size * text.length * 0.62, height: size }}>
      <div className="bob h-full w-full" style={{ animationDelay: `${delay}s` }}><div className="cube-scene h-full w-full"><div className="glyph-spin h-full w-full" style={{ animationDelay: `${delay}s` }}>
        {layers.map((i) => (
          <span key={i} className="absolute inset-0 flex items-center justify-center font-mono font-bold leading-none"
            style={{ fontSize: size, transform: `translateZ(${-i * 3 + 12}px)`, color: i === 0 ? color : deep, opacity: i === 0 ? 0.95 : 0.9, textShadow: i === 0 ? `0 0 26px ${color}88` : "none" }}>{text}</span>
        ))}
      </div></div></div>
    </div>
  );
}

const T = { k: "#c792ff", f: "#7cb7ff", s: "#8ee36a", n: "#ffb347", c: "#8fa0cf", p: "#e6ecff" };
type Tok = [keyof typeof T, string];
const SNIPPET: { bug?: boolean; toks: Tok[] }[] = [
  { toks: [["k", "function "], ["f", "getPage"], ["p", "(todos, page) {"]] },
  { toks: [["c", "  // pages start at 1"]] },
  { bug: true, toks: [["k", "  const "], ["p", "start = page * "], ["n", "10"], ["p", ";"]] },
  { toks: [["k", "  return "], ["p", "todos."], ["f", "slice"], ["p", "(start, start + "], ["n", "10"], ["p", ");"]] },
  { toks: [["p", "}"]] },
  { toks: [["k", "const "], ["p", "ok = "], ["s", "\"fixed\""], ["p", ";"]] },
];

// A floating, tilted editor window with one flagged line. Sits at the edges, never behind content.
function CodeWindow({ w, className, tilt, delay = 0 }: { w: number; className: string; tilt: string; delay?: number }) {
  const fs = Math.round(w / 21);
  return (
    <div className={`absolute ${className}`} style={{ width: w }}>
      <div className="bob" style={{ animationDelay: `${delay}s` }}><div className="cube-scene">
        <div className="codewin" style={{ transform: tilt, fontSize: fs }}>
          <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: "rgba(255,255,255,.08)" }}>
            <i className="h-2 w-2 rounded-full" style={{ background: "#ff6b4a" }} /><i className="h-2 w-2 rounded-full" style={{ background: "#ffc94d" }} /><i className="h-2 w-2 rounded-full" style={{ background: "#38e8c6" }} />
            <span className="ml-2 font-mono opacity-60" style={{ fontSize: fs * 0.9 }}>todos.ts</span>
          </div>
          <pre className="m-0 px-3 py-2 font-mono leading-[1.7]" style={{ whiteSpace: "pre" }}>
            {SNIPPET.map((l, i) => (
              <div key={i} style={l.bug ? { background: "rgba(255,107,74,.28)", boxShadow: "inset 3px 0 0 #ff6b4a", margin: "0 -12px", padding: "0 12px" } : undefined}>
                {l.toks.map(([k, t], j) => <span key={j} style={{ color: T[k] }}>{t}</span>)}
              </div>
            ))}
          </pre>
        </div>
      </div></div>
    </div>
  );
}

export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#121a52]">
      {/* aurora glows */}
      <div className="absolute inset-0" style={{ background:
        "radial-gradient(900px 560px at 12% -6%, rgba(255,201,77,.30), transparent 62%)," +
        "radial-gradient(700px 520px at 48% 6%, rgba(167,125,255,.34), transparent 64%)," +
        "radial-gradient(820px 620px at 96% 18%, rgba(56,232,198,.26), transparent 64%)," +
        "radial-gradient(900px 700px at 70% 112%, rgba(124,183,255,.30), transparent 62%)," +
        "radial-gradient(700px 480px at 4% 96%, rgba(255,120,190,.24), transparent 65%)," +
        "linear-gradient(180deg,#151f66 0%,#1b2f8c 52%,#1d4f9a 100%)" }} />
      {/* blueprint grid, fine + major */}
      <div className="blueprint absolute inset-0" />
      {/* ghosted code listing at the edges */}
      <div className="ghost-wrap absolute inset-0">
        <Ghost side="l" />
        <Ghost side="r" />
      </div>
      {/* radar / seal rings, partly off-screen */}
      <svg className="rings absolute -right-[18vmin] -top-[22vmin] h-[88vmin] w-[88vmin]" viewBox="-100 -100 200 200" fill="none">
        {[96, 78, 60, 42, 24].map((r, i) => (
          <circle key={r} r={r} stroke="#D6B25E" strokeOpacity={0.16 - i * 0.02} strokeWidth=".35" strokeDasharray={i % 2 ? "1.2 2.4" : undefined} />
        ))}
        {Array.from({ length: 36 }).map((_, i) => (
          <line key={i} x1="0" y1="-96" x2="0" y2={i % 3 ? "-92.5" : "-89"} stroke="#D6B25E" strokeOpacity=".28" strokeWidth=".4" transform={`rotate(${i * 10})`} />
        ))}
        <line x1="0" y1="0" x2="0" y2="-96" stroke="#D6B25E" strokeOpacity=".35" strokeWidth=".5" className="sweep" />
        <path d="M-100 0H100M0 -100V100" stroke="#D6B25E" strokeOpacity=".08" strokeWidth=".3" />
      </svg>
      <svg className="rings absolute -bottom-[26vmin] -left-[20vmin] h-[70vmin] w-[70vmin]" viewBox="-100 -100 200 200" fill="none">
        {[96, 74, 52, 30].map((r, i) => (
          <circle key={r} r={r} stroke="#4FD1C5" strokeOpacity={0.12 - i * 0.015} strokeWidth=".35" strokeDasharray={i % 2 ? undefined : "1.2 2.4"} />
        ))}
      </svg>
      <CodeWindow w={300} tilt="rotateY(24deg) rotateX(7deg) rotateZ(-2deg)" className="left-[1.5%] top-[60%] hidden 2xl:block" />
      <CodeWindow w={250} tilt="rotateY(-26deg) rotateX(6deg) rotateZ(2deg)" className="right-[2%] top-[54%] hidden 2xl:block" delay={2} />
      <Glyph3D text="{ }" size={84} color="#ffc94d" deep="#9a6a10" className="left-[6%] top-[36%] hidden md:block" />
      <Glyph3D text="</>" size={70} color="#38e8c6" deep="#0d7a6b" className="right-[7%] top-[30%] hidden md:block" delay={1.5} />
      <Glyph3D text="=>" size={64} color="#ff7abe" deep="#992b66" className="left-[44%] top-[2%] hidden md:block" delay={3} />
      <Glyph3D text=";" size={90} color="#b79bff" deep="#5a3fb0" className="bottom-[6%] right-[26%]" delay={1} />
      <Glyph3D text=">_" size={60} color="#7cb7ff" deep="#2f5fa8" className="left-[19%] top-[17%] hidden md:block" delay={2.5} />
      <div className="grid-floor absolute inset-x-[-30%] bottom-0 h-[55vh]" />
      <div className="scanline absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-accent/50 to-transparent" />
      <div className="grain absolute inset-0" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(5,10,50,.42) 100%)" }} />
    </div>
  );
}
