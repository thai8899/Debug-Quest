import { ArrowLeftToLine, ClipboardCheck, Hourglass, Ruler, RotateCw, ScanSearch, ScrollText, ShieldCheck } from "lucide-react";
import type { GuardId } from "@/lib/levelTypes";

const MAP = { shift: ArrowLeftToLine, edge: Ruler, null: ShieldCheck, await: Hourglass, type: ScanSearch, check: ClipboardCheck, log: ScrollText, retry: RotateCw };
export const GUARD_COLOR: Record<GuardId, string> = {
  shift: "#4FD1C5", edge: "#A78BFA", null: "#6EE7A0", await: "#F5A524", type: "#6EA8FF", check: "#F472B6", log: "#94A3B8", retry: "#FB923C",
};
export default function GuardIcon({ id, size = 18, className }: { id: GuardId; size?: number; className?: string }) {
  const I = MAP[id];
  return <I size={size} className={className} style={className ? undefined : { color: GUARD_COLOR[id] }} />;
}
