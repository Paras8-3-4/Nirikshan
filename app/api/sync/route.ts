import { NextResponse } from "next/server";
import { mergeInspectionSync, resolveItemConflict } from "@/lib/serverStore";
import type { InspectionRecord } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body?.action === "resolveConflict") {
      const { conflictId, choice } = body as {
        conflictId?: string;
        choice?: "server" | "incoming";
      };
      if (!conflictId || (choice !== "server" && choice !== "incoming")) {
        return NextResponse.json(
          { error: "Invalid conflict resolution payload" },
          { status: 400 }
        );
      }
      const updated = resolveItemConflict(conflictId, choice);
      if (!updated) {
        return NextResponse.json(
          { error: "Conflict or inspection not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ record: updated });
    }

    const record = body?.record as InspectionRecord | undefined;
    if (!record || !record.id || !Array.isArray(record.items)) {
      return NextResponse.json(
        { error: "Missing valid inspection record in request body" },
        { status: 400 }
      );
    }

    const result = mergeInspectionSync(record);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Sync API error:", err);
    return NextResponse.json(
      { error: "Failed to sync inspection record" },
      { status: 500 }
    );
  }
}