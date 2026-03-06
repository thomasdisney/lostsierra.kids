import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const allPrograms = await db.select().from(programs);
  return NextResponse.json({ programs: allPrograms });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, description, ageRange } = await req.json();

  const [program] = await db
    .insert(programs)
    .values({ name, description, ageRange })
    .returning();

  return NextResponse.json({ program });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, name, description, ageRange, active } = await req.json();

  await db
    .update(programs)
    .set({ name, description, ageRange, active })
    .where(eq(programs.id, id));

  return NextResponse.json({ success: true });
}
