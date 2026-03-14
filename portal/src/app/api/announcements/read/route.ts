import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { announcementReads, announcements } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { announcementId } = body;

    if (!announcementId || typeof announcementId !== "string") {
      return NextResponse.json(
        { error: "announcementId is required" },
        { status: 400 }
      );
    }

    // Verify announcement exists
    const [announcement] = await db
      .select({ id: announcements.id })
      .from(announcements)
      .where(eq(announcements.id, announcementId));

    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // Check if already read (prevent duplicates)
    const [existing] = await db
      .select({ id: announcementReads.id })
      .from(announcementReads)
      .where(
        and(
          eq(announcementReads.announcementId, announcementId),
          eq(announcementReads.userId, session.user.id)
        )
      );

    if (existing) {
      return NextResponse.json({ success: true, alreadyRead: true });
    }

    await db.insert(announcementReads).values({
      announcementId,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking announcement read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
