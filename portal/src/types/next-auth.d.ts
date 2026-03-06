import "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    guardianId: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      guardianId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    guardianId: string;
  }
}
