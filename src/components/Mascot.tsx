"use client";
import { motion } from "framer-motion";

// Original mascot "Bit": a little bug-catching bot. Moods change the mouth and bounce.
export default function Mascot({ size = 48, mood = "idle" }: { size?: number; mood?: "idle" | "run" | "happy" | "sad" }) {
  const mouth = mood === "sad" ? "M18 34 Q24 30 30 34" : mood === "happy" || mood === "run" ? "M17 31 Q24 39 31 31" : "M19 33 H29";
  return (
    <motion.svg width={size} height={size} viewBox="0 0 48 48" aria-label="Bit the bug-catching bot"
      animate={mood === "run" ? { y: [0, -4, 0] } : mood === "happy" ? { rotate: [0, -8, 8, 0] } : { y: [0, -1.5, 0] }}
      transition={{ repeat: Infinity, duration: mood === "run" ? 0.3 : 1.6 }}>
      <line x1="16" y1="8" x2="12" y2="2" stroke="#00e5a0" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="8" x2="36" y2="2" stroke="#00e5a0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="2" r="2.5" fill="#ffb84d" />
      <circle cx="36" cy="2" r="2.5" fill="#ffb84d" />
      <rect x="6" y="8" width="36" height="32" rx="12" fill="#00e5a0" />
      <rect x="11" y="14" width="26" height="14" rx="7" fill="#0b0b1a" />
      <circle cx="19" cy="21" r="3" fill="#e8fff6" />
      <circle cx="29" cy="21" r="3" fill="#e8fff6" />
      <path d={mouth} stroke="#0b0b1a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="12" y="40" width="8" height="5" rx="2" fill="#00b27a" />
      <rect x="28" y="40" width="8" height="5" rx="2" fill="#00b27a" />
    </motion.svg>
  );
}
