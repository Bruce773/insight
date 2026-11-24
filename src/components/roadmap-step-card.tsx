"use client";

import { useRef, useState, type PointerEvent } from "react";
import { ChevronIcon, EditIcon, GripIcon } from "@/components/icon";
import type { Duration, RoadmapStep } from "@/lib/engine/roadmap";

type Props = {
  step: RoadmapStep;
  index: number;
  count: number;
  duration?: Duration;
  dragging: boolean;
  dropPosition?: "before" | "after";
  onPointerDown: (event: PointerEvent<HTMLSpanElement>, id: string) => void;
  onPointerMove: (event: PointerEvent<HTMLSpanElement>) => void;
  onPointerEnd: (event: PointerEvent<HTMLSpanElement>, cancelled: boolean) => void;
  onUpdate: (update: Partial<RoadmapStep>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

export function RoadmapStepCard({ step, index, count, duration, dragging, dropPosition, onPointerDown, onPointerMove, onPointerEnd, onUpdate, onMove, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(step.text);
  const [when, setWhen] = useState(String(step.at));
  const [notes, setNotes] = useState(step.notes ?? "");
  const editButton = useRef<HTMLButtonElement>(null);
  const stepName = step.text.trim() || `Step ${index + 1}`;
  const outsideTimeline = !!duration && step.at > duration.amount;

  function startEditing() {
    setTitle(step.text);
    setWhen(String(step.at));
    setNotes(step.notes ?? "");
    setEditing(true);
  }

  function finishEditing() {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  return <li className="roadmap-step" data-roadmap-step-id={step.id} data-dragging={dragging || undefined} data-drop-position={dropPosition}>
    {editing ? <form className="roadmap-step-edit" onSubmit={(event) => {
      event.preventDefault();
      const at = Number(when);
      if (!title.trim() || !Number.isInteger(at) || at < 1 || at > 1000) return;
      onUpdate({ text: title.trim(), at, notes });
      finishEditing();
    }}>
      <div className="roadmap-step-header"><strong>Edit step {index + 1}</strong></div>
      <label htmlFor={`step-title-${step.id}`}>Step title</label>
      <input id={`step-title-${step.id}`} value={title} maxLength={500} required autoFocus onChange={(event) => setTitle(event.target.value)} />
      <label htmlFor={`step-time-${step.id}`}>When ({duration?.unit ?? "timeline unit"})</label>
      <input id={`step-time-${step.id}`} className="roadmap-time" type="number" min="1" max="1000" required value={when} onChange={(event) => setWhen(event.target.value)} />
      {duration && Number(when) > duration.amount && <p className="roadmap-review" role="status">This step is outside your timeline. Adjust its timing.</p>}
      {!duration && <p className="hint">Choose a duration on the Aspirations step to set the timeline unit.</p>}
      <label htmlFor={`step-notes-${step.id}`}>Notes <span className="optional">optional</span></label>
      <textarea id={`step-notes-${step.id}`} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add details, resources, or reminders." />
      <div className="actions">
        <button className="primary" type="submit" disabled={!title.trim() || !Number.isInteger(Number(when)) || Number(when) < 1 || Number(when) > 1000}>Save changes</button>
        <button className="text-button" type="button" onClick={finishEditing}>Cancel</button>
      </div>
    </form> : <>
      <div className="roadmap-step-summary">
        <span className="roadmap-drag-handle" aria-hidden="true" onPointerDown={(event) => onPointerDown(event, step.id)} onPointerMove={onPointerMove} onPointerUp={(event) => onPointerEnd(event, false)} onPointerCancel={(event) => onPointerEnd(event, true)} onLostPointerCapture={(event) => onPointerEnd(event, true)}><GripIcon /></span>
        <button type="button" className="roadmap-step-toggle" aria-expanded={expanded} aria-controls={`step-details-${step.id}`} onClick={() => setExpanded(!expanded)}>
          <span className="roadmap-step-title"><span className="roadmap-step-number">STEP {index + 1}</span><strong>{stepName}</strong>{duration && <span className="hint">{duration.unit} {step.at}</span>}{(step.review || outsideTimeline) && <span className="roadmap-review">{outsideTimeline ? "Outside timeline" : "Needs review"}</span>}</span>
          <ChevronIcon className={expanded ? "roadmap-chevron expanded" : "roadmap-chevron"} />
        </button>
        <button ref={editButton} type="button" className="roadmap-icon-button" aria-label={`Edit ${stepName}`} title="Edit step" onClick={startEditing}><EditIcon /></button>
      </div>
      <div id={`step-details-${step.id}`} className="roadmap-step-details" hidden={!expanded}>
        {step.review && <p className="roadmap-review">Review after changes</p>}
        {outsideTimeline && <p role="status" className="roadmap-review">This step is outside your timeline. Adjust its timing.</p>}
        <p><strong>When:</strong> {duration ? `${duration.unit} ${step.at}` : `Timeline unit ${step.at} (set a duration to choose units)`}</p>
        <p><strong>Notes:</strong> <span className="roadmap-notes">{step.notes?.trim() ? step.notes : "No notes yet."}</span></p>
        <div className="roadmap-controls">
          <button type="button" className="text-button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move step ${index + 1} up`}>↑ Move up</button>
          <button type="button" className="text-button" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move step ${index + 1} down`}>↓ Move down</button>
          {step.review && <button type="button" className="text-button" onClick={() => onUpdate({ review: false })}>Reviewed</button>}
          <button type="button" className="text-button" onClick={onRemove} aria-label={`Remove step ${index + 1}`}>Remove</button>
        </div>
      </div>
    </>}
  </li>;
}
