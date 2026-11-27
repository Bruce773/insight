"use client";

import { useEffect, useRef, useState } from "react";
import { ideaTraits, parseAspirationIdeas, parseIdeaSkills, type AspirationIdea } from "@/lib/engine/aspiration-ideas";
import type { AssessmentResult } from "@/lib/engine/assessment";
import type { Roadmap } from "@/lib/engine/roadmap";
import { modelManager, type ModelDownloadProgress } from "@/lib/local-model-manager";
import { XIcon } from "./icon";

export function LocalIdeas({ aspiration, currentSkills, assessment, focus, onFocus, roadmap, onAddSkill }: {
  aspiration: string;
  currentSkills: string;
  assessment?: AssessmentResult;
  focus?: string;
  onFocus: (skill: string) => void;
  roadmap: Roadmap;
  onAddSkill: (name: string) => void;
}) {
  const [ideas, setIdeas] = useState<AspirationIdea[] | null>(null);
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

  async function generate() {
    if (!aspiration.trim()) {
      setError("Add an aspiration before generating ideas.");
      return;
    }
    if (aspiration.length > 1000 || currentSkills.length > 1000) {
      setError("For local generation, keep your aspiration and current skills to 1,000 characters each.");
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
    setIdeas(null);
    setError("");
    setMessage("Checking device support…");
    try {
      if (typeof navigator.gpu !== "object" || !navigator.gpu ||
          !("requestAdapter" in navigator.gpu) || typeof navigator.gpu.requestAdapter !== "function" ||
          !await navigator.gpu.requestAdapter()) {
        throw new Error("No compatible WebGPU adapter is available on this device.");
      }
      if (id !== request.current) return;
      setMessage("Preparing your skills…");
      const response = await fetch("/api/assessment/catalog?type=skill-list", { signal: abort.signal });
      if (!response.ok) throw new Error("Skill ideas are unavailable right now. Please try again later.");
      const skills = parseIdeaSkills(await response.json());
      if (id !== request.current) return;
      const traits = ideaTraits(assessment);
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
          setIdeas(parseAspirationIdeas(event.data.text, skills, traits));
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
      instance.postMessage({ type: "ideas", aspiration, currentSkills, skills, traits });
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

  return <section className="generation-card" aria-labelledby="local-ideas-heading">
    <div className="generation-heading">
      <div>
        <div className="eyebrow">A STARTING POINT · OPTIONAL</div>
        <h2 id="local-ideas-heading">Explore skill ideas</h2>
        <p>Explore optional skills related to your aspiration and choose what to add.</p>
      </div>
    </div>
    <p className="hint generation-privacy">Your entries stay on your device. Requires WebGPU, about 4.7 GB of GPU memory, and browser storage. {!modelCached && "First use downloads about 2.4 GB from external model hosts. "}<a href="/about#local-ai" target="_blank" rel="noopener noreferrer">How it works (opens in a new tab)</a></p>
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
    <div className="generation-actions">
      <button className="text-button generation-secondary" type="button" disabled={running || removing || modelDownload.status === "downloading"} onClick={generate}>
        {running ? "Generating skill ideas…" : modelCached ? "Generate skill ideas" : "Download and generate skill ideas"}
      </button>
      {running && <button className="text-button" type="button" onClick={cancel}>Cancel</button>}
    </div>
    <p className="hint generation-disclaimer">AI suggestions are unvalidated, not assessments of your abilities. Review each idea before adding it.</p>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {ideas && <><h3 className="generation-results-heading">Skill ideas</h3><ul className="reflection-list">{ideas.map(({ skill, trait }) => <li key={skill.elementId}>
        <span><strong>{skill.elementName}</strong>{trait && <small> · Personality trait to reflect on: {trait.name}, {trait.result.rawScore} / {trait.result.count * 5}</small>}</span>
        <button type="button" className="text-button" aria-pressed={roadmap.skills.some((item) => item.name === skill.elementName)} onClick={() => { onFocus(skill.elementName); onAddSkill(skill.elementName); }}>{roadmap.skills.some((item) => item.name === skill.elementName) ? "Added" : focus === skill.elementName ? "Add priority" : "Choose priority"}</button>
      </li>)}</ul></>}
    {(modelCached || confirmRemoval) && <details className="generation-model-settings">
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
