import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { guardians } from "@/lib/db/schema";
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

  return NextResponse.json({ guardian: guardian || null });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  await db
    .update(guardians)
    .set({
      fullName: body.fullName,
      phone: body.phone,
      altPhone: body.altPhone || null,
      occupation: body.occupation || null,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2 || null,
      city: body.city,
      state: body.state,
      zip: body.zip,
      country: body.country || "US",
      updatedAt: new Date(),
    })
    .where(eq(guardians.userId, session.user.id));

  return NextResponse.json({ success: true });
}
