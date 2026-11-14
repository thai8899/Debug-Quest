"use client";
import { motion } from "framer-motion";

// Original mascot "Roary" the lion. Moods change the mouth and the bounce.
export default function Mascot({ size = 64, mood = "idle" }: { size?: number; mood?: "idle" | "run" | "happy" | "sad" }) {
  const mane = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((a) => {
    const r = (a * Math.PI) / 180;
    return { x: 32 + Math.cos(r) * 21, y: 33 + Math.sin(r) * 21 };
  });
  const mouth =
    mood === "sad" ? "M26 46 Q32 41 38 46"
    : mood === "happy" || mood === "run" ? "M25 42 Q32 52 39 42 Z"
    : "M27 43 Q32 48 37 43";
  return (
    <motion.svg width={size} height={size} viewBox="0 0 64 64" aria-label="Roary the lion"
      animate={mood === "run" ? { y: [0, -5, 0] } : mood === "happy" ? { rotate: [0, -8, 8, 0] } : { y: [0, -2, 0] }}
      transition={{ repeat: Infinity, duration: mood === "run" ? 0.3 : 1.8 }}>
      {mane.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="9" fill={i % 2 ? "#ff8a1f" : "#f26a00"} />)}
      <circle cx="32" cy="33" r="20" fill="#ff8a1f" />
      <circle cx="19" cy="20" r="6.5" fill="#ffd166" /><circle cx="19" cy="20" r="3" fill="#ff9aa2" />
      <circle cx="45" cy="20" r="6.5" fill="#ffd166" /><circle cx="45" cy="20" r="3" fill="#ff9aa2" />
      <circle cx="32" cy="34" r="16" fill="#ffd166" />
      <ellipse cx="32" cy="42" rx="9" ry="6.5" fill="#fff3cf" />
      <circle cx="25" cy="31" r="3.4" fill="#2b1b0f" /><circle cx="39" cy="31" r="3.4" fill="#2b1b0f" />
      <circle cx="26.2" cy="29.8" r="1.1" fill="#fff" /><circle cx="40.2" cy="29.8" r="1.1" fill="#fff" />
      <circle cx="20" cy="38" r="3" fill="#ff9aa2" opacity=".7" /><circle cx="44" cy="38" r="3" fill="#ff9aa2" opacity=".7" />
      <path d="M29 38 H35 L32 42 Z" fill="#c2410c" />
      <path d={mouth} stroke="#7a2e0e" strokeWidth="2" fill={mood === "happy" || mood === "run" ? "#7a2e0e" : "none"} strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  );
}
