import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  enrollments,
  children,
  programs,
  academicYears,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
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
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { childId, programId, academicYearId } = await req.json();

  const [enrollment] = await db
    .insert(enrollments)
    .values({
      childId,
      programId,
      academicYearId: academicYearId || null,
    })
    .returning();

  return NextResponse.json({ enrollment });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, active } = await req.json();

  await db
    .update(enrollments)
    .set({ active })
    .where(eq(enrollments.id, id));

  return NextResponse.json({ success: true });
}
