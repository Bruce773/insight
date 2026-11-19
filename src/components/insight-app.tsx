"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AssessmentFlow, AssessmentScores, isAssessmentResult } from "@/components/assessment-flow";
import type { AssessmentResult } from "@/lib/engine/assessment";

type Occupation = { code: string; title: string; description: string | null; jobZone: number | null };
type Skill = { elementId: string; elementName: string; value: number; source: string };
type Plan = {
  version: 1;
  aspiration: string;
  horizon: string;
  occupation: Occupation | null;
  ratings: Record<string, number>;
  action: string;
  assessment?: AssessmentResult;
};
type Saved = { id: string; createdAt: string; payload: unknown };
type Step = "welcome" | "assessment" | "aspirations" | "skills" | "results";

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
    && (p.occupation === null || (typeof p.occupation === "object" && typeof p.occupation.code === "string" && typeof p.occupation.title === "string"))
    && (p.assessment === undefined || isAssessmentResult(p.assessment));
}

export function InsightApp() {
  const [step, setStep] = useState<Step>("welcome");
  const [plan, setPlan] = useState<Plan>(blankPlan);
  const [query, setQuery] = useState("");
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [skillState, setSkillState] = useState<{ code: string; items: Skill[]; message: string } | null>(null);
  const [catalogMessage, setCatalogMessage] = useState("");
  const [assessmentSession, setAssessmentSession] = useState(0);
  const [session, setSession] = useState<"checking" | "signed-in" | "guest">("checking");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const skills = skillState && plan.occupation && skillState.code === plan.occupation.code ? skillState.items : [];
  const skillMessage = !plan.occupation ? "" : skillState?.code === plan.occupation.code ? skillState.message : "Loading imported skills…";

  useEffect(() => {
    getJson("/api/auth/session").then((data) => {
      if (data?.user) {
        setSession("signed-in");
        getJson("/api/assessment/results").then((result) => setSaved(result.items)).catch(() => {});
      } else setSession("guest");
    }).catch(() => setSession("guest"));
  }, []);

  useEffect(() => {
    if (step !== "aspirations") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setCatalogMessage("Searching the imported occupation catalog…");
      fetch(`/api/assessment/catalog?type=occupations&q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          setOccupations(data.items);
          setCatalogMessage(data.items.length ? "Showing up to 50 imported occupations." : "No imported occupations found. You can still write your aspiration below.");
        }).catch((error) => {
          if (error.name !== "AbortError") {
            setOccupations([]);
            setCatalogMessage("The occupation catalog is unavailable. You can still write your aspiration below.");
          }
        });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, step]);

  useEffect(() => {
    if (!plan.occupation) return;
    const controller = new AbortController();
    const code = plan.occupation.code;
    fetch(`/api/assessment/catalog?type=skills&occupation=${encodeURIComponent(code)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setSkillState({ code, items: data.items, message: data.items.length ? "" : "No imported skill importance ratings are available for this occupation." });
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
      getJson("/api/assessment/results").then((result) => setSaved(result.items)).catch(() => {});
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Your plan could not be saved.");
    }
  }

  function loadPlan(payload: unknown) {
    if (!isPlan(payload)) { setSaveMessage("This saved entry is not a plan that this version can open."); return; }
    setPlan(payload);
    setAssessmentSession((session) => session + 1);
    setSaveMessage("Saved plan loaded.");
    setStep("results");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="InSight home"><span className="brand-mark">✳</span> InSight</Link>
        <nav className="account" aria-label="Account and information">
          <Link href="/about" target="_blank" rel="noopener noreferrer" aria-label="About InSight (opens in a new tab)">About</Link>
          {session === "signed-in" ? <><a href="/api/data/export">Export data</a><button type="button" onClick={() => signOut({ redirectTo: "/" })}>Sign out</button></> : <Link prefetch={false} href="/api/auth/signin">Sign in</Link>}
        </nav>
      </header>
      <main>
        <div className="progress" aria-label="Your journey">
          {steps.map((item, index) => <button key={item.id} className={step === item.id ? "progress-item active" : "progress-item"} aria-current={step === item.id ? "step" : undefined} onClick={() => setStep(item.id)}><span>{index + 1}</span>{item.label}</button>)}
        </div>

        {step === "welcome" && <section className="hero">
          <div className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</div>
          <h1>Make space for<br /><em>what&apos;s next.</em></h1>
          <p className="lead">Explore what matters to you, reflect on your skills, and make a plan for your next chapter.</p>
          <div className="actions"><button className="primary" onClick={() => setStep("assessment")}>Get started <span aria-hidden>→</span></button><button className="text-button" onClick={() => setStep("aspirations")}>Skip to my plan →</button></div>
          <p className="hint">Guest progress stays in this page only and is lost on reload. Sign in to save a plan to your account.</p>
        </section>}

        <section className="content" hidden={step !== "assessment"}>
          <AssessmentFlow key={assessmentSession} result={plan.assessment}
            onComplete={(assessment) => setPlan((current) => ({ ...current, assessment }))}
            onSkip={() => { setPlan((current) => ({ ...current, assessment: undefined })); setStep("aspirations"); }}
            onContinue={() => setStep("aspirations")} onBack={() => setStep("welcome")} />
        </section>

        {step === "aspirations" && <section className="content">
          <div className="eyebrow">02 / LOOK AHEAD</div>
          <h1>What are you moving toward?</h1>
          <p className="lead">There&apos;s no right answer. Your aspiration can be specific or still taking shape.</p>
          <label htmlFor="aspiration">Your aspiration</label>
          <textarea id="aspiration" value={plan.aspiration} maxLength={4000} onChange={(e) => setPlan({ ...plan, aspiration: e.target.value })} placeholder="What would you like to explore or work toward?" />
          <label htmlFor="horizon">Your time horizon</label>
          <select id="horizon" value={plan.horizon} onChange={(e) => setPlan({ ...plan, horizon: e.target.value })}><option value="">Choose one (optional)</option><option>Within 6 months</option><option>6–12 months</option><option>1–3 years</option><option>More than 3 years</option><option>Not sure yet</option></select>
          <div className="divider" />
          <h2>Explore an occupation <span className="optional">optional</span></h2>
          <p>Search imported occupations to see their associated skills. This is your choice, not a recommendation.</p>
          <label htmlFor="occupation-search">Occupation or code</label>
          <input id="occupation-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search occupations" />
          <p className="hint" role="status">{catalogMessage}</p>
          {plan.occupation && <div className="selected-occupation"><strong>Selected: {plan.occupation.title}</strong><button className="text-button" onClick={() => setPlan({ ...plan, occupation: null, ratings: {} })}>Remove</button></div>}
          <div className="occupation-list">{occupations.map((occupation) => <button key={occupation.code} onClick={() => setPlan({ ...plan, occupation, ratings: {} })} aria-pressed={plan.occupation?.code === occupation.code}><span><strong>{occupation.title}</strong><small>{occupation.code}</small></span><span>{plan.occupation?.code === occupation.code ? "Selected ✓" : "Select →"}</span></button>)}</div>
          <div className="actions"><button className="primary" onClick={() => setStep("skills")}>Continue to skills →</button><button className="text-button" onClick={() => setStep("assessment")}>Back</button></div>
        </section>}

        {step === "skills" && <section className="content">
          <div className="eyebrow">03 / TAKE STOCK</div>
          <h1>Your skills, your perspective.</h1>
          <p className="lead">Rate your confidence in skills associated with your selected occupation. These are your own reflections, not a test of proficiency.</p>
          {!plan.occupation ? <div className="notice"><strong>No occupation selected</strong><p>Choose an imported occupation to see its skills, or continue to make a plan without ratings.</p><button className="text-button" onClick={() => setStep("aspirations")}>Choose an occupation →</button></div> : <><h2>{plan.occupation.title}</h2><p>Skills are ordered by the imported importance rating (IM). Your confidence rating uses a separate scale and is not compared with that rating.</p><p role="status">{skillMessage}</p><div className="skill-list">{skills.map((skill) => <div className="skill-row" key={skill.elementId}><div><strong>{skill.elementName}</strong><small>Importance: {skill.value} · Source: {skill.source}</small></div><label><span className="sr-only">Your confidence in {skill.elementName}</span><select value={plan.ratings[skill.elementId] ?? ""} onChange={(e) => { const ratings = { ...plan.ratings }; if (e.target.value) ratings[skill.elementId] = Number(e.target.value); else delete ratings[skill.elementId]; setPlan({ ...plan, ratings }); }}><option value="">Not rated</option><option value="1">1 – Low</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 – High</option></select></label></div>)}</div></>}
          <div className="actions"><button className="primary" onClick={() => setStep("results")}>See my plan →</button><button className="text-button" onClick={() => setStep("aspirations")}>Back</button></div>
        </section>}

        {step === "results" && <section className="content">
          <div className="eyebrow">04 / YOUR NEXT CHAPTER</div>
          <h1>A plan that starts with you.</h1>
          <p className="lead">{plan.assessment ? "Your assessment results and a summary of what you entered." : "A summary of what you entered. This is not a scored assessment or an occupation match."}</p>
          {plan.assessment && <AssessmentScores result={plan.assessment} />}
          <div className="summary"><div><span>YOUR ASPIRATION</span><p>{plan.aspiration || "You haven’t added an aspiration yet."}</p></div><div><span>TIME HORIZON</span><p>{plan.horizon || "Not specified"}</p></div><div><span>OCCUPATION YOU CHOSE</span><p>{plan.occupation?.title || "None selected"}</p></div></div>
          <h2>Your skill reflections</h2>
          {skills.filter((skill) => plan.ratings[skill.elementId]).length ? <ul className="reflection-list">{skills.filter((skill) => plan.ratings[skill.elementId]).map((skill) => <li key={skill.elementId}>{skill.elementName} <strong>{plan.ratings[skill.elementId]} / 5 confidence</strong></li>)}</ul> : <p>No skill ratings to show. You can add them on the skills step.</p>}
          <label htmlFor="action">One next step you want to take</label>
          <textarea id="action" value={plan.action} maxLength={4000} onChange={(e) => setPlan({ ...plan, action: e.target.value })} placeholder="Write an action that feels useful to you." />
          <div className="actions">{session === "signed-in" ? <button className="primary" onClick={savePlan}>Save my plan</button> : <Link prefetch={false} className="primary" href="/api/auth/signin">Sign in to save</Link>}<button className="text-button" onClick={() => setStep("skills")}>Back to skills</button></div>
          {session !== "signed-in" && <p className="hint">Guest entries remain in this page only and will be lost if you leave or sign in.</p>}
          {saveMessage && <p role="status">{saveMessage}</p>}
          {session === "signed-in" && <><div className="divider" /><h2>Saved plans</h2>{saved.length ? <ul className="saved-list">{saved.map((entry) => <li key={entry.id}><span>{new Date(entry.createdAt).toLocaleString()}</span><button className="text-button" onClick={() => loadPlan(entry.payload)}>Open plan →</button></li>)}</ul> : <p>No saved plans to show.</p>}<p className="hint">You can <a href="/api/data/export">export your data</a> or delete your account and its data below.</p><DeleteAccount onDeleted={() => { setSession("guest"); setSaved([]); setPlan(blankPlan); setAssessmentSession((session) => session + 1); setStep("welcome"); }} /></>}
        </section>}
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
