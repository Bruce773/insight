"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AssessmentFlow, AssessmentScores, isAssessmentResult } from "@/components/assessment-flow";
import { LocalIdeas } from "@/components/local-ideas";
import { LocalModelDownloadModal } from "@/components/local-model-download-modal";
import { DownloadProgressIndicator } from "@/components/download-progress-indicator";
import type { AssessmentResult } from "@/lib/engine/assessment";
import { experimentalMatches, type WorkStyleRow } from "@/lib/engine/experimental-matching";
import { modelManager } from "@/lib/local-model-manager";

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
};
type Saved = { id: string; createdAt: string; payload: unknown };
type Step = "welcome" | "assessment" | "aspirations" | "skills" | "results";
type ExperimentalMatch = ReturnType<typeof experimentalMatches>[number];

const blankPlan: Plan = { version: 1, aspiration: "", horizon: "", occupation: null, ratings: {}, action: "" };
const steps: { id: Step; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "assessment", label: "Assessment" },
  { id: "aspirations", label: "Aspirations" },
  { id: "skills", label: "Skills" },
  { id: "results", label: "Your plan" },
];

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
  const [query, setQuery] = useState("");
  const [occupationOpen, setOccupationOpen] = useState(false);
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [skillState, setSkillState] = useState<{ code: string; items: Skill[]; message: string } | null>(null);
  const [catalogMessage, setCatalogMessage] = useState("");
  const [assessmentSession, setAssessmentSession] = useState(0);
  const [session, setSession] = useState<"checking" | "signed-in" | "guest">("checking");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [matches, setMatches] = useState<ExperimentalMatch[] | null>(null);
  const [matchMessage, setMatchMessage] = useState("");
  const [matching, setMatching] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const modelModalShown = useRef(false);
  const matchRequest = useRef(0);
  const skills = skillState && plan.occupation && skillState.code === plan.occupation.code ? skillState.items : [];
  const skillMessage = !plan.occupation ? "" : skillState?.code === plan.occupation.code ? skillState.message : "Loading skills…";

  useEffect(() => {
    getJson("/api/auth/session").then((data) => {
      if (data?.user) {
        setSession("signed-in");
        getJson("/api/assessment/results").then((result) => setSaved(result.items)).catch(() => { });
      } else setSession("guest");
    }).catch(() => setSession("guest"));
  }, []);

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

    checkAndShowModal();
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
    setAssessmentSession((session) => session + 1);
    setSaveMessage("Saved plan loaded.");
    setStep("results");
  }

  return (
    <div className="shell">
      <LocalModelDownloadModal
        isOpen={showModelModal}
        onAccept={() => setShowModelModal(false)}
        onDecline={() => setShowModelModal(false)}
      />
      <header className="topbar">
        <Link className="brand" href="/" aria-label="InSight home"><span className="brand-mark">✳</span> InSight</Link>
        <DownloadProgressIndicator />
        <nav className="account" aria-label="Account and information">
          <Link href="/about" target="_blank" rel="noopener noreferrer" aria-label="About InSight (opens in a new tab)">About</Link>
          {session === "signed-in" ? <><a href="/api/data/export">Export data</a><button type="button" onClick={() => signOut({ redirectTo: "/" })}>Sign out</button></> : <Link prefetch={false} href="/api/auth/signin">Sign in</Link>}
        </nav>
      </header>
      <main>
        <div className="progress" aria-label="Your journey">
          {steps.map((item, index) => <button key={item.id} className={step === item.id ? "progress-item active" : "progress-item"} aria-current={step === item.id ? "step" : undefined} onClick={() => setStep(item.id)}><span>{index + 1}</span>{item.label}</button>)}
        </div>

        <section className="hero step-content" data-visible={step === "welcome"} hidden={step !== "welcome"}>
          <div className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</div>
          <h1>Consider<br /><em>what&apos;s next.</em></h1>
          <p className="lead">Explore your personality, the skills you have, and build a roadmap to work towards your goals.</p>
          <div className="actions"><button className="primary" onClick={() => setStep("assessment")}>Get started <span aria-hidden>→</span></button><button className="text-button" onClick={() => setStep("aspirations")}>Skip to my plan →</button></div>
          <p className="hint">Guest progress stays in this page only and is lost on reload. Sign in to save a plan to your account.</p>
        </section>

        <section className="content step-content" data-visible={step === "assessment"} hidden={step !== "assessment"}>
          <AssessmentFlow key={assessmentSession} result={plan.assessment}
            onComplete={(assessment) => { clearMatches(); setPlan((current) => ({ ...current, assessment, ideaFocus: undefined })); }}
            onSkip={() => { clearMatches(); setPlan((current) => ({ ...current, assessment: undefined, ideaFocus: undefined })); setStep("aspirations"); }}
            onContinue={() => setStep("aspirations")} onBack={() => setStep("welcome")} />
        </section>

        <section className="content step-content" data-visible={step === "aspirations"} hidden={step !== "aspirations"}>
          <div className="eyebrow">02 / LOOK AHEAD</div>
          <h1>What are you moving toward?</h1>
          <p className="lead">There&apos;s no right answer. Your aspiration can be specific or still taking shape.</p>
          <label htmlFor="aspiration">Your aspiration</label>
          <textarea id="aspiration" value={plan.aspiration} maxLength={4000} onChange={(e) => setPlan({ ...plan, aspiration: e.target.value, ideaFocus: undefined })} placeholder="What would you like to explore or work toward?" />
          <label htmlFor="horizon">Your time horizon</label>
          <select id="horizon" value={plan.horizon} onChange={(e) => setPlan({ ...plan, horizon: e.target.value })}><option value="">Choose one (optional)</option><option>Within 6 months</option><option>6–12 months</option><option>1–3 years</option><option>More than 3 years</option><option>Not sure yet</option></select>
          <details className="optional-exploration" open={occupationOpen} onToggle={(event) => setOccupationOpen(event.currentTarget.open)}>
            <summary>Explore a specific occupation <span className="optional">optional{plan.occupation ? ` · ${plan.occupation.title} selected` : ""}</span></summary>
            <p>Choose an occupation to explore its skills, or continue with your aspiration alone.</p>
            {plan.assessment?.instrument === "IPIP-NEO-120" && <div className="notice">
              <h3>Experimental occupation comparisons</h3>
              <p>These unvalidated comparisons do not predict suitability or success and are not for hiring decisions.</p>
              <button type="button" className="text-button" disabled={matching} onClick={findMatches}>{matching ? "Comparing…" : "Show experimental comparisons →"}</button>
              {matchMessage && <p role="status">{matchMessage}</p>}
              {matches && matches.length > 0 && <><p>Similarity is not a probability or percentile. Select an occupation to explore its skills.</p>
                <div className="occupation-list">{matches.map(({ occupation, score }) => <button key={occupation.code} type="button" onClick={() => setPlan({ ...plan, occupation: { code: occupation.code, title: occupation.title, description: occupation.description, jobZone: occupation.jobZone }, ratings: {}, focusSkill: undefined })} aria-pressed={plan.occupation?.code === occupation.code}>
                  <span><strong>{occupation.title}</strong><small>{occupation.code} · similarity {score?.toFixed(2)} / 1</small></span><span>{plan.occupation?.code === occupation.code ? "Selected ✓" : "Select →"}</span>
                </button>)}</div></>}
            </div>}
            <label htmlFor="occupation-search">Occupation or code</label>
            <input id="occupation-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search occupations" />
            <p className="hint" role="status">{catalogMessage}</p>
            {plan.occupation && <div className="selected-occupation"><strong>Selected: {plan.occupation.title}</strong><button className="text-button" onClick={() => setPlan({ ...plan, occupation: null, ratings: {}, focusSkill: undefined })}>Remove</button></div>}
            <div className="occupation-list">{occupations.map((occupation) => <button key={occupation.code} onClick={() => setPlan({ ...plan, occupation, ratings: {}, focusSkill: undefined })} aria-pressed={plan.occupation?.code === occupation.code}><span><strong>{occupation.title}</strong><small>{occupation.code}</small></span><span>{plan.occupation?.code === occupation.code ? "Selected ✓" : "Select →"}</span></button>)}</div>
          </details>
          <div className="actions"><button className="primary" onClick={() => setStep("skills")}>Continue to skills →</button><button className="text-button" onClick={() => setStep("assessment")}>Back</button></div>
        </section>

        <section className="content step-content" data-visible={step === "skills"} hidden={step !== "skills"}>
          <div className="eyebrow">03 / TAKE STOCK</div>
          <h1>Your skills, your perspective.</h1>
          <p className="lead">Take stock of skills you believe you already have. Your reflections are not a test of proficiency.</p>
          <label htmlFor="current-skills">Skills you already have <span className="optional">optional</span></label>
          <textarea id="current-skills" value={plan.currentSkills ?? ""} maxLength={4000} onChange={(e) => setPlan({ ...plan, currentSkills: e.target.value, ideaFocus: undefined })} placeholder="List skills or experience in your own words." />
          {plan.occupation && <><h2>Skills for {plan.occupation.title}</h2><p>Optionally, rate your confidence in these skills. Confidence is not a measure of proficiency.</p><p role="status">{skillMessage}</p><div className="skill-list">{skills.map((skill) => <div className="skill-row" key={skill.elementId}><div><strong>{skill.elementName}</strong></div><label><span className="sr-only">Your confidence in {skill.elementName}</span><select value={plan.ratings[skill.elementId] ?? ""} onChange={(e) => { const ratings = { ...plan.ratings }; if (e.target.value) ratings[skill.elementId] = Number(e.target.value); else delete ratings[skill.elementId]; setPlan({ ...plan, ratings }); }}><option value="">Not rated</option><option value="1">1 – Low</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 – High</option></select></label></div>)}</div></>}
          {skills.length > 0 && <><label htmlFor="focus-skill">A skill you want to focus on <span className="optional">optional</span></label><select id="focus-skill" value={plan.focusSkill ?? ""} onChange={(e) => setPlan({ ...plan, focusSkill: e.target.value || undefined })}><option value="">Choose a skill</option>{skills.map((skill) => <option key={skill.elementId} value={skill.elementId}>{skill.elementName}</option>)}</select><p className="hint">Choose your own priority; it is not inferred from your confidence ratings.</p></>}
          <div className="actions"><button className="primary" onClick={() => setStep("results")}>See my plan →</button><button className="text-button" onClick={() => setStep("aspirations")}>Back</button></div>
        </section>

        <section className="content step-content" data-visible={step === "results"} hidden={step !== "results"}>
          <div className="eyebrow">04 / YOUR NEXT CHAPTER</div>
          <h1>A plan that starts with you.</h1>
          <p className="lead">Your aspiration, your skills, and ideas for what to explore next.</p>
          <div className="summary"><div><span>YOUR ASPIRATION</span><p>{plan.aspiration || "You haven’t added an aspiration yet."}</p></div>{plan.horizon && <div><span>TIME HORIZON</span><p>{plan.horizon}</p></div>}{plan.occupation && <div><span>OCCUPATION YOU CHOSE</span><p>{plan.occupation.title}</p></div>}</div>
          <h2>Skills you already have</h2>
          {plan.currentSkills ? <p className="entered-skills">{plan.currentSkills}</p> : <p>You can add your skills on the previous step.</p>}
          {skills.some((skill) => plan.ratings[skill.elementId]) && <><h2>Your confidence ratings</h2><ul className="reflection-list">{skills.filter((skill) => plan.ratings[skill.elementId]).map((skill) => <li key={skill.elementId}>{skill.elementName} <strong>{plan.ratings[skill.elementId]} / 5 confidence</strong></li>)}</ul></>}
          {plan.assessment && <AssessmentScores result={plan.assessment} />}
          {plan.focusSkill && <p>Your chosen focus: {skills.find((skill) => skill.elementId === plan.focusSkill)?.elementName ?? "Skill details unavailable."}</p>}
          {plan.ideaFocus && <p>Your chosen priority: {plan.ideaFocus}</p>}
          <LocalIdeas key={JSON.stringify([plan.aspiration, plan.currentSkills, plan.assessment])} aspiration={plan.aspiration} currentSkills={plan.currentSkills ?? ""} assessment={plan.assessment} focus={plan.ideaFocus} onFocus={(ideaFocus) => setPlan((current) => ({ ...current, ideaFocus }))} />
          <label htmlFor="action">One next step you want to take</label>
          <textarea id="action" value={plan.action} maxLength={4000} onChange={(e) => setPlan({ ...plan, action: e.target.value })} placeholder="Write an action that feels useful to you." />
          <div className="actions">{session === "signed-in" ? <button className="primary" onClick={savePlan}>Save my plan</button> : <Link prefetch={false} className="primary" href="/api/auth/signin">Sign in to save</Link>}<button className="text-button" onClick={() => setStep("skills")}>Back to skills</button></div>
          {session !== "signed-in" && <p className="hint">Guest entries remain in this page only and will be lost if you leave or sign in.</p>}
          {saveMessage && <p role="status">{saveMessage}</p>}
          {session === "signed-in" && <><div className="divider" /><h2>Saved plans</h2>{saved.length ? <ul className="saved-list">{saved.map((entry) => <li key={entry.id}><span>{new Date(entry.createdAt).toLocaleString()}</span><button className="text-button" onClick={() => loadPlan(entry.payload)}>Open plan →</button></li>)}</ul> : <p>No saved plans to show.</p>}<p className="hint">You can <a href="/api/data/export">export your data</a> or delete your account and its data below.</p><DeleteAccount onDeleted={() => { clearMatches(); setSession("guest"); setSaved([]); setPlan(blankPlan); setAssessmentSession((session) => session + 1); setStep("welcome"); }} /></>}
        </section>
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
