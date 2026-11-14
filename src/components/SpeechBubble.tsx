// The warden's status line: terse, console-style, not a cartoon bubble.
export default function SpeechBubble({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="border-l-2 border-accent bg-panel px-4 py-2 font-mono text-sm text-[#ede8dc]/90">
      <span className="mr-2 text-accent">warden</span>
      {children}
    </div>
  );
}
