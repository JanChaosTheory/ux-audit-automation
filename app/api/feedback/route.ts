import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    console.log("[feedback]", data);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[feedback] failed", e);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}