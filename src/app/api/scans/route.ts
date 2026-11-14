import { NextResponse } from "next/server";
import { listScans } from "@/lib/store";
import { redact } from "@/lib/redact";

export async function GET() {
  return NextResponse.json((await listScans()).map(redact));
}
