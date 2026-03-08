import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json(
      { error: "Email and code are required" },
      { status: 400 }
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ success: true, alreadyVerified: true });
  }

  if (user.verificationCode !== code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  if (user.verificationExpiry && new Date() > user.verificationExpiry) {
    return NextResponse.json(
      { error: "Code expired. Please request a new one." },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({
      emailVerified: true,
      verificationCode: null,
      verificationExpiry: null,
    })
    .where(eq(users.id, user.id));

  return NextResponse.json({ success: true });
}
