import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assessmentResults,
  matches,
  profiles,
  responses,
  skillPlans,
  users,
} from "@/lib/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [results, userResponses, userProfiles, userMatches, userSkillPlans] =
    await Promise.all([
      db.select().from(assessmentResults).where(eq(assessmentResults.userId, userId)),
      db.select().from(responses).where(eq(responses.userId, userId)),
      db.select().from(profiles).where(eq(profiles.userId, userId)),
      db.select().from(matches).where(eq(matches.userId, userId)),
      db.select().from(skillPlans).where(eq(skillPlans.userId, userId)),
    ]);

  return Response.json(
    {
      user,
      assessmentResults: results,
      responses: userResponses,
      profiles: userProfiles,
      matches: userMatches,
      skillPlans: userSkillPlans,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="insight-data.json"',
      },
    },
  );
}
