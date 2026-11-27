"use client";

import type { Duration, Roadmap } from "@/lib/engine/roadmap";
import { RoadmapBuilder } from "@/components/roadmap-builder";
import { LocalIdeas } from "@/components/local-ideas";
import type { AssessmentResult } from "@/lib/engine/assessment";
import "./roadmap-planner-step3.css";

export function RoadmapPlannerStep3({
  duration,
  roadmap,
  aspiration,
  currentSkills,
  assessment,
  focus,
  onFocus,
  onChange,
  onChangeDuration,
  editTimeline,
  onSetDuration,
  onBack,
  onGenerate,
  onViewFinal,
}: {
  duration?: Duration;
  roadmap: Roadmap;
  aspiration: string;
  currentSkills: string;
  assessment?: AssessmentResult;
  focus?: string;
  onFocus: (skill: string) => void;
  onChange: (roadmap: Roadmap) => void;
  onChangeDuration: (duration: Duration) => void;
  editTimeline: boolean;
  onSetDuration: () => void;
  onBack: () => void;
  onGenerate: () => void;
  onViewFinal: () => void;
}) {
  return (
    <div className="roadmap-planner-wrapper">
      <div className="roadmap-planner-step3">
        <div className="eyebrow">04 / YOUR NEXT CHAPTER</div>
        <h1>Customize your roadmap</h1>
        <p className="lead">
          Drag and drop to reorder, edit timing, add notes, or remove steps. Everything is editable.
        </p>

        <div className="roadmap-planner-editor">
          <div className="roadmap-editor-container">
            <RoadmapBuilder
              duration={duration}
              roadmap={roadmap}
              onChange={onChange}
              onChangeDuration={onChangeDuration}
              editTimeline={editTimeline}
              onSetDuration={onSetDuration}
            />
          </div>
          <details className="roadmap-disclosure">
            <summary>Optional AI skill ideas</summary>
            <LocalIdeas
              key={JSON.stringify([aspiration, currentSkills, assessment])}
              aspiration={aspiration}
              currentSkills={currentSkills}
              assessment={assessment}
              focus={focus}
              onFocus={onFocus}
              roadmap={roadmap}
              onAddSkill={(name) => {
                if (!roadmap.skills.some((skill) => skill.name === name) && roadmap.skills.length < 100) {
                  onChange({ ...roadmap, skills: [...roadmap.skills, { id: crypto.randomUUID(), name, source: "ai" }] });
                }
              }}
            />
          </details>
        </div>

        <div className="actions">
          <button
            type="button"
            className="primary"
            onClick={onViewFinal}
          >
            Continue to final roadmap →
          </button>
          <button type="button" className="text-button" onClick={onGenerate}>
            Generate more steps
          </button>
          <button type="button" className="text-button" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
