import { Client } from "pg";
import fs from "fs";
import path from "path";
import { AuditService } from "../src/lib/audit/audit-service";

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

async function reconcile() {
  console.log("========================================================================");
  console.log(" RECONCILING QA ADMIN ACCESS ON ISOLATED QA SUPABASE ENVIRONMENT        ");
  console.log("========================================================================\n");

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const workspaceId = "00000000-0000-0000-0000-000000000001";
  const adminUserId = "22575e06-b0ac-4a5e-9391-58c7f6937298";
  const misacceptedInviteId = "d1e3eab3-5b8e-4abe-860e-93262887953b";

  try {
    await client.query("BEGIN");

    // 1. Check current role before reconciliation
    const beforeCheck = await client.query(
      `SELECT role, status FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, adminUserId]
    );
    console.log("Current admin@dermaglow.com role before update:", beforeCheck.rows[0]);

    // 2. Restore admin@dermaglow.com to 'admin' role
    const updateMemRes = await client.query(
      `UPDATE workspace_memberships
       SET role = 'admin', updated_at = now()
       WHERE workspace_id = $1 AND user_id = $2
       RETURNING id, workspace_id, user_id, role, status, updated_at`,
      [workspaceId, adminUserId]
    );
    console.log("Updated workspace_memberships record:", updateMemRes.rows[0]);

    // 3. Reset misaccepted invitation for tosaran09@gmail.com back to pending
    const updateInvRes = await client.query(
      `UPDATE workspace_invitations
       SET status = 'pending', accepted_at = null, accepted_by = null, updated_at = now()
       WHERE id = $1
       RETURNING id, email, role, status, accepted_by, updated_at`,
      [misacceptedInviteId]
    );
    console.log("Reset workspace_invitations record:", updateInvRes.rows[0]);

    // 4. Record compensatory audit log entry
    await AuditService.recordEvent({
      workspaceId,
      actorId: adminUserId,
      actorRole: "admin",
      actorName: "System Reconciliation",
      actorEmail: "admin@dermaglow.com",
      entityType: "workspace",
      entityId: updateMemRes.rows[0].id,
      action: "membership_reconciled",
      beforeState: { role: beforeCheck.rows[0]?.role || "compliance_reviewer", reason: "downgraded_by_wrong_session_invite" },
      afterState: { role: "admin", reason: "reconciled_qa_admin_privileges" },
    }, client as any);
    console.log("Compensatory immutable audit log appended.");

    await client.query("COMMIT");
    console.log("\nReconciliation transaction successfully committed.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Reconciliation failed, rolled back:", err);
    throw err;
  } finally {
    await client.end();
  }
}

reconcile().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
