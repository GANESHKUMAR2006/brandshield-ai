import { Client } from "pg";
import fs from "fs";
import path from "path";

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
let connectionString = process.env.SUPABASE_DATABASE_URL;
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("SUPABASE_DATABASE_URL=")) {
      connectionString = trimmed.substring("SUPABASE_DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
      break;
    }
  }
}

async function investigate() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== 1. Check auth.users ===");
  const usersRes = await client.query(`
    SELECT id, email, created_at, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
    FROM auth.users
    ORDER BY created_at ASC
  `);
  console.log("Total auth.users count:", usersRes.rows.length);
  for (const u of usersRes.rows) {
    console.log(`- ID: ${u.id} | Email: ${u.email} | Confirmed: ${Boolean(u.email_confirmed_at)} | Metadata:`, JSON.stringify(u.raw_user_meta_data));
  }

  console.log("\n=== 2. Check workspaces ===");
  const wsRes = await client.query(`
    SELECT id, name, slug, created_at
    FROM workspaces
    ORDER BY created_at ASC
  `);
  for (const w of wsRes.rows) {
    console.log(`- Workspace ID: ${w.id} | Name: ${w.name} | Slug: ${w.slug}`);
  }

  console.log("\n=== 3. Check workspace_memberships ===");
  const memRes = await client.query(`
    SELECT wm.id, wm.workspace_id, w.name as workspace_name, w.slug, wm.user_id, u.email, wm.role, wm.status, wm.created_at
    FROM workspace_memberships wm
    LEFT JOIN workspaces w ON wm.workspace_id = w.id
    LEFT JOIN auth.users u ON wm.user_id = u.id
    ORDER BY wm.created_at ASC
  `);
  for (const m of memRes.rows) {
    console.log(`- Member ID: ${m.id} | User: ${m.email} (${m.user_id}) | Role: ${m.role} | Status: ${m.status} | Workspace: ${m.workspace_name} (${m.slug})`);
  }

  console.log("\n=== 3b. Members of Workspace '00000000-0000-0000-0000-000000000001' (DermaGlow) ===");
  const dermaglowRes = await client.query(`
    SELECT wm.id, wm.workspace_id, wm.user_id, u.email, wm.role, wm.status, wm.created_at, wm.updated_at
    FROM workspace_memberships wm
    JOIN auth.users u ON wm.user_id = u.id
    WHERE wm.workspace_id = '00000000-0000-0000-0000-000000000001'
    ORDER BY wm.created_at ASC
  `);
  for (const m of dermaglowRes.rows) {
    console.log(`- Member ID: ${m.id} | Email: ${m.email} | Role: ${m.role} | Status: ${m.status}`);
  }
  const invRes = await client.query(`
    SELECT id, workspace_id, email, role, status, expires_at, accepted_at, accepted_by, invited_by, created_at
    FROM workspace_invitations
    ORDER BY created_at DESC
    LIMIT 10
  `);
  for (const i of invRes.rows) {
    console.log(`- Invite ID: ${i.id} | Email: ${i.email} | Role: ${i.role} | Status: ${i.status} | Accepted By: ${i.accepted_by} | Created: ${i.created_at}`);
  }

  await client.end();
}

investigate().catch(err => {
  console.error("Investigation error:", err);
  process.exit(1);
});
