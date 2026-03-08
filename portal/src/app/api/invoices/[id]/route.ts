import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  guardians,
  invoices,
  invoiceItems,
  payments,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id));

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify ownership (parents can only see their own)
  if (session.user.role !== "admin") {
    const [guardian] = await db
      .select()
      .from(guardians)
      .where(eq(guardians.userId, session.user.id));

    if (!guardian || guardian.id !== invoice.guardianId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id));

  const paymentList = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id));

  const totalPaid = paymentList.reduce((sum, p) => sum + p.amount, 0);

  return NextResponse.json({
    invoice: { ...invoice, items, payments: paymentList, totalPaid },
  });
}
