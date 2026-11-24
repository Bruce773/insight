"use client";

import { useState } from "react";
import type { Duration, Roadmap, RoadmapSkill, RoadmapStep } from "@/lib/engine/roadmap";

export function RoadmapBuilder({ duration, roadmap, onChange }: {
  duration?: Duration;
  roadmap: Roadmap;
  onChange: (roadmap: Roadmap) => void;
}) {
  const [skillName, setSkillName] = useState("");
  const [stepText, setStepText] = useState("");
  const [stepAt, setStepAt] = useState(1);

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
    <p className="hint">{duration ? `Place steps within your ${duration.amount}-${duration.unit} timeline. You can change them at any time.` : "Add steps now and choose their timing after setting a duration."}</p>
    {roadmap.steps.length > 0 ? <ol className="roadmap-list">{roadmap.steps.map((step, index) => <li className="roadmap-step" key={step.id}>
      <div className="roadmap-step-header"><strong>Step {index + 1}</strong>{step.review && <span className="roadmap-review">Review after changes</span>}</div>
      <label htmlFor={`step-${step.id}`}>Action</label>
      <textarea id={`step-${step.id}`} maxLength={500} value={step.text} onChange={(event) => updateStep(step.id, { text: event.target.value })} />
      {duration && <><label htmlFor={`step-time-${step.id}`}>When ({duration.unit})</label><input id={`step-time-${step.id}`} className="roadmap-time" type="number" min="1" max={duration.amount} value={step.at} onChange={(event) => {
        const at = Number(event.target.value);
        if (Number.isInteger(at) && at >= 1 && at <= 1000) updateStep(step.id, { at });
      }} />{step.at > duration.amount && <p role="status" className="roadmap-review">This step is outside your timeline. Adjust its timing.</p>}</>}
      <div className="roadmap-controls">
        <button type="button" className="text-button" disabled={index === 0} onClick={() => onChange({ ...roadmap, steps: move(roadmap.steps, index, -1) })} aria-label={`Move step ${index + 1} up`}>Move up</button>
        <button type="button" className="text-button" disabled={index === roadmap.steps.length - 1} onClick={() => onChange({ ...roadmap, steps: move(roadmap.steps, index, 1) })} aria-label={`Move step ${index + 1} down`}>Move down</button>
        {step.review && <button type="button" className="text-button" onClick={() => updateStep(step.id, { review: false })}>Reviewed</button>}
        <button type="button" className="text-button" onClick={() => onChange({ ...roadmap, steps: roadmap.steps.filter((item) => item.id !== step.id) })} aria-label={`Remove step ${index + 1}`}>Remove</button>
      </div>
    </li>)}</ol> : <p className="hint">Your roadmap is empty. Add a step or request local AI suggestions below.</p>}
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
