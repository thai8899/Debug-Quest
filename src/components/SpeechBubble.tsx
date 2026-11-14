"use client";
import { motion } from "framer-motion";

export default function SpeechBubble({ children }: { children: React.ReactNode }) {
  return (
    <motion.div key={String(children)} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className="relative rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#2a1f5e] shadow-[0_4px_0_rgba(0,0,0,.3)]">
      <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 bg-white" />
      <span className="relative">{children}</span>
    </motion.div>
  );
}
