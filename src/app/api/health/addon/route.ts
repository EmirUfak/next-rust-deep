import { NextResponse } from "next/server";

import { getNativeAddonHealth } from "@/server/native-addon-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const health = await getNativeAddonHealth();

  return NextResponse.json(health, {
    status: health.available ? 200 : 503,
  });
}
