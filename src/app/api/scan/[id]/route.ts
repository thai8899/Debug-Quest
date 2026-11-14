import { NextResponse } from "next/server";
import { getDemoScan } from "@/lib/data";

// STUB owned by Punarva: she replaces this with the real scan lookup (same shape, locked bugs redacted).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const scan = await getDemoScan((await params).id);
  return scan ? NextResponse.json(scan) : NextResponse.json({ error: "not found" }, { status: 404 });
}
