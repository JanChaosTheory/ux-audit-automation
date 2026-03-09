import { NextRequest } from "next/server";
import { generateMockAudit } from "@/lib/mock-audit";

export function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") ?? "";
  const feature = request.nextUrl.searchParams.get("feature") ?? "";
  const stage = request.nextUrl.searchParams.get("stage") ?? "pre-dev";
  const audit = generateMockAudit(url, feature, stage);
  return Response.json(audit);
}
