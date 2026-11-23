#!/usr/bin/env node
/**
 * Data Import Setup Script
 * 
 * This script imports O*NET and assessment item data to a production Neon database.
 * 
 * Usage:
 *   export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
 *   node scripts/setup-production.ts
 * 
 * Or use pnpm:
 *   pnpm setup:production
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

const env = process.env;
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  error: (msg: string) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
  success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  warn: (msg: string) => console.warn(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  step: (msg: string) => console.log(`${colors.blue}→ ${msg}${colors.reset}`),
};

async function run(command: string, description: string): Promise<string> {
  if (verbose) {
    log.step(`Running: ${command}`);
  }
  try {
    const output = execSync(command, { 
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    }) as string;
    log.success(description);
    return output;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`${description}: ${errorMessage}`);
    throw error;
  }
}

async function validateSetup(): Promise<boolean> {
  log.step("Validating setup...");

  // Check DATABASE_URL
  if (!env.DATABASE_URL) {
    log.error("DATABASE_URL environment variable not set");
    console.error(`
Set it with:
  export DATABASE_URL="postgresql://user:password@db.host:5432/dbname?sslmode=require"

For Neon:
  export DATABASE_URL="postgresql://user:password@ep-xyz.us-east-1.neon.tech/dbname?sslmode=require"
    `);
    process.exit(1);
  }

  log.success("DATABASE_URL is set");

  // Check required data files exist
  const requiredFiles = [
    "data/items-import.json",
    "data/onet-import.example.json",
    "data/items/",
    "data/onet/",
  ];

  for (const file of requiredFiles) {
    if (!existsSync(file)) {
      log.warn(`Missing: ${file}`);
      if (file.includes("items") || file.includes("onet")) {
        console.error(`
📥 You need to:
1. Download O*NET 31.0 database from https://www.onetcenter.org/database.html
2. Extract to data/onet/
3. Create data/items-import.json from data/items-import.example.json
4. Add Mini-IPIP and IPIP-NEO-120 CSVs to data/items/

See README.md for details.
        `);
      }
      return false;
    }
  }

  log.success("All data files found");
  return true;
}

async function main(): Promise<void> {
  console.log(`${colors.cyan}
╔════════════════════════════════════════╗
║  InSight Production Database Setup     ║
║  Neon + O*NET + IPIP Import            ║
╚════════════════════════════════════════╝
${colors.reset}`);

  try {
    // Validate setup
    const isValid = await validateSetup();
    if (!isValid) {
      process.exit(1);
    }

    console.log();

    // Run migrations
    log.step("Step 1/3: Creating database schema...");
    await run("pnpm db:migrate", "Schema created");

    console.log();

    // Import items
    log.step("Step 2/3: Importing assessment items (Mini-IPIP, IPIP-NEO-120)...");
    await run(
      "pnpm import:items data/items-import.json",
      "Assessment items imported"
    );

    console.log();

    // Import O*NET
    log.step("Step 3/3: Importing O*NET occupations and skills...");
    await run(
      "pnpm import:onet data/onet-import.example.json",
      "O*NET data imported"
    );

    console.log();

    // Verify
    log.step("Verifying import...");
    const verifyQuery = `
      psql "$DATABASE_URL" -c "
        SELECT 'Items' as table_name, COUNT(*) as count FROM items
        UNION ALL
        SELECT 'Occupations', COUNT(*) FROM occupations
        UNION ALL
        SELECT 'Work Styles', COUNT(*) FROM work_styles;
      "
    `;

    try {
      await run(verifyQuery, "Data verified");
    } catch (e: unknown) {
      // psql might not be available, but that's okay
      log.warn("Could not verify via psql (not installed or not in PATH)");
    }

    console.log();
    console.log(`${colors.green}
╔════════════════════════════════════════╗
║  ✅ Setup Complete!                    ║
║                                        ║
║  Your Neon database is now ready:     ║
║  - Schema created                      ║
║  - Assessment items imported           ║
║  - O*NET data imported                 ║
║                                        ║
║  Next: Visit your Netlify app and test║
╚════════════════════════════════════════╝
${colors.reset}`);
  } catch (error: unknown) {
    console.log();
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`${colors.red}
╔════════════════════════════════════════╗
║  ❌ Setup Failed                       ║
║                                        ║
║  Error: ${errorMsg.substring(0, 27).padEnd(27)}║
║                                        ║
║  Troubleshooting:                      ║
║  1. Check DATABASE_URL is correct     ║
║  2. Verify data files exist in data/  ║
║  3. Run with --verbose for details    ║
╚════════════════════════════════════════╝
${colors.reset}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

