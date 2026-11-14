import { ArrowLeftToLine, ClipboardCheck, Hourglass, Ruler, RotateCw, ScanSearch, ScrollText, ShieldCheck } from "lucide-react";
import type { GuardId } from "@/lib/levelTypes";

const MAP = { shift: ArrowLeftToLine, edge: Ruler, null: ShieldCheck, await: Hourglass, type: ScanSearch, check: ClipboardCheck, log: ScrollText, retry: RotateCw };
export default function GuardIcon({ id, size = 18, className }: { id: GuardId; size?: number; className?: string }) {
  const I = MAP[id];
  return <I size={size} className={className} />;
}
