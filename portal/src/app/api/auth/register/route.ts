import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, guardians } from "@/lib/db/schema";
import { registerSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Bot protection: honeypot field (bots auto-fill hidden "website" field)
    if (body.website) {
      return NextResponse.json({ success: true, email: body.email, emailSent: true });
    }

    // Bot protection: time-based check (no human fills 4 fields in < 3 seconds)
    const renderTime = body._formRenderedAt;
    if (typeof renderTime !== "number" || Date.now() - renderTime < 3000) {
      return NextResponse.json({ success: true, email: body.email, emailSent: true });
    }

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { fullName, email, password } = parsed.data;

    // Check if user exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationCode = generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        fullName,
        role: "new_user",
        emailVerified: false,
        verificationCode,
        verificationExpiry,
      })
      .returning();

    // Auto-create guardian record
    await db.insert(guardians).values({
      userId: user.id,
      fullName,
      email,
    });

    // Send verification email (don't fail registration if email fails)
    const emailSent = await sendVerificationEmail(email, verificationCode);

    return NextResponse.json({ success: true, email, emailSent });
  } catch (error) {
    // Handle unique constraint violation (race condition on duplicate email)
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("unique") ||
      errorMessage.includes("duplicate")
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    console.error("Error during registration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
