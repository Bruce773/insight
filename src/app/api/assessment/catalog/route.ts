import { and, asc, desc, eq, ilike, like, or } from "drizzle-orm";
import { assessmentInstrument, createAssessmentForm } from "@/lib/assessment/forms";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (!["status", "assessment", "occupations", "skills"].includes(type ?? "")) {
    return Response.json({ error: "Unknown catalog request" }, { status: 400 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: "The data catalog is not configured." }, { status: 503 });
  }

  try {
    const [{ db }, { assessmentItems, occupations, occupationRatings }] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/db/schema"),
    ]);

    if (type === "status") {
      const items = await db.select({
        id: assessmentItems.id,
        instrument: assessmentItems.instrument,
        source: assessmentItems.source,
      }).from(assessmentItems).limit(10000);
      return Response.json({ itemCount: items.length, instruments: [...new Set(items.map((item) => item.instrument))] });
    }

    if (type === "assessment") {
      const mode = url.searchParams.get("form");
      if (mode !== "quick" && mode !== "full") {
        return Response.json({ error: "Unknown assessment form." }, { status: 400 });
      }
      const items = await db.select({
        id: assessmentItems.id,
        text: assessmentItems.text,
        domain: assessmentItems.domain,
        facet: assessmentItems.facet,
        reverseKeyed: assessmentItems.reverseKeyed,
      }).from(assessmentItems).where(eq(assessmentItems.instrument, assessmentInstrument(mode)));
      const form = createAssessmentForm(mode, items);
      if (!form) {
        return Response.json({ error: "The verified questions for this assessment are unavailable or incomplete." }, { status: 503 });
      }
      return Response.json(form, { headers: { "Cache-Control": "no-store" } });
    }

    if (type === "occupations") {
      const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
      const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
      const items = await db.select().from(occupations)
        .where(query ? or(ilike(occupations.title, pattern), ilike(occupations.code, pattern)) : undefined)
        .orderBy(asc(occupations.title)).limit(50);
      return Response.json({ items });
    }

    const code = url.searchParams.get("occupation") ?? "";
    if (!code || code.length > 100) {
      return Response.json({ error: "An occupation code is required." }, { status: 400 });
    }
    const items = await db.select().from(occupationRatings)
      .where(and(eq(occupationRatings.occupationCode, code), eq(occupationRatings.scaleId, "IM"), like(occupationRatings.elementId, "2.A.%")))
      .orderBy(desc(occupationRatings.value), asc(occupationRatings.elementName));
    return Response.json({ items });
  } catch {
    return Response.json({ error: "The imported data catalog is unavailable. Try again later." }, { status: 503 });
  }
}
