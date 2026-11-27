import { isDuration, isRoadmap } from "@/lib/engine/roadmap";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roadmap, duration } = body;

    if (!isRoadmap(roadmap)) {
      return Response.json(
        { error: "Invalid roadmap data" },
        { status: 400 }
      );
    }

    if (duration && !isDuration(duration)) {
      return Response.json(
        { error: "Invalid duration data" },
        { status: 400 }
      );
    }

    // Generate a unique ID for the shared roadmap
    const shareId = crypto.getRandomValues(new Uint8Array(12));
    const shareToken = Array.from(shareId)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // In a production environment, you would store this in a database
    // For now, we'll encode it in the URL as a simple solution
    const shareData = encodeURIComponent(
      JSON.stringify({ roadmap, duration })
    );

    const link = `${new URL(request.url).origin}/share/${shareToken}?data=${shareData}`;

    return Response.json({ link, id: shareToken });
  } catch {
    return Response.json(
      { error: "Failed to generate share link" },
      { status: 500 }
    );
  }
}
