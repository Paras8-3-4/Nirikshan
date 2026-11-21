import { NextRequest, NextResponse } from "next/server";
import {
  deleteOrArchiveSite,
  getSiteById,
  updateSite,
} from "@/lib/directoryStore";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const site = getSiteById(id);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  return NextResponse.json({ site });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const updated = updateSite(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }
    return NextResponse.json({ site: updated });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const hardDelete = searchParams.get("hard") === "true";

  const removed = deleteOrArchiveSite(id, hardDelete);
  if (!removed) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({
    deleted: true,
    mode: hardDelete ? "hard" : "archived",
    id,
  });
}