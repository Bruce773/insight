"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AssessmentFlow, AssessmentScores, isAssessmentResult } from "@/components/assessment-flow";
import { LocalIdeas } from "@/components/local-ideas";
import { RoadmapBuilder } from "@/components/roadmap-builder";
import { LocalModelDownloadModal } from "@/components/local-model-download-modal";
import { DownloadProgressIndicator } from "@/components/download-progress-indicator";
import { ToastContainer } from "@/components/toast-container";
import { AuthModal } from "@/components/auth-modal";
import type { AssessmentResult } from "@/lib/engine/assessment";
import { experimentalMatches, type WorkStyleRow } from "@/lib/engine/experimental-matching";
import { modelManager } from "@/lib/local-model-manager";
import { isDuration, isRoadmap, markRoadmapForReview, type Duration, type DurationUnit, type Roadmap } from "@/lib/engine/roadmap";

type Occupation = { code: string; title: string; description: string | null; jobZone: number | null };
type Skill = { elementId: string; elementName: string };
type Plan = {
  version: 1;
  aspiration: string;
  horizon: string;
  occupation: Occupation | null;
  ratings: Record<string, number>;
  action: string;
  focusSkill?: string;
  currentSkills?: string;
  ideaFocus?: string;
  assessment?: AssessmentResult;
  duration?: Duration;
  roadmap?: Roadmap;
};
type Saved = { id: string; createdAt: string; payload: unknown };
type Step = "welcome" | "assessment" | "aspirations" | "skills" | "results";
type ExperimentalMatch = ReturnType<typeof experimentalMatches>[number];

const blankPlan: Plan = { version: 1, aspiration: "", horizon: "", occupation: null, ratings: {}, action: "" };
const emptyRoadmap: Roadmap = { skills: [], steps: [] };
const guestDraftKey = "insight-guest-plan";
const steps: { id: Step; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "assessment", label: "Assessment" },
  { id: "aspirations", label: "Aspirations" },
  { id: "skills", label: "Skills" },
  { id: "results", label: "Your plan" },
];
const aspirationCategories = [
  { name: "Career", ideas: ["Explore a new career direction", "Grow in my current work", "Find work that fits my life"] },
  { name: "Education & learning", ideas: ["Learn a new skill", "Earn a qualification", "Explore a subject that interests me"] },
  { name: "Hobbies & interests", ideas: ["Make time for a hobby", "Try a creative activity", "Explore a new interest"] },
  { name: "Health & well-being", ideas: ["Build healthier routines", "Make more time for rest", "Support my mental well-being"] },
  { name: "Money", ideas: ["Save more money", "Build a budget", "Work toward financial stability"] },
  { name: "Relationships", ideas: ["Spend more time with people I care about", "Build new connections", "Strengthen my relationships"] },
  { name: "Personal growth", ideas: ["Build confidence", "Find more balance in my life", "Explore what matters to me"] },
] as const;

async function getJson(url: string) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function isPlan(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const p = value as Plan;
  return p.version === 1 && typeof p.aspiration === "string" && typeof p.horizon === "string"
    && typeof p.action === "string" && !!p.ratings && typeof p.ratings === "object"
    && (p.focusSkill === undefined || typeof p.focusSkill === "string")
    && (p.currentSkills === undefined || typeof p.currentSkills === "string")
    && (p.ideaFocus === undefined || typeof p.ideaFocus === "string")
    && (p.duration === undefined || isDuration(p.duration))
    && (p.roadmap === undefined || isRoadmap(p.roadmap))
    && (p.occupation === null || (typeof p.occupation === "object" && typeof p.occupation.code === "string" && typeof p.occupation.title === "string"))
    && (p.assessment === undefined || isAssessmentResult(p.assessment));
}

function isWorkStyleRow(value: unknown): value is WorkStyleRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<WorkStyleRow>;
  return typeof row.code === "string" && typeof row.title === "string" &&
    (row.description === null || typeof row.description === "string") &&
    (row.jobZone === null || typeof row.jobZone === "number") &&
    typeof row.elementName === "string" && (row.value === null || typeof row.value === "number");
}

export function InsightApp() {
  const [step, setStep] = useState<Step>("welcome");
  const [plan, setPlan] = useState<Plan>(blankPlan);
  const [aspirationCategory, setAspirationCategory] = useState<string | null>(null);
  const [aspirationMessage, setAspirationMessage] = useState("");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [occupationOpen, setOccupationOpen] = useState(false);
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [skillState, setSkillState] = useState<{ code: string; items: Skill[]; message: string } | null>(null);
  const [catalogMessage, setCatalogMessage] = useState("");
  const [assessmentSession, setAssessmentSession] = useState(0);
  const [session, setSession] = useState<"checking" | "signed-in" | "guest">("checking");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [availableDraft, setAvailableDraft] = useState<Plan | null>(null);
  const [usingDraft, setUsingDraft] = useState(false);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("months");
  const [matches, setMatches] = useState<ExperimentalMatch[] | null>(null);
  const [matchMessage, setMatchMessage] = useState("");
  const [matching, setMatching] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const modelModalShown = useRef(false);
  const matchRequest = useRef(0);
  const skills = skillState && plan.occupation && skillState.code === plan.occupation.code ? skillState.items : [];
  const skillMessage = !plan.occupation ? "" : skillState?.code === plan.occupation.code ? skillState.message : "Loading skills…";
  const selectedCategory = aspirationCategories.find((category) => category.name === aspirationCategory);

  function addAspirationIdea(idea: string) {
    const next = plan.aspiration ? `${plan.aspiration}${plan.aspiration.endsWith("\n") ? "" : "\n"}${idea}` : idea;
    if (next.length > 4000) {
      setAspirationMessage("There isn't room for this idea. Shorten your aspiration before adding it.");
      return;
    }
    setAspirationMessage("Idea added. You can edit it below.");
    setPlan((current) => ({ ...current, aspiration: next, ideaFocus: undefined, roadmap: markRoadmapForReview(current.roadmap) }));
  }

  useEffect(() => {
    getJson("/api/auth/session").then((data) => {
      let draft: Plan | null = null;
      let readable = true;
      try {
        const stored = localStorage.getItem(guestDraftKey);
        if (stored) {
          const value: unknown = JSON.parse(stored);
          if (!isPlan(value)) throw new Error("The browser draft is invalid.");
          draft = value;
        }
      } catch {
        readable = false;
        setDraftMessage("Your browser draft could not be read. It has not been deleted; automatic draft storage is paused until you delete it.");
      }
      if (data?.user) {
        setSession("signed-in");
        setAvailableDraft(draft);
        getJson("/api/assessment/results").then((result) => setSaved(result.items)).catch(() => { });
      } else {
        setSession("guest");
        if (draft) {
          setPlan(draft);
          setDurationUnit(draft.duration?.unit ?? "months");
          setDraftMessage("Your guest draft was restored from this browser.");
        }
      }
      setDraftReady(readable);
    }).catch(() => {
      setSession("guest");
      setDraftMessage("Could not check your session. Refresh before editing to avoid overwriting a browser draft.");
    });
  }, []);

  useEffect(() => {
    if (!draftReady || session !== "guest") return;
    if (JSON.stringify(plan) === JSON.stringify(blankPlan)) return;
    try {
      localStorage.setItem(guestDraftKey, JSON.stringify(plan));
    } catch {
      queueMicrotask(() => setDraftMessage("Your guest draft could not be stored in this browser. Keep this page open or sign in to save."));
    }
  }, [plan, draftReady, session]);

  useEffect(() => {
    if (typeof window === "undefined" || modelModalShown.current) return;
    modelModalShown.current = true;

    const checkAndShowModal = async () => {
      const hasDeclined = modelManager.hasUserDeclined();
      const isCached = await modelManager.isModelCached();

      if (!hasDeclined && !isCached) {
        setShowModelModal(true);
      }
    };

    checkAndShowModal().catch((error) => {
      console.error("Could not check the local model:", error);
    });
  }, []);

  useEffect(() => {
    if (step !== "aspirations" || !occupationOpen) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setCatalogMessage("Searching…");
      fetch(`/api/assessment/catalog?type=occupations&q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          setOccupations(data.items);
          setCatalogMessage(data.items.length ? "Showing up to 50 results." : "No occupations found. You can still continue.");
        }).catch((error) => {
          if (error.name !== "AbortError") {
            setOccupations([]);
            setCatalogMessage("The occupation catalog is unavailable. You can still write your aspiration below.");
          }
        });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, step, occupationOpen]);

  useEffect(() => {
    if (!plan.occupation) return;
    const controller = new AbortController();
    const code = plan.occupation.code;
    fetch(`/api/assessment/catalog?type=skills&occupation=${encodeURIComponent(code)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setSkillState({ code, items: data.items, message: data.items.length ? "" : "No skills are available for this occupation." });
      }).catch((error) => {
        if (error.name !== "AbortError") setSkillState({ code, items: [], message: "Skill data is unavailable. You can still make a plan." });
      });
    return () => controller.abort();
  }, [plan.occupation]);

  async function savePlan() {
    setSaveMessage("Saving…");
    try {
      const response = await fetch("/api/assessment/results", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSaveMessage("Plan saved to your account.");
      if (usingDraft) {
        try {
          localStorage.removeItem(guestDraftKey);
          setDraftReady(true);
          setUsingDraft(false);
          setAvailableDraft(null);
        } catch {
          setDraftMessage("Your plan was saved, but the browser draft could not be removed.");
        }
      }
      getJson("/api/assessment/results").then((result) => setSaved(result.items)).catch(() => { });
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Your plan could not be saved.");
    }
  }

  function clearMatches() {
    matchRequest.current++;
    setMatches(null);
    setMatchMessage("");
    setMatching(false);
  }

  async function findMatches() {
    if (!plan.assessment) return;
    const requestId = ++matchRequest.current;
    setMatching(true);
    setMatchMessage("");
    setMatches(null);
    try {
      const response = await fetch("/api/assessment/catalog?type=workstyles", { cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== "object" || !("items" in data) ||
        !Array.isArray(data.items) || !data.items.every(isWorkStyleRow)) {
        throw new Error("The work-style catalog is unavailable or invalid.");
      }
      const ranked = experimentalMatches(plan.assessment, data.items);
      if (requestId !== matchRequest.current) return;
      setMatches(ranked.slice(0, 10));
      if (!ranked.length) setMatchMessage("No comparable occupations are available for these scores.");
    } catch (error) {
      if (requestId === matchRequest.current) setMatchMessage(error instanceof Error ? error.message : "Experimental matching is unavailable.");
    } finally {
      if (requestId === matchRequest.current) setMatching(false);
    }
  }

  function loadPlan(payload: unknown) {
    if (!isPlan(payload)) { setSaveMessage("This saved entry is not a plan that this version can open."); return; }
    clearMatches();
    setPlan(payload);
    setDurationUnit(payload.duration?.unit ?? "months");
    setUsingDraft(false);
    setAssessmentSession((session) => session + 1);
    setSaveMessage("Saved plan loaded.");
    setStep("results");
  }

  function deleteGuestDraft() {
    try {
      localStorage.removeItem(guestDraftKey);
      setAvailableDraft(null);
      setUsingDraft(false);
      if (session === "guest") {
        setPlan(blankPlan);
        setDurationUnit("months");
        setAssessmentSession((current) => current + 1);
        setStep("welcome");
      }
      setDraftMessage("The browser draft was deleted.");
    } catch {
      setDraftMessage("The browser draft could not be deleted.");
    }
  }

  return (
    <div className="shell">
      <ToastContainer />
      <LocalModelDownloadModal
        isOpen={showModelModal}
        onAccept={() => setShowModelModal(false)}
        onDecline={() => setShowModelModal(false)}
      />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <header className="topbar">
        <Link className="brand" href="/" aria-label="InSight home"><span className="brand-mark">✳</span> InSight</Link>
        <DownloadProgressIndicator onOpenModal={() => setShowModelModal(true)} />
        <nav className="account" aria-label="Account and information">
          <Link href="/about" target="_blank" rel="noopener noreferrer" aria-label="About InSight (opens in a new tab)">About</Link>
          {session === "signed-in" ? <><a href="/api/data/export">Export data</a><button type="button" onClick={() => signOut({ redirectTo: "/" })}>Sign out</button></> : <button type="button" className="account-signin" onClick={() => setShowAuthModal(true)}>Sign in</button>}
        </nav>
      </header>
      <main>
        {session === "checking" && <p className="hint" role="status">Checking your session and browser draft…</p>}
        <div inert={session === "checking" ? true : undefined}>
        <div className="progress" aria-label="Your journey">
          {steps.map((item, index) => <button key={item.id} className={step === item.id ? "progress-item active" : "progress-item"} aria-current={step === item.id ? "step" : undefined} onClick={() => setStep(item.id)}><span>{index + 1}</span>{item.label}</button>)}
        </div>
        {draftMessage && <p className="hint draft-status" role="status">{draftMessage}</p>}
        {session === "guest" && step !== "results" && <div className="draft-controls"><span className="hint">Guest progress is stored on this device.</span> <button className="text-button" type="button" onClick={() => {
          if (window.confirm("Delete the browser draft and start over?")) deleteGuestDraft();
        }}>Delete browser draft</button></div>}
        {session === "signed-in" && !draftReady && <button className="text-button" type="button" onClick={deleteGuestDraft}>Delete unreadable browser draft</button>}

        <section className="hero step-content" data-visible={step === "welcome"} hidden={step !== "welcome"}>
          <div className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</div>
          <h1>Consider<br /><em>what&apos;s next.</em></h1>
          <p className="lead">Explore your personality, the skills you have, and build a roadmap to work towards your goals.</p>
          <div className="actions"><button className="primary" onClick={() => setStep("assessment")}>Get started <span aria-hidden>→</span></button><button className="text-button" onClick={() => setStep("aspirations")}>Skip to my plan →</button></div>
          <p className="hint">Guest plans are stored in this browser on this device. Others using it may be able to see them. Sign in to save a plan to your account.</p>
        </section>

        <section className="content step-content" data-visible={step === "assessment"} hidden={step !== "assessment"}>
          <AssessmentFlow key={assessmentSession} result={plan.assessment}
            onComplete={(assessment) => { clearMatches(); setPlan((current) => ({ ...current, assessment, ideaFocus: undefined, roadmap: markRoadmapForReview(current.roadmap) })); }}
            onSkip={() => { clearMatches(); setPlan((current) => ({ ...current, assessment: undefined, ideaFocus: undefined, roadmap: markRoadmapForReview(current.roadmap) })); setStep("aspirations"); }}
            onContinue={() => setStep("aspirations")} onBack={() => setStep("welcome")} />
        </section>

        <section className="content step-content" data-visible={step === "aspirations"} hidden={step !== "aspirations"}>
          <div className="eyebrow">02 / LOOK AHEAD</div>
          <h1>What are you moving toward?</h1>
          <p className="lead">Start with one idea, or skip this for now. You can always change it later.</p>
          {!plan.aspiration.trim() && <button className="text-button aspiration-skip" type="button" onClick={() => setStep("skills")}>Skip this for now →</button>}
          <div className="aspiration-guide">
            <h2>1. Pick an area</h2>
            <p>Choose an area for ideas, or write your own below.</p>
            <div className="aspiration-options" aria-label="Aspiration areas">
              {aspirationCategories.map((category) => <button key={category.name} type="button" aria-pressed={aspirationCategory === category.name} onClick={() => { setAspirationCategory(category.name); setAspirationMessage(""); }}>{category.name}</button>)}
            </div>
            {selectedCategory && <div className="aspiration-ideas">
              <h2>2. Add an idea</h2>
              <p>Choose any that feel right. Switch areas to add more.</p>
              <div className="aspiration-options" aria-label={`${selectedCategory.name} ideas`}>
                {selectedCategory.ideas.map((idea) => <button key={idea} type="button" onClick={() => addAspirationIdea(idea)}>+ {idea}</button>)}
              </div>
            </div>}
            <p className="hint aspiration-feedback" role="status">{aspirationMessage}</p>
          </div>
          <label htmlFor="aspiration">Your aspiration</label>
          <p className="hint">Edit your ideas or write something in your own words.</p>
          <textarea id="aspiration" value={plan.aspiration} maxLength={4000} onChange={(e) => { setAspirationMessage(""); setPlan({ ...plan, aspiration: e.target.value, ideaFocus: undefined, roadmap: markRoadmapForReview(plan.roadmap) }); }} placeholder="What would you like to explore or work toward?" />
          <details className="optional-exploration" open={timelineOpen} onToggle={(event) => setTimelineOpen(event.currentTarget.open)}>
          <summary>Add a timeline <span className="optional">optional{plan.horizon || plan.duration ? " · added" : ""}</span></summary>
          <label htmlFor="horizon">Your time horizon</label>
          <select id="horizon" value={plan.horizon} onChange={(e) => setPlan({ ...plan, horizon: e.target.value })}><option value="">Choose one (optional)</option><option>Within 6 months</option><option>6–12 months</option><option>1–3 years</option><option>More than 3 years</option><option>Not sure yet</option></select>
          <label htmlFor="duration">Exact roadmap duration <span className="optional">needed for timed AI suggestions</span></label>
          <div className="roadmap-input-row">
            <input id="duration" className="roadmap-time" type="number" min="1" max="1000" placeholder="Number" value={plan.duration?.amount ?? ""} onChange={(event) => {
              const amount = Number(event.target.value);
              const duration = Number.isInteger(amount) && amount >= 1 && amount <= 1000 ? { amount, unit: durationUnit } : undefined;
              setPlan({ ...plan, duration, roadmap: markRoadmapForReview(plan.roadmap) });
            }} />
            <label className="sr-only" htmlFor="duration-unit">Duration unit</label>
            <select id="duration-unit" value={durationUnit} onChange={(event) => {
              const unit = event.target.value as DurationUnit;
              setDurationUnit(unit);
              setPlan({ ...plan, duration: plan.duration ? { ...plan.duration, unit } : undefined, roadmap: markRoadmapForReview(plan.roadmap) });
            }}><option value="weeks">Weeks</option><option value="months">Months</option><option value="years">Years</option></select>
          </div>
          <p className="hint">Choose a whole number from 1 to 1,000. Your earlier range is kept as a reflection.</p>
          </details>
          <details className="optional-exploration" open={occupationOpen} onToggle={(event) => setOccupationOpen(event.currentTarget.open)}>
            <summary>Explore a specific occupation <span className="optional">optional{plan.occupation ? ` · ${plan.occupation.title} selected` : ""}</span></summary>
            <p>Choose an occupation to explore its skills, or continue with your aspiration alone.</p>
            {plan.assessment?.instrument === "IPIP-NEO-120" && <div className="notice">
              <h3>Experimental occupation comparisons</h3>
              <p>These unvalidated comparisons do not predict suitability or success and are not for hiring decisions.</p>
              <button type="button" className="text-button" disabled={matching} onClick={findMatches}>{matching ? "Comparing…" : "Show experimental comparisons →"}</button>
              {matchMessage && <p role="status">{matchMessage}</p>}
              {matches && matches.length > 0 && <><p>Similarity is not a probability or percentile. Select an occupation to explore its skills.</p>
                <div className="occupation-list">{matches.map(({ occupation, score }) => <button key={occupation.code} type="button" onClick={() => setPlan({ ...plan, occupation: { code: occupation.code, title: occupation.title, description: occupation.description, jobZone: occupation.jobZone }, ratings: {}, focusSkill: undefined, roadmap: markRoadmapForReview(plan.roadmap) })} aria-pressed={plan.occupation?.code === occupation.code}>
                  <span><strong>{occupation.title}</strong><small>{occupation.code} · similarity {score?.toFixed(2)} / 1</small></span><span>{plan.occupation?.code === occupation.code ? "Selected ✓" : "Select →"}</span>
                </button>)}</div></>}
            </div>}
            <label htmlFor="occupation-search">Occupation or code</label>
            <input id="occupation-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search occupations" />
            <p className="hint" role="status">{catalogMessage}</p>
            {plan.occupation && <div className="selected-occupation"><strong>Selected: {plan.occupation.title}</strong><button className="text-button" onClick={() => setPlan({ ...plan, occupation: null, ratings: {}, focusSkill: undefined, roadmap: markRoadmapForReview(plan.roadmap) })}>Remove</button></div>}
            <div className="occupation-list">{occupations.map((occupation) => <button key={occupation.code} onClick={() => setPlan({ ...plan, occupation, ratings: {}, focusSkill: undefined, roadmap: markRoadmapForReview(plan.roadmap) })} aria-pressed={plan.occupation?.code === occupation.code}><span><strong>{occupation.title}</strong><small>{occupation.code}</small></span><span>{plan.occupation?.code === occupation.code ? "Selected ✓" : "Select →"}</span></button>)}</div>
          </details>
          <div className="actions"><button className="primary" onClick={() => setStep("skills")}>Continue to skills →</button><button className="text-button" onClick={() => setStep("assessment")}>Back</button></div>
        </section>

        <section className="content step-content" data-visible={step === "skills"} hidden={step !== "skills"}>
          <div className="eyebrow">03 / TAKE STOCK</div>
          <h1>Your skills, your perspective.</h1>
          <p className="lead">Take stock of skills you believe you already have. Your reflections are not a test of proficiency.</p>
          <label htmlFor="current-skills">Skills you already have <span className="optional">optional</span></label>
          <textarea id="current-skills" value={plan.currentSkills ?? ""} maxLength={4000} onChange={(e) => setPlan({ ...plan, currentSkills: e.target.value, ideaFocus: undefined, roadmap: markRoadmapForReview(plan.roadmap) })} placeholder="List skills or experience in your own words." />
          {plan.occupation && <><h2>Skills for {plan.occupation.title}</h2><p>Optionally, rate your confidence in these skills. Confidence is not a measure of proficiency.</p><p role="status">{skillMessage}</p><div className="skill-list">{skills.map((skill) => <div className="skill-row" key={skill.elementId}><div><strong>{skill.elementName}</strong></div><label><span className="sr-only">Your confidence in {skill.elementName}</span><select value={plan.ratings[skill.elementId] ?? ""} onChange={(e) => { const ratings = { ...plan.ratings }; if (e.target.value) ratings[skill.elementId] = Number(e.target.value); else delete ratings[skill.elementId]; setPlan({ ...plan, ratings }); }}><option value="">Not rated</option><option value="1">1 – Low</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 – High</option></select></label></div>)}</div></>}
          {skills.length > 0 && <><label htmlFor="focus-skill">A skill you want to focus on <span className="optional">optional</span></label><select id="focus-skill" value={plan.focusSkill ?? ""} onChange={(e) => setPlan({ ...plan, focusSkill: e.target.value || undefined })}><option value="">Choose a skill</option>{skills.map((skill) => <option key={skill.elementId} value={skill.elementId}>{skill.elementName}</option>)}</select><p className="hint">Choose your own priority; it is not inferred from your confidence ratings.</p></>}
          <div className="actions"><button className="primary" onClick={() => setStep("results")}>See my plan →</button><button className="text-button" onClick={() => setStep("aspirations")}>Back</button></div>
        </section>

        <section className="content step-content plan-page" data-visible={step === "results"} hidden={step !== "results"}>
          <div className="eyebrow">04 / YOUR NEXT CHAPTER</div>
          <h1>A plan that starts with you.</h1>
          <p className="lead">Your aspiration, your skills, and ideas for what to explore next.</p>
          {session === "signed-in" && availableDraft && <div className="notice plan-draft-notice"><p>A guest draft is available in this browser. Opening it replaces the plan currently on this page, not your saved plans.</p><button className="text-button" type="button" onClick={() => { loadPlan(availableDraft); setUsingDraft(true); setSaveMessage("Guest draft opened. Save it to your account when ready."); }}>Open guest draft</button>{" · "}<button className="text-button" type="button" onClick={deleteGuestDraft}>Delete browser draft</button></div>}
          <div className="plan-workspace">
            <LocalIdeas key={JSON.stringify([plan.aspiration, plan.currentSkills, plan.assessment, plan.duration, plan.occupation])} aspiration={plan.aspiration} currentSkills={plan.currentSkills ?? ""} assessment={plan.assessment} occupation={plan.occupation?.title} focus={plan.ideaFocus} duration={plan.duration} roadmap={plan.roadmap ?? emptyRoadmap} onFocus={(ideaFocus) => setPlan((current) => ({ ...current, ideaFocus }))}
              onAddSkill={(name) => setPlan((current) => {
                const roadmap = current.roadmap ?? emptyRoadmap;
                return roadmap.skills.some((skill) => skill.name === name) || roadmap.skills.length >= 100 ? current :
                  { ...current, roadmap: { ...roadmap, skills: [...roadmap.skills, { id: crypto.randomUUID(), name, source: "ai" }] } };
              })}
              onAddStep={(step) => setPlan((current) => {
                const roadmap = current.roadmap ?? emptyRoadmap;
                return roadmap.steps.length >= 100 ? current : { ...current, roadmap: { ...roadmap, steps: [...roadmap.steps, { ...step, id: crypto.randomUUID(), source: "ai" }] } };
              })} />
            <RoadmapBuilder duration={plan.duration} roadmap={plan.roadmap ?? emptyRoadmap} onChange={(roadmap) => setPlan((current) => ({ ...current, roadmap }))} onSetDuration={() => { setTimelineOpen(true); setStep("aspirations"); }} />
          </div>
          <div className="actions plan-save-actions">{session === "signed-in" ? <button className="plan-save-button" onClick={savePlan}>Save my plan</button> : <button type="button" className="plan-save-button" onClick={() => setShowAuthModal(true)}>Sign in to save</button>}<button className="text-button" onClick={() => setStep("skills")}>Back to skills</button></div>
          {session !== "signed-in" && <p className="hint plan-draft-hint">Your guest draft is stored in this browser on this device, where other users of the device may see it. Sign in and save to keep it in your account. <button className="text-button" type="button" onClick={() => {
            if (window.confirm("Delete the browser draft and start over?")) deleteGuestDraft();
          }}>Delete browser draft</button></p>}
          {saveMessage && <p role="status">{saveMessage}</p>}
          <div className="plan-support">
            <h2>More about you</h2>
            <details className="plan-support-disclosure"><summary>Your aspiration and timeline</summary>
              <div className="summary"><div><span>YOUR ASPIRATION</span><p>{plan.aspiration || "You haven’t added an aspiration yet."}</p></div>{plan.horizon && <div><span>TIME HORIZON</span><p>{plan.horizon}</p></div>}{plan.duration && <div><span>ROADMAP DURATION</span><p>{plan.duration.amount} {plan.duration.unit}</p></div>}{plan.occupation && <div><span>OCCUPATION YOU CHOSE</span><p>{plan.occupation.title}</p></div>}</div>
            </details>
            <details className="plan-support-disclosure"><summary>Your skills and reflections</summary>
              <h2>Skills you already have</h2>
              {plan.currentSkills ? <p className="entered-skills">{plan.currentSkills}</p> : <p>You can add your skills on the previous step.</p>}
              {skills.some((skill) => plan.ratings[skill.elementId]) && <><h2>Your confidence ratings</h2><ul className="reflection-list">{skills.filter((skill) => plan.ratings[skill.elementId]).map((skill) => <li key={skill.elementId}>{skill.elementName} <strong>{plan.ratings[skill.elementId]} / 5 confidence</strong></li>)}</ul></>}
              {plan.focusSkill && <p>Your chosen focus: {skills.find((skill) => skill.elementId === plan.focusSkill)?.elementName ?? "Skill details unavailable."}</p>}
              {plan.ideaFocus && <p>Your chosen priority: {plan.ideaFocus}</p>}
            </details>
            {plan.assessment && <details className="plan-support-disclosure"><summary>Your personality profile</summary><AssessmentScores result={plan.assessment} /></details>}
            <details className="plan-support-disclosure"><summary>One next step you want to take {plan.action && <span className="optional"> · added</span>}</summary>
              <label htmlFor="action">One next step you want to take</label>
              <textarea id="action" value={plan.action} maxLength={4000} onChange={(e) => setPlan({ ...plan, action: e.target.value })} placeholder="Write an action that feels useful to you." />
            </details>
            {session === "signed-in" && <details className="plan-support-disclosure"><summary>Saved plans and account <span className="optional"> · {saved.length} saved</span></summary>{saved.length ? <ul className="saved-list">{saved.map((entry) => <li key={entry.id}><span>{new Date(entry.createdAt).toLocaleString()}</span><button className="text-button" onClick={() => loadPlan(entry.payload)}>Open plan →</button></li>)}</ul> : <p>No saved plans to show.</p>}<p className="hint">You can <a href="/api/data/export">export your data</a> or delete your account and its data below.</p><DeleteAccount onDeleted={() => { clearMatches(); setSession("guest"); setSaved([]); setPlan(blankPlan); setAssessmentSession((session) => session + 1); setStep("welcome"); }} /></details>}
          </div>
        </section>
        </div>
      </main>
      <footer><span>✳ InSight</span><Link href="/about" target="_blank" rel="noopener noreferrer" aria-label="About InSight (opens in a new tab)">About</Link></footer>
    </div>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  async function remove() {
    try {
      const response = await fetch("/api/data/delete", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onDeleted();
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete your data.");
    }
  }
  return <div>{confirm ? <div className="notice"><strong>Delete your account and saved data?</strong><p>This cannot be undone.</p><div className="actions"><button className="danger" onClick={remove}>Yes, permanently delete</button><button className="text-button" onClick={() => setConfirm(false)}>Cancel</button></div></div> : <button className="text-button" onClick={() => setConfirm(true)}>Delete account and data</button>}{message && <p role="alert">{message}</p>}</div>;
}
