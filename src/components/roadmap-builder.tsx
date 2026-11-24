"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { RoadmapStepCard } from "@/components/roadmap-step-card";
import type { Duration, Roadmap, RoadmapSkill, RoadmapStep } from "@/lib/engine/roadmap";

export function RoadmapBuilder({ duration, roadmap, onChange }: {
  duration?: Duration;
  roadmap: Roadmap;
  onChange: (roadmap: Roadmap) => void;
}) {
  const [skillName, setSkillName] = useState("");
  const [stepText, setStepText] = useState("");
  const [stepAt, setStepAt] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after" } | null>(null);
  const [moveMessage, setMoveMessage] = useState("");
  const drag = useRef<{ pointerId: number; id: string; x: number; y: number; currentX: number; currentY: number; moved: boolean; target: { id: string; position: "before" | "after" } | null } | null>(null);
  const scrollFrame = useRef<number | null>(null);

  useEffect(() => () => {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
  }, []);

  function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }

  function updateStep(id: string, update: Partial<RoadmapStep>) {
    onChange({ ...roadmap, steps: roadmap.steps.map((step) => step.id === id ? { ...step, ...update } : step) });
  }

  function updateSkill(id: string, update: Partial<RoadmapSkill>) {
    onChange({ ...roadmap, skills: roadmap.skills.map((skill) => skill.id === id ? { ...skill, ...update } : skill) });
  }

  function startDrag(event: PointerEvent<HTMLSpanElement>, id: string) {
    if (!event.isPrimary || event.button !== 0 || drag.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, id, x: event.clientX, y: event.clientY, currentX: event.clientX, currentY: event.clientY, moved: false, target: null };
  }

  function updateDragTarget() {
    const active = drag.current;
    if (!active) return;
    const element = document.elementFromPoint(active.currentX, active.currentY)?.closest<HTMLElement>("[data-roadmap-step-id]");
    const id = element?.dataset.roadmapStepId;
    const bounds = element?.getBoundingClientRect();
    const target = element && id && id !== active.id
      ? { id, position: bounds && active.currentY < bounds.top + bounds.height / 2 ? "before" as const : "after" as const }
      : null;
    active.target = target;
    setDropTarget((current) => current?.id === target?.id && current?.position === target?.position ? current : target);
  }

  function moveDrag(event: PointerEvent<HTMLSpanElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    active.currentX = event.clientX;
    active.currentY = event.clientY;
    if (!active.moved && Math.hypot(event.clientX - active.x, event.clientY - active.y) < 6) return;
    if (!active.moved) {
      active.moved = true;
      setDraggingId(active.id);
      const scroll = () => {
        const current = drag.current;
        if (!current?.moved) return;
        if (current.currentY < 120) window.scrollBy(0, -12);
        else if (current.currentY > window.innerHeight - 80) window.scrollBy(0, 12);
        updateDragTarget();
        scrollFrame.current = requestAnimationFrame(scroll);
      };
      scrollFrame.current = requestAnimationFrame(scroll);
    }
    updateDragTarget();
  }

  function endDrag(event: PointerEvent<HTMLSpanElement>, cancelled: boolean) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
    setDraggingId(null);
    setDropTarget(null);
    if (cancelled || !active.moved || !active.target) return;
    const from = roadmap.steps.findIndex((step) => step.id === active.id);
    const steps = [...roadmap.steps];
    if (from < 0) return;
    const [item] = steps.splice(from, 1);
    const targetIndex = steps.findIndex((step) => step.id === active.target?.id);
    if (targetIndex < 0) return;
    const destination = targetIndex + (active.target.position === "after" ? 1 : 0);
    steps.splice(destination, 0, item);
    if (destination === from) return;
    onChange({ ...roadmap, steps });
    setMoveMessage(`${item.text.trim() || "Step"} moved to position ${destination + 1} of ${steps.length}.`);
  }

  return <section aria-labelledby="roadmap-heading">
    <div className="divider" />
    <div className="eyebrow">YOUR ROADMAP</div>
    <h2 id="roadmap-heading">Make a plan that feels like yours.</h2>
    <p>Choose your priorities, then add steps at a pace that works for you. This is a plan to revisit, not a prediction.</p>
    {duration ? <div className="roadmap-horizon"><strong>Your timeline</strong><span>{duration.amount} {duration.unit}</span></div> :
      <div className="notice">Choose an exact duration on the Aspirations step to generate a timed roadmap. You can still add your own skills and steps here.</div>}

    <h3>Skills to prioritize</h3>
    <p className="hint">The order is your choice. Move skills up or down to change their priority.</p>
    {roadmap.skills.length > 0 ? <ol className="roadmap-list">{roadmap.skills.map((skill, index) => <li className="roadmap-item" key={skill.id}>
      <div className="roadmap-item-body"><strong>#{index + 1} {skill.name}</strong>{skill.review && <span className="roadmap-review">Review after changes</span>}</div>
      <div className="roadmap-controls">
        <button type="button" className="text-button" disabled={index === 0} onClick={() => onChange({ ...roadmap, skills: move(roadmap.skills, index, -1) })} aria-label={`Move ${skill.name} up`}>↑</button>
        <button type="button" className="text-button" disabled={index === roadmap.skills.length - 1} onClick={() => onChange({ ...roadmap, skills: move(roadmap.skills, index, 1) })} aria-label={`Move ${skill.name} down`}>↓</button>
        {skill.review && <button type="button" className="text-button" onClick={() => updateSkill(skill.id, { review: false })}>Reviewed</button>}
        <button type="button" className="text-button" onClick={() => onChange({ ...roadmap, skills: roadmap.skills.filter((item) => item.id !== skill.id) })} aria-label={`Remove ${skill.name}`}>Remove</button>
      </div>
    </li>)}</ol> : <p className="hint">Add your own skills or choose from the AI ideas below.</p>}
    <form className="roadmap-add" onSubmit={(event) => {
      event.preventDefault();
      const name = skillName.trim();
      if (!name || roadmap.skills.length >= 100) return;
      onChange({ ...roadmap, skills: [...roadmap.skills, { id: crypto.randomUUID(), name, source: "user" }] });
      setSkillName("");
    }}>
      <label htmlFor="roadmap-skill">Add a skill of your own</label>
      <div className="roadmap-input-row"><input id="roadmap-skill" maxLength={200} value={skillName} onChange={(event) => setSkillName(event.target.value)} placeholder="A skill you want to develop" /><button className="primary" type="submit" disabled={!skillName.trim() || roadmap.skills.length >= 100}>Add skill</button></div>
    </form>

    <h3>Your steps</h3>
    <p className="hint">{duration ? `Place steps within your ${duration.amount}-${duration.unit} timeline.` : "Add steps now and choose their timing after setting a duration."} Drag a handle to reorder, or open a step to use the move buttons.</p>
    <p className="sr-only" aria-live="polite">{moveMessage}</p>
    {roadmap.steps.length > 0 ? <ol className="roadmap-list">{roadmap.steps.map((step, index) => <RoadmapStepCard key={step.id} step={step} index={index} count={roadmap.steps.length} duration={duration}
      dragging={draggingId === step.id} dropPosition={dropTarget?.id === step.id ? dropTarget.position : undefined}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerEnd={endDrag}
      onUpdate={(update) => updateStep(step.id, update)}
      onMove={(direction) => {
        onChange({ ...roadmap, steps: move(roadmap.steps, index, direction) });
        setMoveMessage(`${step.text.trim() || "Step"} moved to position ${index + direction + 1} of ${roadmap.steps.length}.`);
      }}
      onRemove={() => onChange({ ...roadmap, steps: roadmap.steps.filter((item) => item.id !== step.id) })} />)}</ol> : <p className="hint">Your roadmap is empty. Add a step or request local AI suggestions below.</p>}
    <form className="roadmap-add" onSubmit={(event) => {
      event.preventDefault();
      const text = stepText.trim();
      if (!text || roadmap.steps.length >= 100 || (duration && stepAt > duration.amount)) return;
      onChange({ ...roadmap, steps: [...roadmap.steps, { id: crypto.randomUUID(), text, at: stepAt, source: "user" }] });
      setStepText("");
    }}>
      <label htmlFor="roadmap-new-step">Add your own step</label>
      <textarea id="roadmap-new-step" maxLength={500} value={stepText} onChange={(event) => setStepText(event.target.value)} placeholder="What would you like to do?" />
      {duration && <><label htmlFor="roadmap-new-time">When ({duration.unit})</label><input id="roadmap-new-time" className="roadmap-time" type="number" min="1" max={duration.amount} value={stepAt} onChange={(event) => setStepAt(Number(event.target.value))} /></>}
      <div className="actions"><button className="primary" type="submit" disabled={!stepText.trim() || roadmap.steps.length >= 100 || !Number.isInteger(stepAt) || stepAt < 1 || !!duration && stepAt > duration.amount}>Add step</button></div>
    </form>
  </section>;
}
