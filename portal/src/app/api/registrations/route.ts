import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  guardians,
  children,
  guardianChildren,
  registrations,
  registrationChildren,
} from "@/lib/db/schema";
import { registrationSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = registrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { guardian: guardianData, address, children: childrenData } = parsed.data;

  // Update guardian info
  await db
    .update(guardians)
    .set({
      fullName: guardianData.fullName,
      email: guardianData.email,
      phone: guardianData.phone,
      altPhone: guardianData.altPhone || null,
      occupation: guardianData.occupation || null,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || null,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      updatedAt: new Date(),
    })
    .where(eq(guardians.userId, session.user.id));

  // Get guardian record
  const [guardian] = await db
    .select()
    .from(guardians)
    .where(eq(guardians.userId, session.user.id));

  // Create children and link to guardian
  const childIds: { childId: string; daysInterested: string | null }[] = [];

  for (const childData of childrenData) {
    const daysStr = childData.daysInterested?.join(",") || null;
    const [child] = await db
      .insert(children)
      .values({
        firstName: childData.firstName,
        lastName: childData.lastName,
        dateOfBirth: childData.dateOfBirth,
        gender: childData.gender || null,
        daysInterested: daysStr,
        desiredStartDate: childData.desiredStartDate || null,
        hoursNeeded: childData.hoursNeeded || null,
        staffNotes: childData.staffNotes || null,
      })
      .returning();

    await db.insert(guardianChildren).values({
      guardianId: guardian.id,
      childId: child.id,
      relationship: guardianData.relationship,
    });

    childIds.push({ childId: child.id, daysInterested: daysStr });
  }

  // Create registration
  const [registration] = await db
    .insert(registrations)
    .values({
      guardianId: guardian.id,
      status: "submitted",
    })
    .returning();

  // Link children to registration
  for (const { childId, daysInterested } of childIds) {
    await db.insert(registrationChildren).values({
      registrationId: registration.id,
      childId,
      daysInterested,
    });
  }

  // Upgrade user from new_user to new_account after first registration
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (user?.role === "new_user") {
    await db
      .update(users)
      .set({ role: "new_account" })
      .where(eq(users.id, session.user.id));
  }

  return NextResponse.json({ id: registration.id, status: "submitted", roleUpgraded: user?.role === "new_user" });
}

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
    return NextResponse.json({ registrations: [] });
  }

  const regs = await db
    .select()
    .from(registrations)
    .where(eq(registrations.guardianId, guardian.id));

  return NextResponse.json({ registrations: regs });
}
