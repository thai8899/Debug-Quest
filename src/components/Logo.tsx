import Link from "next/link";
import Mascot from "./Mascot";

export default function Logo() {
  return (
    <Link href="/scan/demo" className="mb-8 flex w-fit items-center gap-3">
      <Mascot size={38} mood="idle" />
      <span className="font-display text-xl font-bold tracking-wide text-[#ede8dc]">Debug<span className="text-accent"> Quest</span></span>
    </Link>
  );
}
