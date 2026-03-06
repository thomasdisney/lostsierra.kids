import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  pgEnum,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "parent"]);
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const registrationStatusEnum = pgEnum("registration_status", [
  "submitted",
  "under_review",
  "approved",
  "rejected",
]);
export const relationshipTypeEnum = pgEnum("relationship_type", [
  "mother",
  "father",
  "guardian",
  "grandparent",
  "other",
]);

// Users - auth accounts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("parent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Guardians - parent/guardian contact info (linked to user)
export const guardians = pgTable("guardians", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  altPhone: varchar("alt_phone", { length: 20 }),
  occupation: varchar("occupation", { length: 255 }),
  // Address fields
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  zip: varchar("zip", { length: 20 }),
  country: varchar("country", { length: 100 }).default("US"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Children - child records
export const children = pgTable("children", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  gender: genderEnum("gender"),
  allergies: text("allergies"),
  medicalNotes: text("medical_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Guardian-Children junction (many-to-many)
export const guardianChildren = pgTable("guardian_children", {
  id: uuid("id").primaryKey().defaultRandom(),
  guardianId: uuid("guardian_id")
    .notNull()
    .references(() => guardians.id, { onDelete: "cascade" }),
  childId: uuid("child_id")
    .notNull()
    .references(() => children.id, { onDelete: "cascade" }),
  relationship: relationshipTypeEnum("relationship").notNull(),
});

// Programs - LSK programs
export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ageRange: varchar("age_range", { length: 50 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Academic years
export const academicYears = pgTable("academic_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(), // e.g. "2026-2027"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  active: boolean("active").notNull().default(true),
});

// Registrations - pre-registration submissions
export const registrations = pgTable("registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  guardianId: uuid("guardian_id")
    .notNull()
    .references(() => guardians.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").references(() => academicYears.id),
  status: registrationStatusEnum("status").notNull().default("submitted"),
  adminNotes: text("admin_notes"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

// Registration-Children junction
export const registrationChildren = pgTable("registration_children", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id")
    .notNull()
    .references(() => registrations.id, { onDelete: "cascade" }),
  childId: uuid("child_id")
    .notNull()
    .references(() => children.id, { onDelete: "cascade" }),
  programId: uuid("program_id").references(() => programs.id),
});

// Type exports for use in app
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Guardian = typeof guardians.$inferSelect;
export type NewGuardian = typeof guardians.$inferInsert;
export type Child = typeof children.$inferSelect;
export type NewChild = typeof children.$inferInsert;
export type Program = typeof programs.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type AcademicYear = typeof academicYears.$inferSelect;
