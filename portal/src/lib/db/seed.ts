import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcrypt";
import { users, guardians, programs, academicYears } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (!ADMIN_PASSWORD) {
    console.error("ADMIN_PASSWORD is required");
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);

  console.log("Seeding database...");

  // Create admin user
  const adminEmail = "thomasdisney7@gmail.com";
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail));

  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const [adminUser] = await db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash,
        fullName: "Thomas Disney",
        role: "admin",
      })
      .returning();

    await db.insert(guardians).values({
      userId: adminUser.id,
      fullName: "Thomas Disney",
      email: adminEmail,
    });

    console.log("Admin user created");
  } else {
    console.log("Admin user already exists");
  }

  // Seed programs
  const programData = [
    {
      name: "Playgroup",
      description: "Early childhood play-based learning for ages 2-4",
      ageRange: "2-4",
    },
    {
      name: "Phase 1",
      description: "Foundation program for ages 5-7",
      ageRange: "5-7",
    },
    {
      name: "Phase 2",
      description: "Intermediate program for ages 8-12",
      ageRange: "8-12",
    },
  ];

  for (const p of programData) {
    const existing = await db
      .select()
      .from(programs)
      .where(eq(programs.name, p.name));
    if (existing.length === 0) {
      await db.insert(programs).values(p);
      console.log(`Program "${p.name}" created`);
    }
  }

  // Seed academic year
  const yearName = "2026-2027";
  const existingYear = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.name, yearName));

  if (existingYear.length === 0) {
    await db.insert(academicYears).values({
      name: yearName,
      startDate: "2026-09-01",
      endDate: "2027-06-30",
    });
    console.log("Academic year 2026-2027 created");
  }

  console.log("Seed complete!");
}

seed().catch(console.error);
