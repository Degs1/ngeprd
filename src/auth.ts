import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { isAdminEmail } from "./lib/auth/admin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "dummy_google_id",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "dummy_google_secret",
    }),
    // Development quick-login provider for local testing and debugging
    Credentials({
      id: "dev-login",
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        if (process.env.NODE_ENV === "production") {
          return null;
        }
        const email = typeof credentials?.email === "string" ? credentials.email.trim() : "";
        if (!email) return null;

        const name = typeof credentials?.name === "string" && credentials.name.trim()
          ? credentials.name.trim()
          : email.split("@")[0] || "User";

        return {
          id: email,
          email,
          name,
          image: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id || user.email;
        token.email = user.email;
        token.role = isAdminEmail(user.email) ? "admin" : "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string) || session.user.email || "";
        (session.user as any).role =
          (token.role as string) || (isAdminEmail(session.user.email) ? "admin" : "user");
      }
      return session;
    },
  },
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "ngeprd_super_secret_session_key_32_characters_minimum_authjs",
});
