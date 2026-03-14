import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { guardians, guardianChildren, children } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [guardian] = await db
    .select()
    .from(guardians)
    .where(eq(guardians.userId, session.user.id));

  if (!guardian) {
    return NextResponse.json({ children: [] });
  }

  const links = await db
    .select()
    .from(guardianChildren)
    .where(eq(guardianChildren.guardianId, guardian.id));

  const childList = [];
  for (const link of links) {
    const [child] = await db
      .select()
      .from(children)
      .where(eq(children.id, link.childId));
    if (child) {
      childList.push({ ...child, relationship: link.relationship });
    }
  }

  return NextResponse.json({ children: childList });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, firstName, lastName, dateOfBirth, gender, daysInterested, desiredStartDate, hoursNeeded, staffNotes } = body;

  if (!id) {
    return NextResponse.json({ error: "Child ID required" }, { status: 400 });
  }

  // Verify this child belongs to the user's guardian
  const [guardian] = await db
    .select()
    .from(guardians)
    .where(eq(guardians.userId, session.user.id));

  if (!guardian) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const links = await db
    .select()
    .from(guardianChildren)
    .where(eq(guardianChildren.guardianId, guardian.id));

  const childIds = links.map((l) => l.childId);
  if (!childIds.includes(id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .update(children)
    .set({
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || null,
      daysInterested: daysInterested || null,
      desiredStartDate: desiredStartDate || null,
      hoursNeeded: hoursNeeded || null,
      staffNotes: staffNotes || null,
      updatedAt: new Date(),
    })
    .where(eq(children.id, id));

  return NextResponse.json({ success: true });
}
