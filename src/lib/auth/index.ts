import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { createTransport } from "nodemailer";

import { db } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url }) {
        const server = process.env.EMAIL_SERVER;
        const from = process.env.EMAIL_FROM;
        if (!server || !from) {
          throw new Error("EMAIL_SERVER and EMAIL_FROM must be configured");
        }

        const transport = createTransport(server);
        const result = await transport.sendMail({
          to: identifier,
          from,
          subject: "Sign in to InSight",
          text: `Use this link to sign in to InSight:\n\n${url}\n\nIf you did not request this email, you can ignore it.`,
        });
        if (result.rejected.length || result.pending?.length) {
          throw new Error("Unable to deliver the sign-in email");
        }
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      return {
        ...session,
        user: { ...session.user, id: user.id },
      };
    },
  },
});
