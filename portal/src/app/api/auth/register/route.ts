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
  const body = await req.json();
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

  // Send verification email
  await sendVerificationEmail(email, verificationCode);

  return NextResponse.json({ success: true, email });
}
