import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { guardians, invoices, invoiceItems, payments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [guardian] = await db
      .select()
      .from(guardians)
      .where(eq(guardians.userId, session.user.id));

    if (!guardian) {
      return NextResponse.json({ invoices: [] });
    }

    const all = await db
      .select()
      .from(invoices)
      .where(eq(invoices.guardianId, guardian.id))
      .orderBy(desc(invoices.createdAt));

    const enriched = [];
    for (const inv of all) {
      const items = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, inv.id));

      const paymentList = await db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, inv.id));

      const totalPaid = paymentList.reduce((sum, p) => sum + p.amount, 0);

      enriched.push({ ...inv, items, payments: paymentList, totalPaid });
    }

    return NextResponse.json({ invoices: enriched });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
