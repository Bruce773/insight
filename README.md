# InSight

InSight is an early-stage personal career exploration application. **Not for hiring or employment decisions.** It is not a diagnostic tool.

## Status and data prerequisites

The official O*NET database and questionnaire items are not included, and no synthetic occupation records, assessment items, norms, or statistics have been substituted. After importing the verified item sets, the Quick Mini-IPIP and Full IPIP-NEO-120 assessments can be completed and scored. The full assessment offers an optional experimental occupation comparison using an unvalidated mapping; it is not a recommendation or a prediction of success. Users can arrange their own skill priorities and build a roadmap, with optional local AI suggestions; the app does not infer a skill gap or produce a validated ranked skill plan. See [O*NET Resource Center](https://www.onetcenter.org/database.html) for the O*NET 31.0 database and [O*NET Web Services](https://services.onetcenter.org/) for API registration and licensing.

The IPIP is public domain. Obtain the actual IPIP-NEO-120 items and their keys from the [International Personality Item Pool](https://ipip.ori.org/) and the source for Johnson's 2014 instrument. Obtain Mini-IPIP items and keys from the original instrument's authoritative source, checking the terms for that source. Do not generate item text. No norms are shipped.

## Local setup

Requirements: Node.js 22, pnpm 12, Docker with Compose, an SMTP server, and the data sources above.

1. Copy `.env.example` to `.env.local` for Next.js and to `.env` for command-line import tools. Set `DATABASE_URL` to the local Compose Postgres connection string. The Compose database, user, and development-only password are all `insight`; host is `localhost` and port is `5432`.
2. Set `AUTH_SECRET` to a securely generated random value, set `AUTH_URL`, `EMAIL_SERVER`, and `EMAIL_FROM` to a working mail configuration, and optionally set `ONET_API_KEY`. Claude is optional and must be explicitly enabled.
3. Run `docker compose up -d`, `pnpm install`, and `pnpm db:migrate`.
4. Import licensed, authoritative data as described below, then run `pnpm dev` and open <http://localhost:3000>.

`pnpm lint`, `pnpm typecheck`, and `pnpm test` are the CI checks. `pnpm test:e2e` runs Playwright when the browser and required data are available. Auth.js currently declares an older Nodemailer peer range; the newer installed version avoids known advisories affecting those older versions.

## Importing data

Download and extract the O*NET 31.0 text files into `data/onet/`. `data/onet-import.example.json` maps filenames and columns in one place; adjust it for renamed files or columns, including changes introduced in release 30.3. Paths are relative to the configuration file. The example covers occupations, Job Zones, Work Styles, interests, skills, and knowledge; Technology Skills still require a suitable importer. Work Styles use WI (impact) and DR (distinctiveness rank), not IM and LV; the example normalizes WI from its documented -3 to 3 range. Do not equate DR with impact.

Importers accept a configuration file: `pnpm import:onet data/onet-import.example.json`, `pnpm import:items <config.json>`, or `pnpm import:demand <config.json>`. Export `DATABASE_URL` in the shell for CLI commands. Sources use `file`, optional `delimiter`, and optional `columns`; column entries can be source headers or `{"value":"constant"}`. Item sources must also identify the instrument and provenance, and demand sources must identify the metric and provenance. Item keys accept `+` and `-`. Imports upsert records and do not remove records absent from a later import.

For example, after obtaining the actual items, an item import configuration can contain:

```json
{
  "items": [{
    "file": "items/mini-ipip.csv",
    "columns": {
      "instrument": { "value": "Mini-IPIP" },
      "source": { "value": "IPIP / Mini-IPIP" }
    }
  }]
}
```

The CSV columns are `id,text,domain,facet,keyed`; the source file itself is not supplied. Adapt the configuration to the actual verified source and keep item IDs unique across instruments.

For the assessments, import the complete [Mini-IPIP key](https://ipip.ori.org/MiniIPIPKey.htm) as `Mini-IPIP` and the complete [Johnson IPIP-NEO-120 key](https://ipip.ori.org/30FacetNEO-PI-RItems.htm) as `IPIP-NEO-120`. The Mini-IPIP domains are `Surgency or Extraversion`, `Agreeableness`, `Conscientiousness`, `Neuroticism`, and `Intellect or Imagination`; leave its facets empty. For the full form, use the five domain names `Neuroticism`, `Extraversion`, `Openness to Experience`, `Agreeableness`, and `Conscientiousness`, and the facet labels from the IPIP key, including their codes (for example `N1: ANXIETY`). IDs can be chosen locally, but each must be unique.

The application verifies the complete imported wording, domains, facets, and key directions against fingerprints of those source keys before offering either form. An incomplete or different set remains unavailable. It uses the five-point accuracy scale described in the [Mini-IPIP questionnaire](https://socialsci.libretexts.org/Bookshelves/Psychology/Introductory_Psychology/General_Psychology_for_Honors_Students_(Votaw)/31%3A_Personality_Traits/31.06%3A_Appendix) and [IPIP-NEO-120 administration](https://ipip.ori.org/Mandarin%20translation%20of%20IPIP-NEO-120.htm), with a consistent interleaved question order. Scores are reverse-keyed sums, not percentiles; no norms are supplied. Completed guest assessments are included in the browser draft; signed-in users can save their assessment answers and scores with their plan.

## Browser-local AI ideas

Users may write an aspiration and their existing skills without selecting an occupation. On the plan page, an explicit action starts local inference with [WebLLM](https://github.com/mlc-ai/web-llm) and the [Qwen3.5-4B model](https://huggingface.co/Qwen/Qwen3.5-4B) (Apache 2.0), using WebLLM's quantized `Qwen3.5-4B-q4f32_1-MLC` build. It requires a secure context, a WebGPU-enabled browser and sufficient device memory; WebLLM estimates approximately 4.7 GB GPU memory. The initial download is approximately 2.4 GB and may take a long time. Model files and the WebGPU library are downloaded from Hugging Face and GitHub and may be cached by the browser; those hosts can observe the download. Initialization or generation can fail on unsupported or resource-constrained devices, including when a browser or private session has insufficient storage quota. Cancel stops the worker.

On the plan page, **Manage local AI model** removes the downloaded model from this browser. Generating ideas again downloads it again. Removing it does not delete a saved plan or chosen priority.

For skill ideas, the app fetches only the public list of skill IDs and names from imported O*NET essential and transferable skill ratings. The model selects skill and score references; the app validates each reference against the supplied catalog and scores and does not display model-written explanations. For roadmap suggestions, it sends the aspiration, existing skills, chosen occupation, available assessment scores, exact duration, ordered priorities, and existing steps to the browser worker, not an AI API. The model writes optional action suggestions; users must review and add each one individually. Generated steps are not verified facts or professional advice. Users can also add, edit, reorder, and remove their own skills and steps without AI. Step cards expand to show details; use the edit button to change the title, timing, and notes, or drag the handle (or use the move buttons) to change their order. An exact whole-number duration in weeks, months, or years is required for timed AI suggestions. Earlier range-only plans remain readable and require an exact duration for generation. Changes to earlier answers discard pending suggestions and flag retained roadmap items for review; accepted work is not automatically deleted. Local generation has input-size limits; longer roadmaps can still be edited manually.

Guest plans, including completed assessments and roadmap edits, are automatically stored in browser local storage on the same device, where other users of that browser may access them. A guest can delete the browser draft and start over. After signing in on the same browser, the user can open the guest draft without overwriting saved plans, then explicitly save it to the account; a successful save removes that browser draft. An email link opened in another browser or device cannot access it. Signed-in plan snapshots are saved explicitly to authenticated storage and are not automatically placed in the guest draft. Browser storage can be unavailable or cleared by the browser; it is not a substitute for an account save. Incomplete assessment answers remain in the page until the assessment is completed.

These are unvalidated suggestions for reflection, not measured proficiency, personality deficits, skill gaps, occupation matches, or predictions. The model may suggest an existing skill or an irrelevant connection. It has not been evaluated for this use; users should check ideas and make their own decisions. The source catalog is derived from imported occupation ratings and may be incomplete or contain obsolete entries if imports have changed; the importer does not retain O*NET suppression flags.

## Experimental comparisons

After completing the full assessment, users can open optional occupation exploration and opt in to a comparison on the aspirations step. In the browser, the app maps seven facet scores to four work styles using the illustrative mapping in `data/mappings/facet-to-workstyle.json`, then compares those values with normalized O*NET 31.0 Work Styles WI values. The similarity is the Pearson correlation across the four shared work styles, rescaled to 0–1; it is neither a percentile nor a probability. Occupations missing any of the four values, and comparisons with zero variance, are excluded. The quick assessment has no facet scores and cannot use this feature.

The mapping and comparison have not been calibrated or validated, and O*NET has not endorsed them. They must not be used for hiring or employment decisions. Assessment answers and scores are not sent to the catalog endpoint to calculate comparisons. A selected occupation and the user's own choice of a focus skill can be saved as part of a plan; confidence ratings are not treated as proficiency or compared to O*NET importance scores.

### Research evidence and validation status

The following is a literature-informed review, not an empirical validation of InSight:

- **Personality measures:** [Donnellan et al. (2006)](https://pubmed.ncbi.nlm.nih.gov/16768595/) reported reliability and validity evidence for the 20-item Mini-IPIP across five studies. [Johnson (2014)](https://doi.org/10.1016/j.jrp.2014.05.003) developed and studied the 120-item IPIP-NEO, including its 30 four-item facets. These studies support measuring personality, not the validity of InSight's modified presentation, crosswalk, or occupation rankings. Short facet scores are imprecise and no population norms are supplied.
- **Personality is not interest:** [Hurtado Rua et al. (2019)](https://doi.org/10.1177/1069072718780447) found that Big Five traits and RIASEC interests are related but distinct constructs. The [O*NET Interest Profiler](https://www.onetcenter.org/IP.html) measures interests directly; its [technical manual](https://www.onetcenter.org/reports/IP_Manual.html) describes its research and occupation linkage. It is a better-established starting point for interest-based exploration, but integrating it would require its documented scoring, licensing, privacy review, and validation of InSight's use.
- **Crosswalk and comparison:** The four links in `data/mappings/facet-to-workstyle.json` are illustrative, not published or empirically estimated equivalences; similar names alone are not validation of the links, directions, or equal weights. O*NET's [Work Styles research](https://www.onetcenter.org/reports/Work_Styles_New.html) supports its own taxonomy, not this crosswalk. Its [WI scale](https://www.onetcenter.org/dictionary/31.0/oracle/work_styles.html) describes an occupational work style's impact on performance, not the distribution of people's personality scores. The 31.0 ratings were developed using a [hybrid AI and expert method](https://www.onetcenter.org/reports/Hybrid_AI_Ratings.html). Correlating four inferred personal values with four occupational impact ratings compares relative shapes, not absolute levels; high similarity does not establish fit or suitability. O*NET's [interest-profile correlation method](https://www.onetcenter.org/reports/IP_Career_Returns.html) compares interest profiles and does not validate this different cross-construct comparison.
- **Skills:** O*NET reports separate [essential](https://www.onetcenter.org/dictionary/31.0/oracle/essential_skills.html) and [transferable](https://www.onetcenter.org/dictionary/31.0/oracle/transferable_skills.html) skills. Its [importance and level scales](https://online.onetonline.org/help/online/scales) measure different occupational characteristics. A user's confidence is neither an O*NET skill-level rating nor a measured proficiency score. [Zell and Krizan's (2014) metasynthesis](https://doi.org/10.1177/1745691613518075) found only moderate correspondence between ability self-evaluation and external performance measures across studies. InSight does not subtract confidence from occupational ratings; the generic `mergeSkillPriorities` helper is not used by the interface and is not validated for this purpose. The importer currently does not retain O*NET skill uncertainty or suppression flags, so future scoring or displays must address them before claiming precision.

Before calling a crosswalk or skill-ranking system validated, an independent qualified psychometrician should define the intended use and measurable outcomes, review the facet-to-style links and scoring, and preregister a study. With informed consent and appropriate ethics/privacy review, collect representative data on the intended population, assess reliability and convergent/discriminant validity against suitable independent measures, and evaluate whether suggestions help users explore careers. Compare against simple baselines and an appropriately implemented interest-based approach; use a held-out sample, report uncertainty and subgroup performance where consent and sample size permit, and replicate findings. Evaluate skill judgments against independent, task-specific evidence rather than treating confidence as proficiency. Agree on success criteria and sample sizes before collecting data. Until then, keep the comparison experimental and do not infer hiring suitability or a validated skill gap.

## Production deployment on Netlify

Netlify runs the App Router and route handlers using its Next.js integration; Docker Compose is for **local PostgreSQL only**, not the production app. The repository pins Node 22 and pnpm for the Netlify build. Connect the repository in Netlify and use the `pnpm build` command from `netlify.toml`; let Netlify detect and configure Next.js rather than deploying a static export. See [Netlify's Next.js guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

Before a public launch:

1. Provision managed PostgreSQL with TLS, automated backups and a tested restore procedure, plus an authenticated SMTP service and verified sender domain. Use a connection pooler compatible with serverless workloads; each app instance can open one database connection, so pool capacity and Netlify concurrency must be planned together. Use a separate database, sender, and credentials for preview deployments.
2. Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `EMAIL_SERVER`, and `EMAIL_FROM` in Netlify's environment settings, with **Functions** scope (and Builds scope if required by the integration). Use the HTTPS production origin for `AUTH_URL`, a cryptographically random secret, and an SMTP connection with TLS (for example port 587). Do not use the development Compose password or commit credentials. Optional integration keys are not needed for the current experience. Netlify configuration file environment values are build-time only; do not put runtime secrets there.
3. From a trusted operator environment with the repository's dependencies and licensed source files, point `DATABASE_URL` at the intended production database using its TLS-enabled **direct or session** connection, then run `pnpm db:migrate`, `pnpm import:items data/items-import.json`, and `pnpm import:onet data/onet-import.example.json`. Verify the target before each operation and back it up before updating an existing catalog. Imports are transactional per command, upsert records, and do not remove obsolete records. Never run these automatically on every Netlify build. Supply the verified item CSVs and O*NET files locally; they are ignored by Git and are not deployed with the site.
4. Configure the production domain and HTTPS in Netlify. Restrict or disable deploy previews until their isolated database, auth URL, email, and secrets are configured. Never share production user data or secrets with previews.
5. Before exposing the site publicly, configure rate limiting/abuse protection for magic-link sign-in and public catalog endpoints, operational monitoring and alerts, a retention/privacy policy, and backup restoration. Review licensing and the experimental feature's suitability with an appropriately qualified reviewer.
6. Deploy and test on the actual Netlify URL: verify both assessment forms, occupation and skill data, experimental comparison, magic-link delivery, sign-in, save/reload, export, deletion, and same-origin request checks. Check function logs and database connections without logging personal answers or secrets. Verify a backup restore and redeploy/rollback procedure.

No hosted database, SMTP service, Netlify site, domain, or production secrets are provisioned by this repository. A successful local build does not verify Netlify adapter compatibility or a production deployment.

## Architecture and privacy

The App Router provides the interface and server endpoints. Drizzle and Postgres store application data; Auth.js uses email magic links. Pure calculations are isolated in `src/lib/engine/`. Database imports are in `scripts/`, while external-service integration is in `src/lib/services/`. The facet-to-work-style mapping in `data/mappings/` is a placeholder, not a validated psychological mapping. Users can export or delete their account data through authenticated endpoints.

## Data attribution

The in-app About page describes InSight's purpose and data sources. O*NET data and the O*NET Interest Profiler are from the U.S. Department of Labor's O*NET program; use and attribution are subject to the [O*NET database license](https://www.onetcenter.org/license_db.html) and, for the Interest Profiler, the [Career Exploration Tools license](https://www.onetcenter.org/license_tools.html). IPIP items are public domain; cite their original instruments and publications. BLS Employment Projections are a separate source of demand information. Lightcast data are not included. Percentiles must not be presented without appropriate, documented norms.
