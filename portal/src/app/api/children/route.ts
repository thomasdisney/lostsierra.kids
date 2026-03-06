import { NextResponse } from "next/server";
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
