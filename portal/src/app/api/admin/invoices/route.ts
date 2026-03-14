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

  const parts = result[0].invoiceNumber.split("-");
  const lastNum = parseInt(parts[parts.length - 1], 10);
  if (isNaN(lastNum)) {
    return `${prefix}0001`;
  }
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}

export async function GET() {
  try {
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

      enriched.push({
        ...inv,
        guardian,
        items,
        payments: paymentList,
        totalPaid,
      });
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

export async function POST(req: NextRequest) {
  try {
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

    // Verify guardian exists
    const [guardian] = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(eq(guardians.id, guardianId));

    if (!guardian) {
      return NextResponse.json(
        { error: "Family not found" },
        { status: 404 }
      );
    }

    let invoiceNumber: string;
    try {
      invoiceNumber = await generateInvoiceNumber();
    } catch {
      // Retry once on collision
      invoiceNumber = await generateInvoiceNumber();
    }

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
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("unique") ||
      errorMessage.includes("duplicate")
    ) {
      return NextResponse.json(
        { error: "Invoice number conflict, please try again" },
        { status: 409 }
      );
    }
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, notes } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const validStatuses = ["draft", "sent", "paid", "overdue", "cancelled"];

    const setData: Record<string, unknown> = { updatedAt: new Date() };
    if (status) {
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `status must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      setData.status = status;
      if (status === "paid") setData.paidAt = new Date();
    }
    if (notes !== undefined) setData.notes = notes;

    // Verify invoice exists
    const [existing] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    await db.update(invoices).set(setData).where(eq(invoices.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
