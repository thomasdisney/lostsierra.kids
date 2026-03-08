import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
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

  const verificationCode = generateVerificationCode();
  const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await db
    .update(users)
    .set({ verificationCode, verificationExpiry })
    .where(eq(users.id, user.id));

  await sendVerificationEmail(email, verificationCode);

  return NextResponse.json({ success: true });
}
