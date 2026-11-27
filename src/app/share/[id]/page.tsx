"use client";

import { useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Roadmap, Duration } from "@/lib/engine/roadmap";
import { isRoadmap, isDuration } from "@/lib/engine/roadmap";

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
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ marginBottom: "40px" }}>
        <h1 style={{ marginTop: 0, marginBottom: "12px" }}>Shared Roadmap</h1>
        {duration && (
          <p style={{ fontSize: "14px", color: "#666", marginTop: 0 }}>
            Timeline: <strong>{duration.amount} {duration.unit}</strong>
          </p>
        )}
      </div>

      <div
        style={{
          padding: "32px",
          background: "rgba(255, 255, 255, 0.5)",
          border: "1px solid rgba(220, 229, 218, 0.5)",
          borderRadius: "12px",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "24px", fontSize: "24px" }}>
          Steps
        </h2>

        {roadmap.steps.length === 0 ? (
          <p style={{ color: "#999" }}>No steps in this roadmap yet.</p>
        ) : (
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
            {roadmap.steps.map((step, index) => (
              <li
                key={step.id}
                style={{
                  padding: "20px",
                  background: "rgba(255, 255, 255, 0.5)",
                  border: "1px solid rgba(220, 229, 218, 0.5)",
                  borderRadius: "10px",
                  borderLeft: "4px solid #669c5c",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "8px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#669c5c",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      flexShrink: 0,
                    }}
                  >
                    Step {index + 1}
                  </span>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{step.text}</h3>
                </div>
                {duration && (
                  <p style={{ fontSize: "14px", color: "#666", margin: "4px 0", overflowWrap: "anywhere" }}>
                    <strong>When:</strong> {duration.unit} {step.at}
                  </p>
                )}
                {step.notes && (
                  <p style={{ fontSize: "14px", color: "#666", margin: "4px 0", overflowWrap: "anywhere" }}>
                    <strong>Notes:</strong> {step.notes}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}

        {roadmap.skills.length > 0 && (
          <div style={{ marginTop: "40px", paddingTop: "24px", borderTop: "1px solid rgba(220, 229, 218, 0.5)" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Skills to focus on</h3>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
                gap: "12px",
              }}
            >
              {roadmap.skills.map((skill) => (
                <li
                  key={skill.id}
                  style={{
                    fontSize: "14px",
                    padding: "10px 12px",
                    background: "rgba(255, 255, 255, 0.6)",
                    border: "1px solid rgba(220, 229, 218, 0.4)",
                    borderRadius: "6px",
                    overflowWrap: "anywhere",
                  }}
                >
                  {skill.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

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
