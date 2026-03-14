import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { guardians } from "@/lib/db/schema";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const all = await db
      .select({
        id: guardians.id,
        fullName: guardians.fullName,
        email: guardians.email,
        phone: guardians.phone,
        city: guardians.city,
        state: guardians.state,
      })
      .from(guardians);

    return NextResponse.json({ guardians: all });
  } catch (error) {
    console.error("Error fetching families:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
