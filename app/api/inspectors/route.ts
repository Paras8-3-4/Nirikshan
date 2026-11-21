import { NextRequest, NextResponse } from "next/server";
import { createInspector, getInspectors } from "@/lib/directoryStore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inspectors = getInspectors({
    includeInactive: searchParams.get("includeInactive") === "true",
  });

  return NextResponse.json({ inspectors });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.name || !body?.code || !body?.designation || !body?.address) {
      return NextResponse.json(
        { error: "name, code, designation, and address are required" },
        { status: 400 }
      );
    }

    const inspector = createInspector({
      name: body.name,
      code: body.code,
      designation: body.designation,
      age: typeof body.age === "number" ? body.age : undefined,
      sex: body.sex,
      address: body.address,
      city: body.city,
      state: body.state,
      country: body.country,
      active: typeof body.active === "boolean" ? body.active : true,
    });

    return NextResponse.json({ inspector }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }
}