import { ChevronIcon, EditIcon } from "@/components/icon";
import type { Duration, Roadmap } from "@/lib/engine/roadmap";
import "./roadmap-planner-step4.css";

export function RoadmapPreview({ roadmap, duration, onEditTimeline }: { roadmap: Roadmap; duration?: Duration; onEditTimeline?: () => void }) {
  return (
    <div className="roadmap-final-view">
      <div className="roadmap-final-header">
        <h2>Your Step-by-Step Plan</h2>
        {duration && <div className="duration-info"><strong>Timeline:</strong> {duration.amount} {duration.unit}
          {onEditTimeline && <button type="button" className="duration-edit" aria-label="Edit timeline" title="Edit timeline" onClick={onEditTimeline}><EditIcon /></button>}
        </div>}
      </div>
      {roadmap.steps.length === 0 ? <p>No steps in this roadmap yet.</p> : <>
        <p className="hint">Select a step to see its details.</p>
        <ol className="roadmap-final-steps">
          {roadmap.steps.map((step, index) => (
            <li key={step.id} className="roadmap-final-step">
              <details>
                <summary className="final-step-header">
                  <span className="step-number">Step {index + 1}</span>
                  <span className="final-step-title">{step.text}</span>
                  <ChevronIcon className="final-step-chevron" />
                </summary>
                {duration && <p className="step-timeline"><strong>When:</strong> {duration.unit} {step.at}</p>}
                {step.notes && <p className="step-notes"><strong>Notes:</strong> {step.notes}</p>}
                {!duration && !step.notes && <p className="step-notes">No details added.</p>}
              </details>
            </li>
          ))}
        </ol>
      </>}
      {roadmap.skills.length > 0 && <div className="roadmap-final-skills">
        <h3>Skills to focus on</h3>
        <ul className="skills-list">{roadmap.skills.map((skill) => <li key={skill.id}>{skill.name}</li>)}</ul>
      </div>}
    </div>
  );
}
