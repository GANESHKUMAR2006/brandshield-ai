import fs from "fs";
import path from "path";
import { Client } from "pg";

const envPath = path.join(process.cwd(), ".env.local");
let connectionString = process.env.SUPABASE_DATABASE_URL;
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("SUPABASE_DATABASE_URL=")) {
      connectionString = trimmed.replace("SUPABASE_DATABASE_URL=", "").replace(/["']/g, "");
    }
  }
}

async function applyMigration() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261117000000_custom_roles_and_permissions.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf-8");

  console.log("Applying custom roles migration to isolated QA database...");
  await client.query(sql);
  console.log("Migration executed successfully!");

  // Verify created tables
  const tables = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'workspace_%'
    ORDER BY tablename
  `);
  console.log("Workspace tables:", tables.rows.map((r) => r.tablename));

  // Verify columns in workspace_memberships
  const cols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'workspace_memberships'
    ORDER BY ordinal_position
  `);
  console.log("workspace_memberships columns:", cols.rows.map((r) => `${r.column_name} (${r.data_type})`));

  await client.end();
}

applyMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
