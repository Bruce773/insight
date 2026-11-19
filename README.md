# InSight

InSight is an early-stage personal career exploration application. **Not for hiring or employment decisions.** It is not a diagnostic tool.

## Status and data prerequisites

The official O*NET database and questionnaire items are not included. They could not be obtained in this environment, and no synthetic occupation records, items, norms, or statistics have been substituted. The current interface provides an explicitly unscored exploration plan; it does **not** yet deliver the scored Quick/Full assessment, occupation matching, or ranked skill plan, even after importing data. It uses custom CSS rather than the requested Tailwind/shadcn components. The browser test covers the unavailable-assessment fallback, not the requested scored happy path. See [O*NET Resource Center](https://www.onetcenter.org/database.html) for the O*NET 31.0 database and [O*NET Web Services](https://services.onetcenter.org/) for API registration and licensing.

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

For example, after obtaining the actual items, an item import configuration in `data/items-import.json` can be:

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

## Architecture and privacy

The App Router provides the interface and server endpoints. Drizzle and Postgres store application data; Auth.js uses email magic links. Pure calculations are isolated in `src/lib/engine/`. Database imports are in `scripts/`, while external-service integration is in `src/lib/services/`. The facet-to-work-style mapping in `data/mappings/` is a placeholder, not a validated psychological mapping. Users can export or delete their account data through authenticated endpoints.

## Data attribution

O*NET data and the O*NET Interest Profiler are from the U.S. Department of Labor's O*NET program; use and attribution are subject to the [O*NET license](https://www.onetcenter.org/license.html). IPIP items are public domain; cite their original instruments and publications. BLS Employment Projections are a separate source of demand information. Lightcast data are not included. Percentiles must not be presented without appropriate, documented norms.
