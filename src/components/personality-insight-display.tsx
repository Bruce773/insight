import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { getProfileInsight } from "@/lib/engine/personality-insights";
import type { AssessmentResult } from "@/lib/engine/assessment";

interface PersonalityProfile {
  characteristics: string[];
  workImplications: string[];
  description: string;
}

interface DetailsModalState {
  trait: string | null;
  characteristics: string[];
  workImplications: string[];
}

export function PersonalityInsightDisplay({ result }: { result: AssessmentResult }) {
  const [detailsModal, setDetailsModal] = useState<DetailsModalState>({ trait: null, characteristics: [], workImplications: [] });
  const [mounted, setMounted] = useState(false);
  const [gradientId, setGradientId] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setGradientId(`gradient-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  const openDetailsModal = (traitName: string, profile: PersonalityProfile) => {
    setDetailsModal({
      trait: traitName,
      characteristics: profile.characteristics,
      workImplications: profile.workImplications,
    });
  };

  const closeDetailsModal = () => {
    setDetailsModal({ trait: null, characteristics: [], workImplications: [] });
  };

  return (
    <div className="personality-insights">
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67965d" />
            <stop offset="100%" stopColor="#789e67" />
          </linearGradient>
        </defs>
      </svg>

      <section className="insights-intro">
        <p>
          Your personality traits show your natural tendencies. These insights help you understand what your responses
          reveal about how you work, interact, and approach challenges.
        </p>
      </section>

      <div className="traits-grid">
        {Object.entries(result.domains).map(([domainName, domainScore]) => {
          const profileData = getProfileInsight(domainName, domainScore.score);
          if (!profileData) return null;

          const { profile } = profileData;
          return (
            <article key={domainName} className="trait-card" onClick={() => openDetailsModal(domainName, profile)}>
              <div className="trait-circle">
                <svg viewBox="0 0 120 120" className="progress-ring">
                  <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#67965d" />
                      <stop offset="100%" stopColor="#789e67" />
                    </linearGradient>
                  </defs>
                  <circle cx="60" cy="60" r="54" className="progress-ring-bg" />
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    className="progress-ring-fill"
                    style={{
                      stroke: `url(#${gradientId})`,
                      strokeDasharray: `${2 * Math.PI * 54}`,
                      strokeDashoffset: `${2 * Math.PI * 54 * (1 - domainScore.score)}`,
                    }}
                  />
                </svg>
                <div className="circle-content">
                  <div className="percentage">{Math.round(domainScore.score * 100)}%</div>
                </div>
              </div>

              <div className="trait-details">
                <h4 style={{ margin: "16px 0 8px", fontSize: "16px", fontFamily: "Georgia, serif" }}>
                  {domainName}
                </h4>

                <p style={{ fontSize: "14px", lineHeight: "1.5", margin: "0 0 12px", color: "var(--muted)" }}>
                  {profile.description}
                </p>

                <button
                  onClick={() => openDetailsModal(domainName, profile)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--ink)",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: "pointer",
                    padding: 0,
                    textAlign: "center",
                    width: "100%",
                    textDecoration: "underline",
                  }}
                >
                  How this shows up
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {detailsModal.trait && mounted && createPortal(
        <div className="details-modal-overlay" onClick={closeDetailsModal}>
          <div className="details-modal" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "24px", fontFamily: "Georgia, serif", color: "var(--ink)" }}>
                {detailsModal.trait}
              </h3>
              <button
                onClick={closeDetailsModal}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "var(--muted)",
                  padding: "0 8px",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", marginBottom: "12px" }}>
                How you tend to show up
              </h4>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", lineHeight: "1.6", color: "var(--muted)" }}>
                {detailsModal.characteristics.map((char, idx) => (
                  <li key={idx} style={{ marginBottom: "8px" }}>
                    {char}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", marginBottom: "12px" }}>
                At work
              </h4>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", lineHeight: "1.6", color: "var(--muted)" }}>
                {detailsModal.workImplications.map((impl, idx) => (
                  <li key={idx} style={{ marginBottom: "8px" }}>
                    {impl}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>,
        document.body
      )}

      {Object.keys(result.facets).length > 0 && (
        <section style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "24px", fontFamily: "Georgia, serif", marginBottom: "12px" }}>
            Deeper look: Your facets
          </h2>
          <p style={{ color: "var(--muted)", marginBottom: "20px", fontSize: "14px" }}>
            Each trait has six facets. Here&apos;s a quick view of your profile:
          </p>

          <div className="facets-grid">
            {Object.entries(result.facets).map(([facetName, facetScore]) => (
              <div key={facetName} className="facet-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)", marginBottom: "4px" }}>
                    {facetName.split(":")[1]?.trim() || facetName}
                  </div>
                </div>
                <div style={{ width: "60px" }}>
                  <div
                    style={{
                      height: "6px",
                      background: "rgba(220, 229, 218, 0.5)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        background: "linear-gradient(90deg, #67965d 0%, #789e67 100%)",
                        width: `${facetScore.score * 100}%`,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="interpretation-guide">
        <h2 style={{ fontSize: "24px", fontFamily: "Georgia, serif", marginBottom: "14px" }}>
          Keep in mind
        </h2>
        <ul style={{ listStyle: "none", padding: 0, fontSize: "14px", color: "var(--ink)" }}>
          <li style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--line)" }}>
            <strong>Tendencies, not abilities.</strong> These show how you naturally tend to work and interact, not what
            you&apos;re capable of.
          </li>
          <li style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--line)" }}>
            <strong>Context matters.</strong> You might show different traits in different situations—home versus work,
            relaxed versus stressed.
          </li>
          <li style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid var(--line)" }}>
            <strong>No right answers.</strong> Every combination of traits has strengths. This is about understanding
            yourself better.
          </li>
          <li>
            <strong>One piece of the picture.</strong> Personality is just one part of career fit. Skills, interests,
            values, and experience matter too.
          </li>
        </ul>
      </section>
    </div>
  );
}
