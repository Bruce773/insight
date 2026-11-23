/**
 * Netlify Plugin: Setup Database
 * 
 * This plugin automatically runs database migrations during the build
 * process, but ONLY if explicitly enabled via environment variable.
 * 
 * To run migrations on deployment:
 * 1. Set SKIP_DB_SETUP=false in Netlify environment
 * 2. Deploy normally
 * 3. After first deploy, set SKIP_DB_SETUP=true to disable
 * 
 * This prevents accidental migrations on every redeploy.
 */

export const onPreBuild = async ({ utils: { build, run } }) => {
  const skipDbSetup = process.env.SKIP_DB_SETUP !== "false";
  
  if (skipDbSetup) {
    console.log("⏭️  Skipping database setup (SKIP_DB_SETUP=true)");
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.warn("⚠️  DATABASE_URL not set. Skipping database setup.");
    console.warn("   After Neon integration, set DATABASE_URL in Netlify environment.");
    return;
  }

  console.log("🔧 Setting up database...");
  
  try {
    // Run migrations
    console.log("📦 Running database migrations...");
    await run.command("pnpm db:migrate");
    console.log("✅ Database migrations completed");
    
    console.log("💡 Tip: Set SKIP_DB_SETUP=true to disable automatic migrations on future deploys");
  } catch (error) {
    console.error("❌ Database setup failed:", error.message);
    console.error("   Make sure DATABASE_URL is configured correctly in Netlify environment");
    throw new Error("Database setup failed - deployment aborted");
  }
};
