import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    // Programs list is intentionally public (used in registration forms)
    const allPrograms = await db.select().from(programs);
    return NextResponse.json({ programs: allPrograms });
  } catch (error) {
    console.error("Error fetching programs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, ageRange } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const [program] = await db
      .insert(programs)
      .values({
        name: name.trim(),
        description: description || null,
        ageRange: ageRange || null,
      })
      .returning();

    return NextResponse.json({ program });
  } catch (error) {
    console.error("Error creating program:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Only set fields that were actually provided
    const setData: Record<string, unknown> = {};
    if (typeof updates.name === "string") setData.name = updates.name.trim();
    if (typeof updates.description === "string")
      setData.description = updates.description;
    if (typeof updates.ageRange === "string")
      setData.ageRange = updates.ageRange;
    if (typeof updates.active === "boolean") setData.active = updates.active;

    if (Object.keys(setData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    await db
      .update(programs)
      .set(setData)
      .where(eq(programs.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating program:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
