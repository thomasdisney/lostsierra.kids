import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  attendanceRecords,
  enrollments,
  children,
  programs,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  const date = searchParams.get("date");

  if (!programId || !date) {
    return NextResponse.json(
      { error: "programId and date are required" },
      { status: 400 }
    );
  }

  // Get enrolled children for this program
  const enrolled = await db
    .select()
    .from(enrollments)
    .where(
      and(eq(enrollments.programId, programId), eq(enrollments.active, true))
    );

  const childDetails = [];
  for (const enr of enrolled) {
    const [child] = await db
      .select()
      .from(children)
      .where(eq(children.id, enr.childId));
    if (child) {
      // Check existing attendance record
      const [record] = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.childId, child.id),
            eq(attendanceRecords.programId, programId),
            eq(attendanceRecords.date, date)
          )
        );
      childDetails.push({
        child,
        enrollmentId: enr.id,
        attendance: record || null,
      });
    }
  }

  return NextResponse.json({ children: childDetails });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { records } = await req.json();

  // records: Array<{ childId, programId, date, status, notes? }>
  for (const record of records) {
    const existing = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.childId, record.childId),
          eq(attendanceRecords.programId, record.programId),
          eq(attendanceRecords.date, record.date)
        )
      );

    if (existing.length > 0) {
      await db
        .update(attendanceRecords)
        .set({
          status: record.status,
          notes: record.notes || null,
          markedBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, existing[0].id));
    } else {
      await db.insert(attendanceRecords).values({
        childId: record.childId,
        programId: record.programId,
        date: record.date,
        status: record.status,
        notes: record.notes || null,
        markedBy: session.user.id,
      });
    }
  }

  return NextResponse.json({ success: true });
}
