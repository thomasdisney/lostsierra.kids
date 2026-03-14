import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    // Return generic success even if user not found (prevent email enumeration)
    if (!user || user.emailVerified) {
      return NextResponse.json({ success: true });
    }

    const verificationCode = generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await db
      .update(users)
      .set({ verificationCode, verificationExpiry })
      .where(eq(users.id, user.id));

    await sendVerificationEmail(email, verificationCode);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resending code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
