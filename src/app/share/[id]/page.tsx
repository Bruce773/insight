"use client";

import { useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Roadmap, Duration } from "@/lib/engine/roadmap";
import { isRoadmap, isDuration } from "@/lib/engine/roadmap";
import { RoadmapPreview } from "@/components/roadmap-preview";

function SharePageContent() {
  const searchParams = useSearchParams();
  const data = useMemo(() => {
    try {
      const dataParam = searchParams.get("data");
      if (!dataParam) return null;

      const decoded = JSON.parse(dataParam);
      if (!isRoadmap(decoded.roadmap) || (decoded.duration && !isDuration(decoded.duration))) {
        return null;
      }

      return decoded as { roadmap: Roadmap; duration?: Duration };
    } catch {
      return null;
    }
  }, [searchParams]);

  if (!data) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <h1>Roadmap not found</h1>
        <p>This roadmap link may have expired or is invalid.</p>
        <Link href="/" style={{ color: "#669c5c", textDecoration: "underline" }}>
          Create your own roadmap →
        </Link>
      </div>
    );
  }

  const { roadmap, duration } = data;

  return (
    <main style={{ width: "100%", maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ marginBottom: "40px" }}>
        <h1 style={{ marginTop: 0, marginBottom: "12px" }}>Shared Roadmap</h1>
      </div>

      <RoadmapPreview roadmap={roadmap} duration={duration} />

      <div style={{ marginTop: "32px", textAlign: "center" }}>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "#669c5c",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Create your own roadmap →
        </Link>
      </div>
    </main>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <p>Loading roadmap...</p>
        </div>
      }
    >
      <SharePageContent />
    </Suspense>
  );
}
