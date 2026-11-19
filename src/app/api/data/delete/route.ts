import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  }

  const userId = session.user.id;
  const deleted = await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) return false;

    if (user.email) {
      await tx
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, user.email));
    }
    await tx.delete(users).where(eq(users.id, userId));
    return true;
  });
  if (!deleted) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
