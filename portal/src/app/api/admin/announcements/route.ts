import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { announcementSchema } from "@/lib/validations";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const all = await db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.createdAt));

  return NextResponse.json({ announcements: all });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = announcementSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, body: content, audience, pinned, publish } = parsed.data;

  const [announcement] = await db
    .insert(announcements)
    .values({
      title,
      body: content,
      audience,
      pinned,
      publishedAt: publish ? new Date() : null,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json({ announcement });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, ...updates } = await req.json();

  const setData: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.title !== undefined) setData.title = updates.title;
  if (updates.body !== undefined) setData.body = updates.body;
  if (updates.audience !== undefined) setData.audience = updates.audience;
  if (updates.pinned !== undefined) setData.pinned = updates.pinned;
  if (updates.publish === true) setData.publishedAt = new Date();
  if (updates.publish === false) setData.publishedAt = null;

  await db
    .update(announcements)
    .set(setData)
    .where(eq(announcements.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();

  await db.delete(announcements).where(eq(announcements.id, id));

  return NextResponse.json({ success: true });
}
