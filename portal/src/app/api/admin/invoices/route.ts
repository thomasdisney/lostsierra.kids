import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  invoices,
  invoiceItems,
  guardians,
  payments,
} from "@/lib/db/schema";
import { invoiceSchema } from "@/lib/validations";
import { eq, desc, sql } from "drizzle-orm";

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LSK-${year}-`;

  const result = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(sql`${invoices.invoiceNumber} LIKE ${prefix + "%"}`)
    .orderBy(desc(invoices.invoiceNumber))
    .limit(1);

  if (result.length === 0) {
    return `${prefix}0001`;
  }

  const lastNum = parseInt(result[0].invoiceNumber.split("-")[2], 10);
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const all = await db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.createdAt));

  const enriched = [];
  for (const inv of all) {
    const [guardian] = await db
      .select()
      .from(guardians)
      .where(eq(guardians.id, inv.guardianId));

    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, inv.id));

    const paymentList = await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, inv.id));

    const totalPaid = paymentList.reduce((sum, p) => sum + p.amount, 0);

    enriched.push({ ...inv, guardian, items, payments: paymentList, totalPaid });
  }

  return NextResponse.json({ invoices: enriched });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = invoiceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { guardianId, items, dueDate, notes, tax } = parsed.data;
  const invoiceNumber = await generateInvoiceNumber();

  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const total = subtotal + tax;

  const [invoice] = await db
    .insert(invoices)
    .values({
      guardianId,
      invoiceNumber,
      subtotal,
      tax,
      total,
      dueDate: dueDate || null,
      notes: notes || null,
    })
    .returning();

  for (const item of items) {
    await db.insert(invoiceItems).values({
      invoiceId: invoice.id,
      description: item.description,
      childId: item.childId || null,
      programId: item.programId || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.unitPrice * item.quantity,
    });
  }

  return NextResponse.json({ invoice });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, status, notes } = await req.json();

  const setData: Record<string, unknown> = { updatedAt: new Date() };
  if (status) setData.status = status;
  if (notes !== undefined) setData.notes = notes;
  if (status === "paid") setData.paidAt = new Date();

  await db.update(invoices).set(setData).where(eq(invoices.id, id));

  return NextResponse.json({ success: true });
}
