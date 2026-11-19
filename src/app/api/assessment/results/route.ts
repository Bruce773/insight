import { desc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dependencies() {
  if (!process.env.DATABASE_URL) return null;
  const [{ auth }, { db }, { assessmentResults }] = await Promise.all([
    import("@/lib/auth"), import("@/lib/db"), import("@/lib/db/schema"),
  ]);
  return { auth, db, assessmentResults };
}

export async function GET() {
  try {
    const deps = await dependencies();
    if (!deps) return Response.json({ error: "Persistence is not configured." }, { status: 503 });
    const session = await deps.auth();
    if (!session?.user?.id) return Response.json({ error: "Sign in to see saved plans." }, { status: 401 });
    const items = await deps.db.select().from(deps.assessmentResults)
      .where(eq(deps.assessmentResults.userId, session.user.id))
      .orderBy(desc(deps.assessmentResults.createdAt)).limit(20);
    return Response.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Saved plans are unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  }
  try {
    const deps = await dependencies();
    if (!deps) return Response.json({ error: "Persistence is not configured." }, { status: 503 });
    const session = await deps.auth();
    if (!session?.user?.id) return Response.json({ error: "Sign in to save your plan." }, { status: 401 });
    const body = await request.text();
    if (body.length > 100_000) return Response.json({ error: "Plan is too large." }, { status: 413 });
    let payload: unknown;
    try { payload = JSON.parse(body); } catch { return Response.json({ error: "Invalid plan." }, { status: 400 }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json({ error: "Invalid plan." }, { status: 400 });
    }
    const [saved] = await deps.db.insert(deps.assessmentResults)
      .values({ userId: session.user.id, payload }).returning({ id: deps.assessmentResults.id });
    return Response.json({ id: saved.id }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Your plan could not be saved." }, { status: 503 });
  }
}
