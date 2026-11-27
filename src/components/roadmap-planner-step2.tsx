"use client";

import { useEffect, useRef, useState } from "react";
import { parseStepSuggestions, type Duration, type Roadmap, type StepSuggestion } from "@/lib/engine/roadmap";
import { ideaTraits } from "@/lib/engine/aspiration-ideas";
import { modelManager, type ModelDownloadProgress } from "@/lib/local-model-manager";
import { CheckIcon, SparklesIcon } from "@/components/icon";
import "./roadmap-planner-step2.css";
import type { AssessmentResult } from "@/lib/engine/assessment";

export function RoadmapPlannerStep2({
  duration,
  roadmap,
  assessment,
  aspiration,
  currentSkills,
  occupation,
  onChange,
  onSetDuration,
  onBack,
  onContinue,
}: {
  duration?: Duration;
  roadmap: Roadmap;
  assessment?: AssessmentResult;
  aspiration: string;
  currentSkills: string;
  occupation?: { code: string; title: string };
  onChange: (roadmap: Roadmap) => void;
  onSetDuration: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [suggestions, setSuggestions] = useState<StepSuggestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modelDownload, setModelDownload] = useState<ModelDownloadProgress>({ status: "not-started", progress: 0 });
  const [modelCached, setModelCached] = useState(false);
  const [acceptedSteps, setAcceptedSteps] = useState<Set<number>>(new Set());
  const [removingModel, setRemovingModel] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const request = useRef(0);
  const worker = useRef<Worker | null>(null);

  useEffect(() => {
    const requestCounter = request;
    const unsubscribe = modelManager.onProgress((progress) => {
      setModelDownload(progress);
      if (progress.status === "completed") setModelCached(true);
      if (progress.status === "not-started") setModelCached(false);
    });

    modelManager.isModelCached().then(setModelCached).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not check the local model.");
    });

    return () => {
      unsubscribe();
      requestCounter.current++;
      worker.current?.terminate();
    };
  }, []);

  function cancel() {
    request.current++;
    worker.current?.terminate();
    worker.current = null;
    setGenerating(false);
    setMessage("Generation cancelled.");
  }

  async function generateSteps() {
    setError("");
    setMessage("");
    if (!aspiration.trim()) {
      setError("Add an aspiration before generating steps.");
      return;
    }
    if (!duration) {
      setError("Set a roadmap duration on the Aspirations step first.");
      return;
    }
    if (aspiration.length > 1000 || currentSkills.length > 1000) {
      setError("Keep your aspiration and current skills to 1,000 characters each for local generation.");
      return;
    }
    if (JSON.stringify({ skills: roadmap.skills, steps: roadmap.steps.map(({ id, text, at }) => ({ id, text, at })) }).length > 12000) {
      setError("Your roadmap is too long for local generation. Continue editing manually or remove some items before requesting suggestions.");
      return;
    }

    if (!("gpu" in navigator) || !navigator.gpu) {
      setError("WebGPU is unavailable. Try a WebGPU-enabled browser on a supported device.");
      return;
    }

    const id = ++request.current;
    setGenerating(true);
    setError("");
    setSuggestions([]);
    setAcceptedSteps(new Set());
    setMessage("Checking device support…");

    try {
      if (typeof navigator.gpu !== "object" || !navigator.gpu ||
          !("requestAdapter" in navigator.gpu) || typeof navigator.gpu.requestAdapter !== "function" ||
          !await navigator.gpu.requestAdapter()) {
        throw new Error("No compatible WebGPU adapter is available on this device.");
      }

      if (id !== request.current) return;

      const existingStepTexts = new Set(roadmap.steps.map((s) => s.text.toLocaleLowerCase().replace(/\s+/g, " ").trim()));
      const traits = ideaTraits(assessment);
      const roadmapContext = {
        skills: roadmap.skills,
        steps: roadmap.steps.map(({ id, text, at }) => ({ id, text, at })),
      };

      setMessage("Starting the local model…");
      const instance = new Worker(new URL("../lib/ai/aspiration-worker.ts", import.meta.url), { type: "module" });
      worker.current = instance;

      instance.onmessage = (event: MessageEvent<{ type: string; text: string; progress?: number }>) => {
        if (id !== request.current) return;

        if (event.data.type === "model-ready") {
          modelManager.markModelReady();
          return;
        }

        if (event.data.type === "progress") {
          const progress = event.data.progress;
          setMessage(event.data.text === "Generating ideas on your device…" ? event.data.text :
            typeof progress === "number" && Number.isFinite(progress)
              ? `Preparing the model… ${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`
              : "Preparing the model…");
          return;
        }

        try {
          if (event.data.type === "error") {
            throw new Error(`Local model download or generation failed: ${event.data.text}`);
          }
          if (event.data.type !== "result") {
            throw new Error("The local model returned an unexpected response.");
          }

          const parsed = parseStepSuggestions(event.data.text, duration);

          const filtered = parsed.filter((step) => {
            const text = step.text.toLocaleLowerCase().replace(/\s+/g, " ").trim();
            if (existingStepTexts.has(text)) return false;
            existingStepTexts.add(text);
            return true;
          });

          setSuggestions(filtered);
          setMessage("");
          if (filtered.length === 0) {
            setMessage("No new steps were generated. You can manually add steps or continue editing.");
          }
        } catch (error) {
          setError(error instanceof Error ? error.message : "Could not parse generated steps. Try again or build manually.");
          setSuggestions([]);
        } finally {
          instance.terminate();
          worker.current = null;
          if (id === request.current) {
            setGenerating(false);
          }
        }
      };

      instance.onerror = () => {
        if (id !== request.current) return;
        instance.terminate();
        worker.current = null;
        setGenerating(false);
        setMessage("");
        setError("The local model worker failed to start or stopped unexpectedly. Check browser support and try again.");
      };

      instance.postMessage({
        type: "roadmap",
        aspiration: aspiration.trim(),
        currentSkills: currentSkills.trim(),
        occupation: occupation?.title,
        traits,
        duration,
        roadmap: roadmapContext,
      });
    } catch (err: unknown) {
      if (request.current !== id) return;
      setGenerating(false);
      setMessage("");
      setError(err instanceof Error ? err.message : "Local generation failed.");
      setSuggestions([]);
    }
  }

  function toggleAccept(index: number) {
    const updated = new Set(acceptedSteps);
    if (updated.has(index)) {
      updated.delete(index);
    } else {
      updated.add(index);
    }
    setAcceptedSteps(updated);
  }

  function acceptAll() {
    setAcceptedSteps(new Set(suggestions.map((_, i) => i)));
  }

  function rejectAll() {
    setAcceptedSteps(new Set());
  }

  function addAcceptedSteps() {
    if (roadmap.steps.length + acceptedSteps.size > 100) {
      setError("A roadmap can contain at most 100 steps. Select fewer suggestions.");
      return;
    }
    const newSteps = suggestions
      .map((suggestion, index) => ({
        suggestion,
        index,
      }))
      .filter(({ index }) => acceptedSteps.has(index))
      .map(({ suggestion }) => ({
        id: crypto.randomUUID(),
        text: suggestion.text,
        at: suggestion.at,
        notes: "",
        source: "ai" as const,
      }));

    if (newSteps.length === 0) {
      onContinue();
      return;
    }

    onChange({
      ...roadmap,
      steps: [...roadmap.steps, ...newSteps],
    });

    onContinue();
  }

  async function removeModel() {
    setRemovingModel(true);
    setError("");
    try {
      await modelManager.removeModel();
      setConfirmRemoval(false);
      setMessage("The local AI model was removed from this browser.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the local model.");
    } finally {
      setRemovingModel(false);
    }
  }

  return (
    <div className="roadmap-planner-wrapper">
      <div className="roadmap-planner-step2">
        <div className="eyebrow">04 / YOUR NEXT CHAPTER</div>
        <h1>Generate your plan</h1>

        <div className="roadmap-generation-context">
          <h2>We&apos;re analyzing:</h2>
          <div className="context-badges">
            <div className="context-item">
              <span className="context-label">Personality Assessment</span>
              <span className="context-value">{assessment?.instrument || "Not completed"}</span>
            </div>
            <div className="context-item">
              <span className="context-label">Your Aspirations</span>
              <span className="context-value">{aspiration ? `${aspiration.substring(0, 50)}${aspiration.length > 50 ? "…" : ""}` : "Not specified"}</span>
            </div>
            <div className="context-item">
              <span className="context-label">Your Skills</span>
              <span className="context-value">{currentSkills ? "Added" : "Not specified"}</span>
            </div>
            {occupation && (
              <div className="context-item">
                <span className="context-label">Target Occupation</span>
                <span className="context-value">{occupation.title}</span>
              </div>
            )}
          </div>
        </div>

        <p className="hint">Your entries stay on your device. Local AI requires WebGPU and about 4.7 GB of GPU memory. First use downloads about 2.4 GB from external model hosts. Suggestions are unvalidated; review them before adding. <a href="/about#local-ai" target="_blank" rel="noopener noreferrer">How it works (opens in a new tab)</a></p>
        {!duration && <p className="hint">Set an exact duration to generate timed steps. <button type="button" className="text-button" onClick={onSetDuration}>Set your timeline →</button></p>}
        {!generating && suggestions.length === 0 ? (
          <div className="roadmap-generation-controls">
            {modelDownload.status === "downloading" && (
              <div className="model-download-status">
                <p>Downloading AI model ({Math.round(modelDownload.progress)}%)</p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${modelDownload.progress}%` }} />
                </div>
              </div>
            )}
            {modelCached && (
              <button
                type="button"
                className="primary"
                onClick={generateSteps}
                disabled={generating || removingModel}
              >
                <SparklesIcon /> Generate steps from my profile
              </button>
            )}
            {!modelCached && modelDownload.status !== "downloading" && (
              <button
                type="button"
                className="primary"
                onClick={generateSteps}
                disabled={generating || removingModel}
              >
                <SparklesIcon /> Download & generate
              </button>
            )}
          </div>
        ) : null}

        {generating && (
          <div className="roadmap-generation-progress">
            <div className="generation-spinner" />
            <p>{message}</p>
            <button type="button" className="text-button" onClick={cancel}>
              Cancel generation
            </button>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="roadmap-suggestions">
            <h2>Suggested steps</h2>
            <p className="suggestions-hint">
              Review and select which steps to add to your roadmap. You can edit them later.
            </p>

            <div className="suggestions-actions">
              <button type="button" className="text-button" onClick={acceptAll}>
                Select all ({suggestions.length})
              </button>
              <button type="button" className="text-button" onClick={rejectAll}>
                Clear selection
              </button>
            </div>

            <div className="suggestions-list">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="suggestion-card">
                  <button
                    type="button"
                    className="suggestion-checkbox"
                    onClick={() => toggleAccept(index)}
                    aria-pressed={acceptedSteps.has(index)}
                    aria-label={`Select ${suggestion.text}`}
                  >
                    {acceptedSteps.has(index) ? <CheckIcon /> : null}
                  </button>
                  <div className="suggestion-content">
                    <h3>{suggestion.text}</h3>
                    {duration && (
                      <span className="suggestion-timeline">
                        {duration.unit} {suggestion.at}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="actions">
              <button
                type="button"
                className="primary"
                onClick={addAcceptedSteps}
                disabled={acceptedSteps.size === 0}
              >
                Add {acceptedSteps.size} step{acceptedSteps.size !== 1 ? "s" : ""} to my roadmap →
              </button>
              <button type="button" className="text-button" onClick={() => setSuggestions([])}>
                Generate different steps
              </button>
            </div>
          </div>
        )}

        {error && <div className="notice error-notice" role="alert">{error}</div>}
        {message && !generating && <div className="notice info-notice" role="status">{message}</div>}

        {(modelCached || confirmRemoval) && <details className="generation-model-settings">
          <summary>Manage local AI model</summary>
          <p className="hint">Remove the model from this browser to free storage. Generating again will download it again.</p>
          {confirmRemoval ? <div className="notice">
            <strong>Remove the local AI model?</strong>
            <div className="actions">
              <button type="button" className="danger" disabled={generating || removingModel} onClick={removeModel}>{removingModel ? "Removing…" : "Remove model"}</button>
              <button type="button" className="text-button" disabled={removingModel} onClick={() => setConfirmRemoval(false)}>Cancel</button>
            </div>
          </div> : <button type="button" className="text-button" disabled={generating || removingModel} onClick={() => setConfirmRemoval(true)}>Remove local model</button>}
        </details>}
        <div className="actions">
          <button type="button" className="text-button" onClick={onContinue}>Continue manually</button>
          <button type="button" className="text-button" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
