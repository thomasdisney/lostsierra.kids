import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  attendanceRecords,
  enrollments,
  children,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
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
  } catch (error) {
    console.error("Error fetching attendance:", error);
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
    const { records } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: "records array is required" },
        { status: 400 }
      );
    }

    const validStatuses = ["present", "absent", "excused"];

    for (const record of records) {
      if (
        !record.childId ||
        !record.programId ||
        !record.date ||
        !record.status
      ) {
        return NextResponse.json(
          { error: "Each record requires childId, programId, date, status" },
          { status: 400 }
        );
      }
      if (!validStatuses.includes(record.status)) {
        return NextResponse.json(
          {
            error: `status must be one of: ${validStatuses.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Upsert each record
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
  } catch (error) {
    console.error("Error saving attendance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
