"use client";

import { useEffect, useRef, useState } from "react";
import {
  ASSESSMENT_OPTIONS,
  scoreAssessment,
  type AssessmentForm,
  type AssessmentMode,
  type AssessmentResult,
} from "@/lib/engine/assessment";
import type { ScaleResult } from "@/lib/engine";

function isAssessmentForm(value: unknown, mode: AssessmentMode): value is AssessmentForm {
  if (!value || typeof value !== "object") return false;
  const form = value as Partial<AssessmentForm>;
  if (form.mode !== mode || form.instrument !== (mode === "quick" ? "Mini-IPIP" : "IPIP-NEO-120") ||
      !Array.isArray(form.items) || form.items.length !== (mode === "quick" ? 20 : 120)) return false;
  return new Set(form.items.map((item) => item?.id)).size === form.items.length &&
    form.items.every((item) => item && typeof item.id === "string" && item.id &&
      typeof item.text === "string" && item.text && typeof item.domain === "string" && item.domain &&
      (item.facet === null || typeof item.facet === "string") && typeof item.reverseKeyed === "boolean");
}

function isScaleMap(value: unknown): value is Record<string, ScaleResult> {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    Object.values(value).every((item) => item && typeof item === "object" &&
      Number.isFinite(item.rawScore) && Number.isFinite(item.score) &&
      item.score >= 0 && item.score <= 1 && Number.isInteger(item.count) && item.count > 0);
}

export function isAssessmentResult(value: unknown): value is AssessmentResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<AssessmentResult>;
  return (result.instrument === "Mini-IPIP" || result.instrument === "IPIP-NEO-120") &&
    !!result.responses && typeof result.responses === "object" && !Array.isArray(result.responses) &&
    Object.values(result.responses).every((answer) => Number.isInteger(answer) && answer >= 1 && answer <= 5) &&
    isScaleMap(result.domains) && isScaleMap(result.facets);
}

export function AssessmentScores({ result }: { result: AssessmentResult }) {
  return (
    <div>
      <h2>Your personality traits</h2>
      <p>Your scores reflect your answers; they are not percentiles or occupation matches.</p>
      <ul className="reflection-list">
        {Object.entries(result.domains).map(([name, score]) => <li key={name}><span>{name}</span><strong>{score.rawScore} / {score.count * 5}</strong></li>)}
      </ul>
      {Object.keys(result.facets).length > 0 && <details>
        <summary>View more personality traits</summary>
        <ul className="reflection-list">
          {Object.entries(result.facets).map(([name, score]) => <li key={name}><span>{name}</span><strong>{score.rawScore} / {score.count * 5}</strong></li>)}
        </ul>
      </details>}
    </div>
  );
}

export function AssessmentFlow({ result, onComplete, onSkip, onContinue, onBack }: {
  result?: AssessmentResult;
  onComplete: (result: AssessmentResult) => void;
  onSkip: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState<AssessmentForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const questionRef = useRef<HTMLLegendElement>(null);
  const navigatingAnswers = useRef(false);

  useEffect(() => {
    if (form) questionRef.current?.focus();
  }, [form, index]);

  async function start(mode: AssessmentMode) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/assessment/catalog?type=assessment&form=${mode}`, { cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error : "The assessment is unavailable.";
        throw new Error(message);
      }
      if (!isAssessmentForm(data, mode)) throw new Error("The assessment data is incomplete or invalid.");
      setAnswers({});
      setIndex(0);
      setForm(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "The assessment is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function finish() {
    if (!form) return;
    try {
      onComplete(scoreAssessment(form, answers));
      setForm(null);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "The assessment could not be scored.");
    }
  }

  const question = form?.items[index];
  const answered = question ? Object.prototype.hasOwnProperty.call(answers, question.id) : false;
  return (
    <>
      <div className="eyebrow">01 / GET TO KNOW YOURSELF</div>
      <h1>Start with reflection.</h1>
      {question && form ? <>
        <p className="lead">Describe yourself as you generally are now. Choose how accurately each statement describes you.</p>
        <p className="hint" role="status">Question {index + 1} of {form.items.length}</p>
        <p className="hint">{index === form.items.length - 1
          ? "Choose an answer, then select See assessment results."
          : "Click an answer to continue. With a keyboard, use arrow keys to choose, then Space or Next."}</p>
        <fieldset className="assessment-question"
          onKeyDown={(event) => {
            if (event.key.startsWith("Arrow")) navigatingAnswers.current = true;
            if (event.key === " " && event.target instanceof HTMLInputElement && event.target.checked && index < form.items.length - 1) {
              event.preventDefault();
              setIndex(index + 1);
            }
          }}
          onKeyUp={(event) => { if (event.key.startsWith("Arrow")) navigatingAnswers.current = false; }}>
          <legend ref={questionRef} tabIndex={-1}>{question.text}</legend>
          {ASSESSMENT_OPTIONS.map((option) => <label key={option.value} className="assessment-option">
            <input type="radio" name={`assessment-${question.id}`} value={option.value} checked={answers[question.id] === option.value}
              onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.value }))}
              onClick={() => { if (!navigatingAnswers.current && index < form.items.length - 1) setIndex(index + 1); }} />
            <span>{option.label}</span>
          </label>)}
        </fieldset>
        <div className="actions">
          {index === form.items.length - 1
            ? <button className="primary" disabled={!answered} onClick={finish}>See assessment results →</button>
            : <button className="primary" disabled={!answered} onClick={() => setIndex(index + 1)}>Next question →</button>}
          <button className="text-button" onClick={() => index ? setIndex(index - 1) : setForm(null)}>{index ? "Previous question" : "Choose another assessment"}</button>
        </div>
      </> : <>
        {result ? <><AssessmentScores result={result} /><div className="actions"><button className="primary" onClick={onContinue}>Continue to aspirations →</button></div><p>Or choose another assessment:</p></> :
          <p className="lead">Choose a personality assessment, or continue without one.</p>}
        <div className="cards">
          <button className="choice" disabled={loading} onClick={() => start("quick")}><span className="tag">QUICK</span><strong>Quick assessment</strong><span>20 questions</span><span className="arrow">Start →</span></button>
          <button className="choice" disabled={loading} onClick={() => start("full")}><span className="tag">FULL</span><strong>Full assessment</strong><span>120 questions</span><span className="arrow">Start →</span></button>
        </div>
        <p className="hint">Your answers stay on this page until you sign in and save your plan.</p>
        {loading && <p className="hint" role="status">Loading assessment…</p>}
        <div className="actions"><button className="primary" disabled={loading} onClick={onSkip}>Continue without assessment →</button><button className="text-button" disabled={loading} onClick={onBack}>Back</button></div>
      </>}
      {error && <div className="notice" role="alert">{error}</div>}
    </>
  );
}
