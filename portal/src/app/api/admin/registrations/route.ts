import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  registrations,
  guardians,
  registrationChildren,
  children,
  programs,
  enrollments,
  academicYears,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allRegs = await db.select().from(registrations);

  const enriched = [];
  for (const reg of allRegs) {
    const [guardian] = await db
      .select()
      .from(guardians)
      .where(eq(guardians.id, reg.guardianId));

    const regChildren = await db
      .select()
      .from(registrationChildren)
      .where(eq(registrationChildren.registrationId, reg.id));

    const childDetails = [];
    for (const rc of regChildren) {
      const [child] = await db
        .select()
        .from(children)
        .where(eq(children.id, rc.childId));
      let program = null;
      if (rc.programId) {
        const [p] = await db
          .select()
          .from(programs)
          .where(eq(programs.id, rc.programId));
        program = p;
      }
      if (child) {
        childDetails.push({ ...child, program });
      }
    }

    enriched.push({
      ...reg,
      guardian,
      children: childDetails,
    });
  }

  return NextResponse.json({ registrations: enriched });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, status, adminNotes } = await req.json();

  await db
    .update(registrations)
    .set({
      status,
      adminNotes: adminNotes || null,
      reviewedAt: new Date(),
    })
    .where(eq(registrations.id, id));

  // Auto-create enrollment records when approved
  if (status === "approved") {
    const regChildren = await db
      .select()
      .from(registrationChildren)
      .where(eq(registrationChildren.registrationId, id));

    // Get active academic year
    const [activeYear] = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.active, true));

    for (const rc of regChildren) {
      if (rc.programId) {
        // Check if enrollment already exists
        const existing = await db
          .select()
          .from(enrollments)
          .where(eq(enrollments.childId, rc.childId));

        const alreadyEnrolled = existing.some(
          (e) => e.programId === rc.programId
        );

        if (!alreadyEnrolled) {
          await db.insert(enrollments).values({
            childId: rc.childId,
            programId: rc.programId,
            academicYearId: activeYear?.id || null,
          });
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
