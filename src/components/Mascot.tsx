"use client";
import { motion } from "framer-motion";

// The warden: a faceted brass lion emblem. Mood shows as a glow, not a cartoon expression.
const GLOW = {
  idle: "drop-shadow(0 0 6px rgba(214,178,94,.35))",
  run: "drop-shadow(0 0 12px rgba(214,178,94,.8))",
  happy: "drop-shadow(0 0 14px rgba(79,209,197,.85))",
  sad: "drop-shadow(0 0 12px rgba(255,90,54,.75))",
} as const;

export default function Mascot({ size = 64, mood = "idle" }: { size?: number; mood?: keyof typeof GLOW }) {
  const eye = mood === "sad" ? "#ff5a36" : mood === "happy" ? "#4fd1c5" : "#1a1203";
  return (
    <motion.svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Brass lion emblem"
      style={{ filter: GLOW[mood] }}
      animate={mood === "run" ? { opacity: [1, 0.75, 1] } : { opacity: 1 }}
      transition={{ repeat: mood === "run" ? Infinity : 0, duration: 0.7 }}>
      <polygon fill="#8a6a2b" points="32,2 40,8 48,5 52,15 60,18 57,28 62,37 55,45 54,57 44,53 36,62 32,58 28,62 20,53 10,57 9,45 2,37 7,28 4,18 12,15 16,5 24,8" />
      <polygon fill="#c9a24b" points="32,9 38,14 46,13 48,22 54,27 52,35 56,42 49,47 46,53 39,50 32,55 25,50 18,53 15,47 8,42 12,35 10,27 16,22 18,13 26,14" />
      <polygon fill="#e7cb86" points="32,16 42,20 47,30 45,42 38,52 32,55 26,52 19,42 17,30 22,20" />
      <polygon fill="rgba(0,0,0,.14)" points="32,16 42,20 47,30 45,42 38,52 32,55" />
      <polygon fill={eye} points="21,29 29,31 28,35 21,33" />
      <polygon fill={eye} points="43,29 35,31 36,35 43,33" />
      <polygon fill="#3a2a0e" points="29,38 35,38 32,44" />
      <path d="M32 44 V48 M26 50 Q32 53 38 50" stroke="#3a2a0e" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </motion.svg>
  );
}
