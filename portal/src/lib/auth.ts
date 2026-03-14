import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, guardians } from "./db/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;

        if (!email || !password) return null;

        // Allow "admin" as alias for the admin email
        const lookupEmail = email.toLowerCase() === "admin"
          ? "thomasdisney7@gmail.com"
          : email;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, lookupEmail));

        if (!user) return null;

        // Admin account can also authenticate with ADMIN_PASSWORD env var
        let valid = false;
        if (user.role === "admin" && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
          valid = true;
        } else {
          valid = await bcrypt.compare(password, user.passwordHash);
        }
        if (!valid) return null;

        const [guardian] = await db
          .select()
          .from(guardians)
          .where(eq(guardians.userId, user.id));

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          guardianId: guardian?.id,
          isEmailVerified: user.emailVerified ?? false,
        };
      },
    }),
  ],
  basePath: "/portal/api/auth",
  session: { strategy: "jwt" },
  pages: {
    signIn: "/portal/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.guardianId = (user as { guardianId: string }).guardianId;
        token.isEmailVerified = (user as unknown as { isEmailVerified: boolean }).isEmailVerified;
      }

      // Refresh role + emailVerified from DB on each request (lightweight single-row query)
      if (token.sub) {
        const [dbUser] = await db
          .select({ role: users.role, emailVerified: users.emailVerified })
          .from(users)
          .where(eq(users.id, token.sub));
        if (dbUser) {
          token.role = dbUser.role;
          token.isEmailVerified = dbUser.emailVerified;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { guardianId: string }).guardianId =
          token.guardianId as string;
        (session.user as unknown as { isEmailVerified: boolean }).isEmailVerified =
          token.isEmailVerified as boolean;
      }
      return session;
    },
  },
});
