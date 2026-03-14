import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  enrollments,
  children,
  programs,
  academicYears,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const all = await db.select().from(enrollments);

    const enriched = [];
    for (const enr of all) {
      const [child] = await db
        .select()
        .from(children)
        .where(eq(children.id, enr.childId));
      const [program] = await db
        .select()
        .from(programs)
        .where(eq(programs.id, enr.programId));
      let academicYear = null;
      if (enr.academicYearId) {
        const [ay] = await db
          .select()
          .from(academicYears)
          .where(eq(academicYears.id, enr.academicYearId));
        academicYear = ay;
      }
      enriched.push({ ...enr, child, program, academicYear });
    }

    return NextResponse.json({ enrollments: enriched });
  } catch (error) {
    console.error("Error fetching enrollments:", error);
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
    const { childId, programId, academicYearId } = body;

    if (!childId || !programId) {
      return NextResponse.json(
        { error: "childId and programId are required" },
        { status: 400 }
      );
    }

    // Check for duplicate enrollment
    const existing = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.childId, childId),
          eq(enrollments.programId, programId)
        )
      );

    const yearId = academicYearId || null;
    const alreadyEnrolled = existing.some(
      (e) => e.academicYearId === yearId
    );

    if (alreadyEnrolled) {
      return NextResponse.json(
        { error: "Child is already enrolled in this program" },
        { status: 409 }
      );
    }

    const [enrollment] = await db
      .insert(enrollments)
      .values({
        childId,
        programId,
        academicYearId: yearId,
      })
      .returning();

    return NextResponse.json({ enrollment });
  } catch (error) {
    console.error("Error creating enrollment:", error);
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
    const { id, active } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (typeof active !== "boolean") {
      return NextResponse.json(
        { error: "active must be a boolean" },
        { status: 400 }
      );
    }

    await db
      .update(enrollments)
      .set({ active })
      .where(eq(enrollments.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating enrollment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
