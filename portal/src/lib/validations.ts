import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
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
  gender: z.enum(["male", "female", "other"]).optional(),
  allergies: z.string().optional(),
  medicalNotes: z.string().optional(),
  programId: z.string().uuid("Select a program"),
});

export const registrationSchema = z.object({
  guardian: guardianSchema,
  address: addressSchema,
  children: z.array(childSchema).min(1, "At least one child is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type GuardianInput = z.infer<typeof guardianSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type ChildInput = z.infer<typeof childSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
