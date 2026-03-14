import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(255, "Name is too long"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const guardianSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(7, "Valid phone number required"),
  altPhone: z.string().optional(),
  relationship: z.enum(["mother", "father", "guardian", "grandparent", "other"]),
  occupation: z.string().optional(),
});

export const addressSchema = z.object({
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(5, "Valid ZIP code required"),
  country: z.string().default("US"),
});

export const childSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().refine((val) => {
    const dob = new Date(val);
    return dob < new Date(); // DOB cannot be in the future (from ERP validate_dates pattern)
  }, "Date of birth cannot be in the future"),
  gender: z.enum(["male", "female"]).optional(),
  daysInterested: z.array(z.string()).min(1, "Select at least one day"),
  desiredStartDate: z.string().optional(),
  hoursNeeded: z.string().optional(),
  staffNotes: z.string().optional(),
});

export const registrationSchema = z.object({
  guardian: guardianSchema,
  address: addressSchema,
  children: z.array(childSchema).min(1, "At least one child is required"),
});

export const announcementSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  body: z.string().min(1, "Body is required"),
  audience: z.enum(["all", "parents", "admin"]).default("all"),
  pinned: z.boolean().default(false),
  publish: z.boolean().default(false),
});

export const attendanceSchema = z.object({
  childId: z.string().uuid(),
  programId: z.string().uuid(),
  date: z.string(),
  status: z.enum(["present", "absent", "excused"]),
  notes: z.string().optional(),
});

export const weeklyReportSchema = z.object({
  programId: z.string().uuid("Select a program"),
  weekStart: z.string(),
  weekEnd: z.string(),
  title: z.string().min(1, "Title is required").max(255),
  summary: z.string().optional(),
  highlights: z.string().optional(),
  notes: z.string().optional(),
  publish: z.boolean().default(false),
});

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  childId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().int(), // cents
});

export const invoiceSchema = z.object({
  guardianId: z.string().uuid("Select a family"),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  tax: z.number().int().default(0),
});

export const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().int().positive(),
  method: z.enum(["cash", "check", "other"]),
  notes: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type GuardianInput = z.infer<typeof guardianSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type ChildInput = z.infer<typeof childSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
export type AnnouncementInput = z.infer<typeof announcementSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type WeeklyReportInput = z.infer<typeof weeklyReportSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
