import { NextResponse } from "next/server";
import { getServerState, resolveItemConflict } from "@/lib/serverStore";

export async function GET() {
  const state = getServerState();
  const inspections = Object.values(state.inspections);
  return NextResponse.json({
    inspections,
    conflicts: state.conflicts,
  });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { conflictId, choice } = body as {
      conflictId?: string;
      choice?: "server" | "incoming";
    };

    if (!conflictId || (choice !== "server" && choice !== "incoming")) {
      return NextResponse.json(
        { error: "Provide conflictId and choice ('server' | 'incoming')" },
        { status: 400 }
      );
    }

    const updated = resolveItemConflict(conflictId, choice);
    if (!updated) {
      return NextResponse.json(
        { error: "Conflict not found" },
        { status: 404 }
      );
    }

    const state = getServerState();
    return NextResponse.json({
      record: updated,
      inspections: Object.values(state.inspections),
      conflicts: state.conflicts,
    });
  } catch (err) {
    console.error("Resolve conflict error:", err);
    return NextResponse.json(
      { error: "Failed to resolve conflict" },
      { status: 500 }
    );
  }
}