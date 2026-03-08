import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { weeklyReports, programs } from "@/lib/db/schema";
import { weeklyReportSchema } from "@/lib/validations";
import { eq, desc } from "drizzle-orm";

export async function GET() {
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
}

export async function POST(req: NextRequest) {
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

  const { programId, weekStart, weekEnd, title, summary, highlights, notes, publish } =
    parsed.data;

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
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, ...updates } = await req.json();

  const setData: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.title !== undefined) setData.title = updates.title;
  if (updates.summary !== undefined) setData.summary = updates.summary;
  if (updates.highlights !== undefined) setData.highlights = updates.highlights;
  if (updates.notes !== undefined) setData.notes = updates.notes;
  if (updates.publish === true) setData.publishedAt = new Date();
  if (updates.publish === false) setData.publishedAt = null;

  await db
    .update(weeklyReports)
    .set(setData)
    .where(eq(weeklyReports.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  await db.delete(weeklyReports).where(eq(weeklyReports.id, id));

  return NextResponse.json({ success: true });
}
