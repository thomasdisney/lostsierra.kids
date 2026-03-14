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
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "parent",
  "new_account",
  "new_user",
]);
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
export const announcementAudienceEnum = pgEnum("announcement_audience", [
  "all",
  "parents",
  "admin",
]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "excused",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "check",
  "other",
]);

// Users - auth accounts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("new_user"),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationCode: varchar("verification_code", { length: 6 }),
  verificationExpiry: timestamp("verification_expiry"),
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
  daysInterested: text("days_interested"), // comma-separated: "monday,wednesday,friday"
  desiredStartDate: varchar("desired_start_date", { length: 50 }),
  hoursNeeded: varchar("hours_needed", { length: 50 }),
  allergies: text("allergies"),
  medicalNotes: text("medical_notes"),
  staffNotes: text("staff_notes"),
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
  coParents: text("co_parents"), // JSON array of co-parent objects
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
  daysInterested: text("days_interested"),
});

// Announcements
export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  audience: announcementAudienceEnum("audience").notNull().default("all"),
  pinned: boolean("pinned").notNull().default(false),
  publishedAt: timestamp("published_at"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const announcementReads = pgTable("announcement_reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  announcementId: uuid("announcement_id")
    .notNull()
    .references(() => announcements.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at").notNull().defaultNow(),
});

// Enrollments
export const enrollments = pgTable("enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  childId: uuid("child_id")
    .notNull()
    .references(() => children.id, { onDelete: "cascade" }),
  programId: uuid("program_id")
    .notNull()
    .references(() => programs.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").references(() => academicYears.id),
  active: boolean("active").notNull().default(true),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
});

// Attendance
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: attendanceStatusEnum("status").notNull(),
    notes: text("notes"),
    markedBy: uuid("marked_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("attendance_unique_idx").on(
      table.childId,
      table.programId,
      table.date
    ),
  ]
);

// Weekly Reports
export const weeklyReports = pgTable("weekly_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  programId: uuid("program_id")
    .notNull()
    .references(() => programs.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary"),
  highlights: text("highlights"),
  notes: text("notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Invoices
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  guardianId: uuid("guardian_id")
    .notNull()
    .references(() => guardians.id, { onDelete: "cascade" }),
  invoiceNumber: varchar("invoice_number", { length: 20 }).notNull().unique(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  subtotal: integer("subtotal").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  total: integer("total").notNull().default(0),
  dueDate: date("due_date"),
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 500 }).notNull(),
  childId: uuid("child_id").references(() => children.id),
  programId: uuid("program_id").references(() => programs.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(),
  total: integer("total").notNull(),
});

// Payments
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  method: paymentMethodEnum("method").notNull(),
  notes: text("notes"),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
  recordedBy: uuid("recorded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
export type Announcement = typeof announcements.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
