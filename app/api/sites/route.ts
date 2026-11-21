import { NextRequest, NextResponse } from "next/server";
import { createSite, getSites } from "@/lib/directoryStore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sites = getSites({
    city: searchParams.get("city") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    inspectorId: searchParams.get("inspectorId") ?? undefined,
    includeInactive: searchParams.get("includeInactive") === "true",
  });

  return NextResponse.json({ sites });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.name || !body?.location || !body?.city || !body?.country) {
      return NextResponse.json(
        { error: "name, location, city, and country are required" },
        { status: 400 }
      );
    }

    const site = createSite({
      name: body.name,
      type: body.type,
      location: body.location,
      city: body.city,
      state: body.state,
      country: body.country,
      gpsLat:
        typeof body.gpsLat === "number" ? body.gpsLat : undefined,
      gpsLng:
        typeof body.gpsLng === "number" ? body.gpsLng : undefined,
      assignedInspectorIds: Array.isArray(body.assignedInspectorIds)
        ? body.assignedInspectorIds
        : [],
      active: typeof body.active === "boolean" ? body.active : true,
    });

    return NextResponse.json({ site }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }
}