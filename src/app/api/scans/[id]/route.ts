import { NextResponse } from "next/server";
import { getScan } from "@/lib/store";
import { redact } from "@/lib/redact";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const scan = await getScan((await params).id);
  return scan ? NextResponse.json(redact(scan)) : NextResponse.json({ error: "not found" }, { status: 404 });
}
