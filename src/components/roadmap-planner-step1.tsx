"use client";

import { SparklesIcon, PencilIcon, ChevronIcon } from "@/components/icon";
import "./roadmap-planner-step1.css";

export function RoadmapPlannerStep1({
  onSelectMode,
  onBack,
}: {
  onSelectMode: (mode: "generate" | "manual") => void;
  onBack: () => void;
}) {
  return (
    <div className="roadmap-planner-wrapper">
      <div className="roadmap-planner-step1">
        <div className="eyebrow">04 / YOUR NEXT CHAPTER</div>
        <h1>Build your roadmap</h1>
        <p className="lead">
          Choose how to create a step-by-step plan. You can edit it at any time.
        </p>

        <div className="roadmap-mode-cards">
          <button
            type="button"
            className="roadmap-mode-card"
            onClick={() => onSelectMode("generate")}
          >
            <div className="card-header">
              <div className="card-icon generate-icon">
                <SparklesIcon />
              </div>
              <h3>Generate My Plan</h3>
            </div>
            <p className="card-description">
              We&apos;ll analyze your personality, goals, and skills to create AI-suggested steps
            </p>
            <div className="card-features">
              <span className="feature-badge">Uses personality assessment</span>
              <span className="feature-badge">Uses your aspirations</span>
              <span className="feature-badge">Uses your skills</span>
            </div>
            <div className="card-cta">
              Continue <ChevronIcon />
            </div>
          </button>

          <button
            type="button"
            className="roadmap-mode-card"
            onClick={() => onSelectMode("manual")}
          >
            <div className="card-header">
              <div className="card-icon manual-icon">
                <PencilIcon />
              </div>
              <h3>Manually Build My Plan</h3>
            </div>
            <p className="card-description">
              Create your own steps from scratch and customize every detail
            </p>
            <div className="card-features">
              <span className="feature-badge">Full control</span>
              <span className="feature-badge">Start empty</span>
              <span className="feature-badge">Drag &amp; drop editing</span>
            </div>
            <div className="card-cta">
              Continue <ChevronIcon />
            </div>
          </button>
        </div>

        <div className="actions">
          <button className="text-button" onClick={onBack}>
            Back to skills
          </button>
        </div>
      </div>
    </div>
  );
}
