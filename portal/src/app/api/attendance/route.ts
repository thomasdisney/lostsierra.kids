import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  guardians,
  guardianChildren,
  attendanceRecords,
  children,
  programs,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get guardian
    const [guardian] = await db
      .select()
      .from(guardians)
      .where(eq(guardians.userId, session.user.id));

    if (!guardian) {
      return NextResponse.json({ attendance: [] });
    }

    // Get children linked to this guardian
    const links = await db
      .select()
      .from(guardianChildren)
      .where(eq(guardianChildren.guardianId, guardian.id));

    const result = [];
    for (const link of links) {
      const [child] = await db
        .select()
        .from(children)
        .where(eq(children.id, link.childId));

      if (!child) continue;

      const records = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.childId, child.id));

      const enrichedRecords = [];
      for (const rec of records) {
        const [program] = await db
          .select()
          .from(programs)
          .where(eq(programs.id, rec.programId));
        enrichedRecords.push({ ...rec, program });
      }

      result.push({
        child,
        records: enrichedRecords,
      });
    }

    return NextResponse.json({ attendance: result });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
