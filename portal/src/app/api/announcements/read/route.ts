import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { announcementReads } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { announcementId } = await req.json();

  await db.insert(announcementReads).values({
    announcementId,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
