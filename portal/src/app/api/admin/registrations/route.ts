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
import { eq, and } from "drizzle-orm";

export async function GET() {
  try {
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
  } catch (error) {
    console.error("Error fetching registrations:", error);
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
    const { id, status, adminNotes } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const validStatuses = ["submitted", "under_review", "approved", "rejected"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify registration exists
    const [existing] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

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
          // Check if enrollment already exists for this child+program+year
          const existingEnrollments = await db
            .select()
            .from(enrollments)
            .where(
              and(
                eq(enrollments.childId, rc.childId),
                eq(enrollments.programId, rc.programId)
              )
            );

          const alreadyEnrolled = activeYear
            ? existingEnrollments.some(
                (e) => e.academicYearId === activeYear.id
              )
            : existingEnrollments.length > 0;

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
  } catch (error) {
    console.error("Error updating registration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
