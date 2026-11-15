// The hungry yellow bug-eater. Mouth opens and closes via CSS (.chomper).
export default function Chomper({ size = 72, className = "" }: { size?: number; className?: string }) {
  return <div aria-hidden className={`chomper ${className}`} style={{ width: size, height: size }} />;
}
