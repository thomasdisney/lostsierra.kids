import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { payments, invoices } from "@/lib/db/schema";
import { paymentSchema } from "@/lib/validations";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const all = await db
    .select()
    .from(payments)
    .orderBy(desc(payments.paidAt));

  return NextResponse.json({ payments: all });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = paymentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { invoiceId, amount, method, notes } = parsed.data;

  const [payment] = await db
    .insert(payments)
    .values({
      invoiceId,
      amount,
      method,
      notes: notes || null,
      recordedBy: session.user.id,
    })
    .returning();

  // Check if invoice is fully paid
  const allPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));

  const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));

  if (invoice && totalPaid >= invoice.total) {
    await db
      .update(invoices)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId));
  }

  return NextResponse.json({ payment });
}
