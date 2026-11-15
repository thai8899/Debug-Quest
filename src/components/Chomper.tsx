// The hungry lion. Its mouth opens and closes via CSS (.lion-mouth).
export default function Chomper({ size = 72, className = "" }: { size?: number; className?: string }) {
  const manes = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return <circle key={i} cx={50 + Math.cos(a) * 36} cy={52 + Math.sin(a) * 36} r="15" fill={i % 2 ? "#e8801c" : "#f59a2b"} />;
  });
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 100 104" className={className} style={{ filter: "drop-shadow(0 5px 0 rgba(120,60,0,.55)) drop-shadow(0 10px 12px rgba(3,8,40,.45))" }}>
      {manes}
      <circle cx="50" cy="52" r="34" fill="#f59a2b" />
      <circle cx="26" cy="26" r="9" fill="#ffd36b" /><circle cx="26" cy="26" r="4.5" fill="#e8801c" />
      <circle cx="74" cy="26" r="9" fill="#ffd36b" /><circle cx="74" cy="26" r="4.5" fill="#e8801c" />
      <circle cx="50" cy="54" r="28" fill="#ffd36b" />
      <ellipse cx="50" cy="66" rx="17" ry="13" fill="#fff0bf" />
      <circle cx="38" cy="45" r="5.5" fill="#fff" /><circle cx="62" cy="45" r="5.5" fill="#fff" />
      <circle cx="39" cy="46" r="3" fill="#2a1a00" /><circle cx="63" cy="46" r="3" fill="#2a1a00" />
      <path d="M31 36 L44 40 M69 36 L56 40" stroke="#a85a00" strokeWidth="3" strokeLinecap="round" />
      <g className="lion-mouth">
        <ellipse cx="50" cy="71" rx="13" ry="11" fill="#5a1620" />
        <path d="M40 62 L44 69 L48 62 M52 62 L56 69 L60 62" fill="#fff" stroke="#fff" strokeWidth="1" />
        <ellipse cx="50" cy="77" rx="7" ry="3.5" fill="#ff6b7a" />
      </g>
      <path d="M43 56 L57 56 L50 64 Z" fill="#3a2a0e" />
    </svg>
  );
}
