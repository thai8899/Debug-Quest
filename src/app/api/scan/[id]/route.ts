import { NextResponse } from "next/server";
import { getDemoScan } from "@/lib/data";
import { loadGameScan } from "@/lib/ingest";

// Scan results for the game screens: the demo scans, or a real scan from the pipeline's store
// converted to the team contract (locked bugs redacted).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const scan = (await getDemoScan(id)) ?? (await loadGameScan(id));
  return scan ? NextResponse.json(scan) : NextResponse.json({ error: "not found" }, { status: 404 });
}
