import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  guardians,
  guardianChildren,
  enrollments,
  weeklyReports,
  programs,
} from "@/lib/db/schema";
import { eq, isNotNull, desc, inArray } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get guardian's children's enrolled program IDs
    const [guardian] = await db
      .select()
      .from(guardians)
      .where(eq(guardians.userId, session.user.id));

    if (!guardian) {
      return NextResponse.json({ reports: [] });
    }

    const links = await db
      .select()
      .from(guardianChildren)
      .where(eq(guardianChildren.guardianId, guardian.id));

    const programIds = new Set<string>();
    for (const link of links) {
      const enrs = await db
        .select()
        .from(enrollments)
        .where(eq(enrollments.childId, link.childId));
      for (const e of enrs) {
        programIds.add(e.programId);
      }
    }

    if (programIds.size === 0) {
      return NextResponse.json({ reports: [] });
    }

    // Get published reports only for enrolled programs
    const allReports = await db
      .select()
      .from(weeklyReports)
      .where(
        isNotNull(weeklyReports.publishedAt)
      )
      .orderBy(desc(weeklyReports.publishedAt));

    const filtered = allReports.filter((r) => programIds.has(r.programId));

    const enriched = [];
    for (const report of filtered) {
      const [program] = await db
        .select()
        .from(programs)
        .where(eq(programs.id, report.programId));
      enriched.push({ ...report, program });
    }

    return NextResponse.json({ reports: enriched });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
