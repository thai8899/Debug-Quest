// Quiet backdrop: ink gradient, brass glow, perspective floor grid, one slow scan line.
export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ background: "radial-gradient(1100px 520px at 50% -8%, rgba(214,178,94,.13), transparent 62%), linear-gradient(180deg,#070b16 0%,#0a1124 60%,#0d1630 100%)" }}>
      <div className="grid-floor absolute inset-x-[-30%] bottom-0 h-[60vh]" />
      <div className="scanline absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-accent/50 to-transparent" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.55) 100%)" }} />
    </div>
  );
}
