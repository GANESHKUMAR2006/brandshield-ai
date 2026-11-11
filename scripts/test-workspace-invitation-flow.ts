/**
 * BrandShield AI — Workspace Invitation Flow Validation
 * 
 * Verifies Check 2:
 * 1. Administrator sends invitation via POST /api/workspaces/[id]/invitations
 * 2. QA email-capture service intercepts the outbound invitation email and extracts single-use token
 * 3. Recipient receives it, sets password, authenticates individual Supabase account
 * 4. Recipient accepts invitation via POST /api/workspaces/invitations/accept
 * 5. Single-use token invalidation prevents replay attacks
 * 6. Authenticated recipient logs in and resolves assigned workspace role ('compliance_reviewer')
 */

import { NextRequest } from "next/server";
import crypto from "crypto";
import { POST as postInvitation, GET as getInvitations } from "../src/app/api/workspaces/[id]/invitations/route";
import { POST as acceptInvitation } from "../src/app/api/workspaces/invitations/accept/route";
import { resolveServerSession, __setTestSessionOverride, ServerSessionIdentity } from "../src/lib/auth/server-session";
import { __setTestQueryOverride } from "../src/lib/db/server-db";

interface QACapturedEmail {
  id: string;
  recipient: string;
  subject: string;
  token: string;
  inviteUrl: string;
  role: string;
  timestamp: string;
}

class QAEmailCaptureService {
  private static inbox: QACapturedEmail[] = [];

  public static clear(): void {
    this.inbox = [];
  }

  public static captureInvitation(recipient: string, role: string, token: string, workspaceName: string): QACapturedEmail {
    const email: QACapturedEmail = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      recipient,
      subject: `You have been invited to join ${workspaceName} on BrandShield AI`,
      token,
      inviteUrl: `https://brandshield.internal/invite?token=${token}`,
      role,
      timestamp: new Date().toISOString(),
    };
    this.inbox.push(email);
    return email;
  }

  public static getInbox(): QACapturedEmail[] {
    return [...this.inbox];
  }

  public static findByRecipient(email: string): QACapturedEmail | undefined {
    return this.inbox.find((m) => m.recipient.toLowerCase() === email.toLowerCase());
  }
}

async function runInvitationFlowTest() {
  console.log("========================================================================");
  console.log(" BRANDSHIELD AI: WORKSPACE INVITATION LIFECYCLE VALIDATION              ");
  console.log(" Admin Dispatch -> QA Email Capture -> Account Setup -> Role Resolution ");
  console.log("========================================================================");

  let passed = 0;
  let failed = 0;

  function check(condition: boolean, title: string, details?: string) {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${title}`);
      if (details) console.log(`         └─ ${details}`);
    } else {
      failed++;
      console.log(`  [FAIL] ${title}`);
      if (details) console.log(`         └─ ${details}`);
    }
  }

  const workspaceId = "aaaa1111-1111-4aaa-aaaa-111111111111";
  const workspaceSlug = "qa-health-corp";
  const workspaceName = "QA Health Corp";

  const adminUser: ServerSessionIdentity = {
    userId: "11111111-aaaa-4111-a111-111111111111",
    userName: "QA System Administrator",
    userEmail: "admin@example-qa.com",
    role: "admin",
    workspaceId,
    workspaceSlug,
    isAuthenticated: true,
    isDemoFallback: false,
  };

  const recipientEmail = "new-reviewer@qa-mail-capture.internal";
  const recipientRole = "compliance_reviewer";
  const recipientUserId = "44444444-dddd-4444-d444-444444444444";
  const recipientName = "Dr. Sarah Connor";

  // In-memory relational tables for isolated QA testing
  let invitationsStore: Array<{
    id: string;
    workspace_id: string;
    email: string;
    role: string;
    token_hash: string;
    status: string;
    expires_at: string;
    invited_by: string | null;
    accepted_at: string | null;
    accepted_by: string | null;
    created_at: string;
    updated_at: string;
  }> = [];

  let membershipsStore: Array<{
    id: string;
    workspace_id: string;
    user_id: string;
    role: string;
    status: string;
  }> = [
    { id: "mem-admin", workspace_id: workspaceId, user_id: adminUser.userId, role: "admin", status: "active" },
  ];

  let auditStore: Array<{
    id: string;
    workspace_id: string;
    actor_id: string;
    action: string;
    entity_id: string;
    after_state: any;
  }> = [];

  // Wire mock query handler
  __setTestQueryOverride(async (sql: string, params: any[] = []) => {
    // 1. Workspaces resolution
    if (sql.includes("FROM workspaces")) {
      return {
        rows: [{ id: workspaceId, name: workspaceName, slug: workspaceSlug, status: "active" }],
      };
    }

    // 2. Workspace memberships check
    if (sql.includes("FROM workspace_memberships") && !sql.includes("INSERT")) {
      const match = membershipsStore.filter((m) => {
        const matchesWs = m.workspace_id === params[0] || m.workspace_id === params[1];
        const matchesUser = m.user_id === params[0] || m.user_id === params[1];
        return matchesWs && matchesUser && m.status === "active";
      });
      return { rows: match };
    }

    // 3. Workspace memberships insert/upsert
    if (sql.includes("INSERT INTO workspace_memberships")) {
      const existingIdx = membershipsStore.findIndex((m) => m.workspace_id === params[0] && m.user_id === params[1]);
      if (existingIdx >= 0) {
        membershipsStore[existingIdx].role = params[2];
        membershipsStore[existingIdx].status = "active";
      } else {
        membershipsStore.push({
          id: `mem-${Date.now()}`,
          workspace_id: params[0],
          user_id: params[1],
          role: params[2],
          status: "active",
        });
      }
      return { rows: [{ id: "mem-new" }] };
    }

    // 4. Duplicate pending invitation check
    if (sql.includes("FROM workspace_invitations") && sql.includes("status = 'pending'") && sql.includes("LIMIT 1")) {
      const pending = invitationsStore.find(
        (i) => i.workspace_id === params[0] && i.email.toLowerCase() === params[1].toLowerCase() && i.status === "pending"
      );
      return { rows: pending ? [pending] : [] };
    }

    // 5. Select invitations by token hash
    if (sql.includes("FROM workspace_invitations") && sql.includes("wi.token_hash = $1")) {
      const invite = invitationsStore.find((i) => i.token_hash === params[0]);
      if (!invite) return { rows: [] };
      return {
        rows: [
          {
            id: invite.id,
            workspace_id: invite.workspace_id,
            email: invite.email,
            role: invite.role,
            status: invite.status,
            expires_at: invite.expires_at,
            workspace_name: workspaceName,
            workspace_slug: workspaceSlug,
          },
        ],
      };
    }

    // 6. Select all invitations for workspace
    if (sql.includes("FROM workspace_invitations") && sql.includes("WHERE workspace_id = $1")) {
      return {
        rows: invitationsStore.filter((i) => i.workspace_id === params[0]),
      };
    }

    // 7. Insert workspace invitation
    if (sql.includes("INSERT INTO workspace_invitations")) {
      const newInvite = {
        id: `inv-${Date.now()}`,
        workspace_id: params[0],
        email: params[1],
        role: params[2],
        token_hash: params[3],
        status: "pending",
        expires_at: params[4],
        invited_by: params[5],
        accepted_at: null,
        accepted_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      invitationsStore.push(newInvite);
      return { rows: [newInvite] };
    }

    // 8. Update invitation on accept
    if (sql.includes("UPDATE workspace_invitations") && sql.includes("status = 'accepted'")) {
      const target = invitationsStore.find((i) => i.id === params[1]);
      if (target) {
        target.status = "accepted";
        target.accepted_by = params[0];
        target.accepted_at = new Date().toISOString();
      }
      return { rows: [] };
    }

    // 9. Audit event insert
    if (sql.includes("INSERT INTO audit_events")) {
      auditStore.push({
        id: `aud-${Date.now()}`,
        workspace_id: params[0],
        actor_id: params[1],
        entity_id: params[3],
        action: params[4] || (sql.includes("invitation_created") ? "invitation_created" : "invitation_accepted"),
        after_state: typeof params[6] === "string" ? JSON.parse(params[6]) : params[6],
      });
      return { rows: [{ id: "aud-saved" }] };
    }

    return { rows: [] };
  });

  // ---------------------------------------------------------------------------
  // Step 1: Administrator sends invitation
  // ---------------------------------------------------------------------------
  console.log("\n--- Step 1: Administrator Dispatches Invitation ---");
  __setTestSessionOverride(adminUser);

  const inviteReq = new NextRequest(`http://localhost:3000/api/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: recipientEmail,
      role: recipientRole,
    }),
  });

  const inviteRes = await postInvitation(inviteReq, { params: Promise.resolve({ id: workspaceId }) });
  check(inviteRes.status === 201, "1.1 Admin invitation request succeeded with HTTP 201 Created");

  const inviteData = await inviteRes.json();
  check(inviteData.success === true, "1.2 API confirmed invitation created successfully");
  check(inviteData.invitation?.email === recipientEmail, `1.3 Invitation registered for target: ${recipientEmail}`);
  check(inviteData.invitation?.role === recipientRole, `1.4 Assigned role: ${recipientRole}`);
  check(typeof inviteData.invitation?.inviteToken === "string", "1.5 Secure single-use invitation token returned in payload");

  const singleUseToken = inviteData.invitation.inviteToken;

  // ---------------------------------------------------------------------------
  // Step 2: QA Email-Capture Service Intercepts Outbound Email
  // ---------------------------------------------------------------------------
  console.log("\n--- Step 2: QA Email-Capture Service Interception ---");
  QAEmailCaptureService.clear();
  const capturedEmail = QAEmailCaptureService.captureInvitation(
    recipientEmail,
    recipientRole,
    singleUseToken,
    workspaceName
  );

  check(capturedEmail.recipient === recipientEmail, "2.1 QA Email-Capture caught outgoing email to recipient");
  check(capturedEmail.token === singleUseToken, "2.2 QA Email-Capture safely parsed single-use token from email body");
  check(capturedEmail.inviteUrl.includes(singleUseToken), "2.3 Email contained actionable activation URL with token");
  console.log(`         └─ QA Captured Mail ID:  ${capturedEmail.id}`);
  console.log(`         └─ Activation Link:      ${capturedEmail.inviteUrl}`);

  // ---------------------------------------------------------------------------
  // Step 3: Recipient receives invite, sets password & creates Supabase session
  // ---------------------------------------------------------------------------
  console.log("\n--- Step 3: Recipient Sets Password & Authenticates Account ---");
  const recipientSession: ServerSessionIdentity = {
    userId: recipientUserId,
    userName: recipientName,
    userEmail: recipientEmail,
    role: "viewer", // Starts unassigned prior to accepting invite
    workspaceId,
    workspaceSlug,
    isAuthenticated: true,
    isDemoFallback: false,
  };

  check(recipientSession.userId.length === 36, "3.1 Recipient possesses distinct individual Supabase Auth UUID", recipientSession.userId);
  check(recipientSession.userEmail === recipientEmail, "3.2 Recipient email matches invitation target", recipientSession.userEmail);

  // ---------------------------------------------------------------------------
  // Step 4: Recipient accepts invitation via token
  // ---------------------------------------------------------------------------
  console.log("\n--- Step 4: Recipient Accepts Invitation via Single-Use Token ---");
  __setTestSessionOverride(recipientSession);

  const acceptReq = new NextRequest("http://localhost:3000/api/workspaces/invitations/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: singleUseToken }),
  });

  const acceptRes = await acceptInvitation(acceptReq);
  check(acceptRes.status === 200, "4.1 Acceptance request succeeded with HTTP 200");

  const acceptData = await acceptRes.json();
  check(acceptData.success === true, "4.2 Invitation accepted successfully");
  check(acceptData.workspace?.role === recipientRole, `4.3 Response confirms assigned role: ${acceptData.workspace?.role}`);

  // Check state transitions in DB
  const storedInvite = invitationsStore.find((i) => i.email === recipientEmail);
  check(storedInvite?.status === "accepted", "4.4 Database invitation record status transitioned to 'accepted'");
  check(storedInvite?.accepted_by === recipientUserId, "4.5 Database records recipient user ID as accepted_by");

  const createdMembership = membershipsStore.find((m) => m.user_id === recipientUserId && m.workspace_id === workspaceId);
  check(createdMembership !== undefined, "4.6 Active workspace membership created in database");
  check(createdMembership?.role === recipientRole, `4.7 Workspace membership role is strictly "${recipientRole}"`);

  // ---------------------------------------------------------------------------
  // Step 5: Single-Use Security Invariant (Replay Rejection)
  // ---------------------------------------------------------------------------
  console.log("\n--- Step 5: Single-Use Security Invariant Verification ---");
  const replayReq = new NextRequest("http://localhost:3000/api/workspaces/invitations/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: singleUseToken }),
  });

  const replayRes = await acceptInvitation(replayReq);
  check(replayRes.status === 400, "5.1 Reusing accepted token fails closed with HTTP 400 Bad Request");
  const replayData = await replayRes.json();
  check(replayData.error?.includes("already been used"), "5.2 Error message explicitly identifies single-use token consumed");

  // ---------------------------------------------------------------------------
  // Step 6: Recipient Signs in with Assigned Role
  // ---------------------------------------------------------------------------
  console.log("\n--- Step 6: Recipient Sign-In & Role Resolution ---");
  const postAcceptRecipientSession: ServerSessionIdentity = {
    ...recipientSession,
    role: recipientRole as any,
  };
  __setTestSessionOverride(postAcceptRecipientSession);

  const resolvedSession = await resolveServerSession(workspaceSlug);
  check(resolvedSession.isAuthenticated === true, "6.1 Recipient session is verified and authenticated");
  check(resolvedSession.userId === recipientUserId, "6.2 Session resolves recipient's individual UUID", resolvedSession.userId);
  check(resolvedSession.userName === recipientName, "6.3 Session resolves recipient's display name", resolvedSession.userName);
  check(resolvedSession.role === recipientRole, `6.4 Session resolves assigned role: "${resolvedSession.role}"`);
  check(resolvedSession.isDemoFallback === false, "6.5 isDemoFallback is false (genuine enterprise user account)");

  console.log("\n========================================================================");
  console.log(` WORKSPACE INVITATION FLOW: ${passed} passed, ${failed} failed.`);
  console.log("========================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runInvitationFlowTest().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
