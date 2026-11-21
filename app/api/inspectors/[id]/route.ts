import { NextRequest, NextResponse } from "next/server";
import {
  deleteOrArchiveInspector,
  getInspectorById,
  updateInspector,
} from "@/lib/directoryStore";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const inspector = getInspectorById(id);
  if (!inspector) {
    return NextResponse.json(
      { error: "Inspector not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ inspector });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const updated = updateInspector(id, body);
    if (!updated) {
      return NextResponse.json(
        { error: "Inspector not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ inspector: updated });
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

  const removed = deleteOrArchiveInspector(id, hardDelete);
  if (!removed) {
    return NextResponse.json(
      { error: "Inspector not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    deleted: true,
    mode: hardDelete ? "hard" : "archived",
    id,
  });
}