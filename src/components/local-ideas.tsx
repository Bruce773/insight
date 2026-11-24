"use client";

import { useEffect, useRef, useState } from "react";
import { ideaTraits, parseAspirationIdeas, parseIdeaSkills, type AspirationIdea } from "@/lib/engine/aspiration-ideas";
import type { AssessmentResult } from "@/lib/engine/assessment";
import { parseStepSuggestions, type Duration, type Roadmap, type StepSuggestion } from "@/lib/engine/roadmap";
import { modelManager, type ModelDownloadProgress } from "@/lib/local-model-manager";
import { XIcon } from "./icon";

export function LocalIdeas({ aspiration, currentSkills, assessment, occupation, focus, onFocus, duration, roadmap, onAddSkill, onAddStep }: {
  aspiration: string;
  currentSkills: string;
  assessment?: AssessmentResult;
  occupation?: string;
  focus?: string;
  onFocus: (skill: string) => void;
  duration?: Duration;
  roadmap: Roadmap;
  onAddSkill: (name: string) => void;
  onAddStep: (step: StepSuggestion) => void;
}) {
  const [ideas, setIdeas] = useState<AspirationIdea[] | null>(null);
  const [steps, setSteps] = useState<{ priorities: string; items: StepSuggestion[] } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [modelDownload, setModelDownload] = useState<ModelDownloadProgress>({ status: "not-started", progress: 0 });
  const [modelCached, setModelCached] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removalError, setRemovalError] = useState("");
  const worker = useRef<Worker | null>(null);
  const controller = useRef<AbortController | null>(null);
  const request = useRef(0);
  const roadmapRef = useRef(roadmap);
  const priorities = JSON.stringify(roadmap.skills.map(({ id, name }) => ({ id, name })));
  useEffect(() => {
    roadmapRef.current = roadmap;
  }, [roadmap]);

  useEffect(() => {
    const requestCounter = request;
    const unsubscribe = modelManager.onProgress((progress) => {
      setModelDownload(progress);
      if (progress.status === "completed") setModelCached(true);
      if (progress.status === "not-started") setModelCached(false);
    });

    modelManager.isModelCached().then(setModelCached).catch((error) => {
      setRemovalError(error instanceof Error ? error.message : "Could not check the local model.");
    });

    return () => {
      unsubscribe();
      requestCounter.current++;
      controller.current?.abort();
      worker.current?.terminate();
    };
  }, []);

  function cancel() {
    request.current++;
    controller.current?.abort();
    worker.current?.terminate();
    worker.current = null;
    setRunning(false);
    setMessage("Generation cancelled.");
  }

  async function generate(mode: "ideas" | "roadmap") {
    if (!aspiration.trim()) {
      setError("Add an aspiration before generating ideas.");
      return;
    }
    if (aspiration.length > 1000 || currentSkills.length > 1000) {
      setError("For local generation, keep your aspiration and current skills to 1,000 characters each.");
      return;
    }
    if (mode === "roadmap" && !duration) {
      setError("Choose an exact duration on the Aspirations step before generating a roadmap.");
      return;
    }
    if (mode === "roadmap" && JSON.stringify(roadmap).length > 12000) {
      setError("Your roadmap is too long for local generation. You can continue editing it manually or remove some items before requesting suggestions.");
      return;
    }
    if (!("gpu" in navigator) || !navigator.gpu) {
      setError("WebGPU is unavailable in this browser or device. Try a current WebGPU-enabled browser on a supported device.");
      return;
    }
    const id = ++request.current;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    if (mode === "ideas") setIdeas(null);
    else setSteps(null);
    setError("");
    setMessage("Checking device support…");
    try {
      if (typeof navigator.gpu !== "object" || !navigator.gpu ||
          !("requestAdapter" in navigator.gpu) || typeof navigator.gpu.requestAdapter !== "function" ||
          !await navigator.gpu.requestAdapter()) {
        throw new Error("No compatible WebGPU adapter is available on this device.");
      }
      if (id !== request.current) return;
      let skills: ReturnType<typeof parseIdeaSkills> = [];
      if (mode === "ideas") {
        setMessage("Preparing your skills…");
        const response = await fetch("/api/assessment/catalog?type=skill-list", { signal: abort.signal });
        if (!response.ok) throw new Error("Skill ideas are unavailable right now. Please try again later.");
        skills = parseIdeaSkills(await response.json());
      }
      if (id !== request.current) return;
      const traits = ideaTraits(assessment);
      const roadmapSnapshot = JSON.stringify(roadmap);
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
          if (event.data.type === "error") throw new Error(`Local model download or generation failed: ${event.data.text}`);
          if (event.data.type !== "result") throw new Error("The local model returned an unexpected response.");
          if (mode === "roadmap" && duration) {
            if (JSON.stringify(roadmapRef.current) !== roadmapSnapshot) throw new Error("Your roadmap changed during generation. Please request new suggestions.");
            setSteps({ priorities, items: parseStepSuggestions(event.data.text, duration) });
          } else {
            setIdeas(parseAspirationIdeas(event.data.text, skills, traits));
          }
          setMessage("");
        } catch (error) {
          setError(error instanceof Error ? error.message : "Local generation failed.");
          setMessage("");
        } finally {
          instance.terminate();
          worker.current = null;
          setRunning(false);
        }
      };
      instance.onerror = () => {
        if (id !== request.current) return;
        instance.terminate();
        worker.current = null;
        setRunning(false);
        setMessage("");
        setError("The local model worker failed to start or stopped unexpectedly. Check browser support and try again.");
      };
      instance.postMessage(mode === "roadmap"
        ? { type: "roadmap", aspiration, currentSkills, occupation, traits, duration, roadmap }
        : { type: "ideas", aspiration, currentSkills, skills, traits });
    } catch (error) {
      if (id !== request.current) return;
      setRunning(false);
      setMessage("");
      setError(error instanceof Error ? error.message : "Local generation failed.");
    }
  }

  const handleCancelDownload = () => {
    modelManager.cancelDownload();
  };

  async function removeModel() {
    setRemoving(true);
    setRemovalError("");
    try {
      await modelManager.removeModel();
      setConfirmRemoval(false);
    } catch (error) {
      setRemovalError(error instanceof Error ? error.message : "Could not remove the local model.");
    } finally {
      setRemoving(false);
    }
  }

  return <section aria-labelledby="local-ideas-heading">
    <div className="divider" />
    <h2 id="local-ideas-heading">Ideas for your next steps <span className="optional">optional</span></h2>
    <p>Explore skills{assessment ? " and personality traits" : ""} related to your aspiration. These AI ideas are unvalidated, not assessments of your abilities. Choose what feels useful.</p>
    <p className="hint">Your entries are processed on your device, not sent to an AI service. {!modelCached && "First use downloads about 2.4 GB from external model hosts and "}needs WebGPU, about 4.7 GB of GPU memory, and browser storage. <a href="/about#local-ai" target="_blank" rel="noopener noreferrer">How it works (opens in a new tab)</a></p>
    {modelDownload.status === "downloading" && (
      <div className="download-indicator modal-download-indicator">
        <div className="download-label">Downloading AI model… {modelDownload.progress}%</div>
        <div className="download-bar">
          <div className="download-fill" style={{ width: `${modelDownload.progress}%` }} />
        </div>
        <button
          className="download-cancel-icon"
          onClick={handleCancelDownload}
          aria-label="Cancel download"
        >
          <XIcon />
        </button>
      </div>
    )}
    <button className="primary" type="button" disabled={running || removing || modelDownload.status === "downloading"} onClick={() => generate("ideas")}>
      {running ? "Working…" : modelCached ? "Generate ideas" : "Download and generate ideas"}
    </button>
    {running && <button className="text-button" type="button" onClick={cancel}>Cancel</button>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {ideas && <ul className="reflection-list">{ideas.map(({ skill, trait }) => <li key={skill.elementId}>
        <span><strong>{skill.elementName}</strong>{trait && <small> · Personality trait to reflect on: {trait.name}, {trait.result.rawScore} / {trait.result.count * 5}</small>}</span>
        <button type="button" className="text-button" aria-pressed={roadmap.skills.some((item) => item.name === skill.elementName)} onClick={() => { onFocus(skill.elementName); onAddSkill(skill.elementName); }}>{roadmap.skills.some((item) => item.name === skill.elementName) ? "Added" : focus === skill.elementName ? "Add priority" : "Choose priority"}</button>
      </li>)}</ul>}
    <div className="actions">
      <button className="primary" type="button" disabled={running || removing || modelDownload.status === "downloading"} onClick={() => generate("roadmap")}>
        {roadmap.steps.length ? "Suggest more roadmap steps" : "Generate starter roadmap"}
      </button>
    </div>
    <p className="hint">Suggestions are generated on your device and may be inaccurate. Review each one before adding it; your existing steps will not be replaced.</p>
    {steps && steps.priorities === priorities && <ul className="roadmap-list">{steps.items.map((step, index) => <li className="roadmap-item" key={`${index}-${step.text}`}>
      <span>{step.text} <small> · {duration?.unit} {step.at}</small></span>
      <div className="roadmap-controls">
        <button type="button" className="text-button" disabled={roadmap.steps.length >= 100} onClick={() => { onAddStep(step); setSteps((current) => current ? { ...current, items: current.items.filter((_, i) => i !== index) } : null); }}>Add step</button>
        <button type="button" className="text-button" onClick={() => setSteps((current) => current ? { ...current, items: current.items.filter((_, i) => i !== index) } : null)} aria-label={`Dismiss suggestion ${index + 1}`}>Dismiss</button>
      </div>
    </li>)}</ul>}
    {(modelCached || confirmRemoval) && <details className="optional-exploration">
      <summary>Manage local AI model</summary>
      <p className="hint">Remove the model from this browser to free storage. You can download it again later.</p>
      {confirmRemoval ? <div className="notice">
        <strong>Remove the local AI model?</strong>
        <div className="actions">
          <button type="button" className="danger" disabled={removing || running || modelDownload.status === "downloading"} onClick={removeModel}>{removing ? "Removing…" : "Remove model"}</button>
          <button type="button" className="text-button" disabled={removing} onClick={() => setConfirmRemoval(false)}>Cancel</button>
        </div>
      </div> : <button type="button" className="text-button" disabled={running || modelDownload.status === "downloading"} onClick={() => setConfirmRemoval(true)}>Remove local model</button>}
    </details>}
    {removalError && <p role="alert">{removalError}</p>}
  </section>;
}
