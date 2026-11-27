"use client";

import { useState } from "react";
import type { AssessmentResult } from "@/lib/engine/assessment";
import type { Duration, Roadmap } from "@/lib/engine/roadmap";
import { RoadmapPlannerStep1 } from "./roadmap-planner-step1";
import { RoadmapPlannerStep2 } from "./roadmap-planner-step2";
import { RoadmapPlannerStep3 } from "./roadmap-planner-step3";
import { RoadmapPlannerStep4 } from "./roadmap-planner-step4";

export type RoadmapPlannerMode = "generate" | "manual";

export function RoadmapPlanner({
  duration,
  roadmap,
  assessment,
  aspiration,
  currentSkills,
  occupation,
  ideaFocus,
  onFocus,
  onChange,
  onChangeDuration,
  onSetDuration,
  onBack,
}: {
  duration?: Duration;
  roadmap: Roadmap;
  assessment?: AssessmentResult;
  aspiration: string;
  currentSkills: string;
  occupation?: { code: string; title: string };
  ideaFocus?: string;
  onFocus: (skill: string) => void;
  onChange: (roadmap: Roadmap) => void;
  onChangeDuration: (duration: Duration) => void;
  onSetDuration: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<RoadmapPlannerMode | "final" | null>(null);
  const [visitedGeneration, setVisitedGeneration] = useState(false);
  const [editTimeline, setEditTimeline] = useState(false);

  function selectMode(next: RoadmapPlannerMode) {
    if (next === "generate") setVisitedGeneration(true);
    setMode(next);
  }

  if (!mode) {
    return (
      <RoadmapPlannerStep1
        onSelectMode={selectMode}
        onBack={onBack}
      />
    );
  }

  return (
    <>
      {visitedGeneration && <div hidden={mode !== "generate"}>
        <RoadmapPlannerStep2
          key={JSON.stringify([duration, assessment, aspiration, currentSkills, occupation])}
          duration={duration}
          roadmap={roadmap}
          assessment={assessment}
          aspiration={aspiration}
          currentSkills={currentSkills}
          occupation={occupation}
          onChange={onChange}
          onSetDuration={onSetDuration}
          onBack={() => setMode(null)}
          onContinue={() => setMode("manual")}
        />
      </div>}
      {mode === "manual" && <RoadmapPlannerStep3
        duration={duration}
        roadmap={roadmap}
        aspiration={aspiration}
        currentSkills={currentSkills}
        assessment={assessment}
        focus={ideaFocus}
        onFocus={onFocus}
        onChange={onChange}
        onChangeDuration={onChangeDuration}
        editTimeline={editTimeline}
        onSetDuration={onSetDuration}
        onBack={() => setMode(null)}
        onGenerate={() => selectMode("generate")}
        onViewFinal={() => { setEditTimeline(false); setMode("final"); }}
      />}
      {mode === "final" && <RoadmapPlannerStep4
        roadmap={roadmap}
        duration={duration}
        onBack={() => { setEditTimeline(false); setMode("manual"); }}
        onEditTimeline={() => { setEditTimeline(true); setMode("manual"); }}
      />}
    </>
  );
}
