// Original bug-bot: a glitchy beetle with a hex shell and coral eyes. "caught" turns it cyan and still.
export default function BugBot({ size = 56, state = "idle" }: { size?: number; state?: "idle" | "caught" | "hurt" }) {
  const body = state === "caught" ? "#4FD1C5" : "#FF5A36";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={state === "idle" ? "bot-wiggle" : ""}
      style={{ filter: `drop-shadow(0 0 10px ${body}99)`, opacity: state === "hurt" ? 0.5 : 1 }}>
      <g stroke={body} strokeWidth="2.2" strokeLinecap="round" opacity=".85">
        <path d="M18 24 L8 16 M18 34 L6 34 M18 44 L8 52 M46 24 L56 16 M46 34 L58 34 M46 44 L56 52" />
        <path d="M27 14 L22 6 M37 14 L42 6" />
      </g>
      <path d="M32 10 L48 19 L48 45 L32 56 L16 45 L16 19 Z" fill="#0b1226" stroke={body} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 10 L32 56 M16 19 L48 45 M48 19 L16 45" stroke={body} strokeOpacity=".28" strokeWidth="1.4" />
      <path d="M32 18 L42 24 L42 40 L32 46 L22 40 L22 24 Z" fill={state === "caught" ? "#4FD1C5" : "#F472B6"} fillOpacity=".3" stroke={body} strokeOpacity=".6" strokeWidth="1.2" />
      <circle cx="26" cy="22" r="3.2" fill={state === "caught" ? "#fff" : "#FFD23F"} /><circle cx="38" cy="22" r="3.2" fill={state === "caught" ? "#fff" : "#FFD23F"} />
      <circle cx="26" cy="22" r="1.1" fill="#070b16" /><circle cx="38" cy="22" r="1.1" fill="#070b16" />
    </svg>
  );
}
