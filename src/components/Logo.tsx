import Link from "next/link";
import Mascot from "./Mascot";

export default function Logo() {
  return (
    <Link href="/scan/demo" className="mb-6 flex w-fit items-center gap-3">
      <Mascot size={40} mood="idle" />
      <span className="font-pixel text-base text-accent" style={{ textShadow: "0 0 18px rgba(255,201,51,.55), 0 3px 0 rgba(0,0,0,.35)" }}>DEBUG QUEST</span>
    </Link>
  );
}
