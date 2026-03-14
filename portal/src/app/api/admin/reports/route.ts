import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { weeklyReports, programs } from "@/lib/db/schema";
import { weeklyReportSchema } from "@/lib/validations";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const all = await db
      .select()
      .from(weeklyReports)
      .orderBy(desc(weeklyReports.createdAt));

    const enriched = [];
    for (const report of all) {
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

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = weeklyReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      programId,
      weekStart,
      weekEnd,
      title,
      summary,
      highlights,
      notes,
      publish,
    } = parsed.data;

    const [report] = await db
      .insert(weeklyReports)
      .values({
        programId,
        weekStart,
        weekEnd,
        title,
        summary: summary || null,
        highlights: highlights || null,
        notes: notes || null,
        publishedAt: publish ? new Date() : null,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Error creating report:", error);
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
    const { id, ...updates } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Verify exists
    const [existing] = await db
      .select({ id: weeklyReports.id })
      .from(weeklyReports)
      .where(eq(weeklyReports.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const setData: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof updates.title === "string") setData.title = updates.title;
    if (typeof updates.summary === "string") setData.summary = updates.summary;
    if (typeof updates.highlights === "string")
      setData.highlights = updates.highlights;
    if (typeof updates.notes === "string") setData.notes = updates.notes;
    if (updates.publish === true) setData.publishedAt = new Date();
    if (updates.publish === false) setData.publishedAt = null;

    await db
      .update(weeklyReports)
      .set(setData)
      .where(eq(weeklyReports.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(weeklyReports).where(eq(weeklyReports.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
