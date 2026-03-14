import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { announcements, announcementReads } from "@/lib/db/schema";
import { desc, isNotNull, eq, and, or } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "admin";

    const all = await db
      .select()
      .from(announcements)
      .where(
        and(
          isNotNull(announcements.publishedAt),
          isAdmin
            ? or(
                eq(announcements.audience, "all"),
                eq(announcements.audience, "admin")
              )
            : or(
                eq(announcements.audience, "all"),
                eq(announcements.audience, "parents")
              )
        )
      )
      .orderBy(desc(announcements.pinned), desc(announcements.publishedAt));

    // Get user's read announcements
    const reads = await db
      .select({ announcementId: announcementReads.announcementId })
      .from(announcementReads)
      .where(eq(announcementReads.userId, session.user.id));

    const readIds = new Set(reads.map((r) => r.announcementId));

    const enriched = all.map((a) => ({
      ...a,
      isRead: readIds.has(a.id),
    }));

    return NextResponse.json({ announcements: enriched });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
