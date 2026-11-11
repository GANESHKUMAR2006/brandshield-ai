/**
 * BrandShield AI — Phase 6: Human Compliance Review & Publication Gate Service
 *
 * Enforces human review governance, reviewer role validation, claim modification
 * lineage, mandatory re-verification, transactional publication gating, and
 * append-only tamper-evident audit logging.
 */

import { query, withTransaction } from "@/lib/db/server-db";
import {
  ReviewDecisionType,
  ReviewStatus,
  ReviewerRole,
  EscalationCategory,
  PublicationEligibilityDetails,
  ClaimRecord,
} from "@/types";
import { ServerSessionIdentity, canReviewClaims, canOverrideContradictedClaims, canPublishSubmissions } from "@/lib/auth/server-session";
import { VerificationEngine } from "@/lib/verification/verification-engine";
import { AuditService } from "@/lib/audit/audit-service";

export interface SubmitDecisionInput {
  claimId: string;
  decision: ReviewDecisionType;
  comments?: string;
  overrideReason?: string;
  escalationCategory?: EscalationCategory;
  modifiedClaimText?: string;
}

export interface TransitionValidationResult {
  isValid: boolean;
  errors: string[];
  newStatus: ReviewStatus;
}

export interface PublicationCompilationResult {
  isPublishable: boolean;
  publishedContent: string;
  versionNumber: number;
  approvedClaimIds: string[];
  supersededClaimsCount: number;
  reconciledClaimsCount: number;
  unresolvedNonCompliantPhrases: string[];
}

// Cached check to determine whether Phase 9 policy columns exist on claims table
let cachedHasPhase9ClaimColumns: boolean | null = null;

async function checkPhase9ClaimColumns(client: { query: (q: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Promise<boolean> {
  if (cachedHasPhase9ClaimColumns === null) {
    try {
      const res = await client.query(
        `SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'claims' AND column_name = 'policy_compliance_status' LIMIT 1;`
      );
      cachedHasPhase9ClaimColumns = res.rows.length > 0;
    } catch {
      cachedHasPhase9ClaimColumns = false;
    }
  }
  return cachedHasPhase9ClaimColumns;
}

export class ReviewWorkflowService {
  /**
   * Pure state machine transition and rule validator.
   * Can be tested in isolation without database dependencies.
   */
  public static validateReviewTransition(
    currentReviewStatus: ReviewStatus,
    verificationStatus: string,
    riskLevel: string | null | undefined,
    decision: ReviewDecisionType,
    reviewerRole: ReviewerRole,
    options?: {
      overrideReason?: string;
      escalationCategory?: EscalationCategory;
      modifiedClaimText?: string;
      originalClaimText?: string;
      mandatoryReviewerRole?: ReviewerRole;
      policyComplianceStatus?: string;
      requiredEvidenceTypes?: string[];
      attachedEvidenceTypes?: string[];
    }
  ): TransitionValidationResult {
    const errors: string[] = [];

    // 1. Role Authorization Gate
    if (!canReviewClaims(reviewerRole)) {
      errors.push(`Role "${reviewerRole}" is not authorized to submit compliance review decisions.`);
      return { isValid: false, errors, newStatus: currentReviewStatus };
    }

    // Phase 9: Mandatory Reviewer Role Gate (e.g. Legal Reviewer required by policy)
    if (
      decision === "approved" &&
      options?.mandatoryReviewerRole &&
      reviewerRole !== "admin" &&
      reviewerRole !== options.mandatoryReviewerRole
    ) {
      errors.push(
        `Claim triggered a policy that mandates sign-off by "${options.mandatoryReviewerRole}". Role "${reviewerRole}" is not authorized to approve.`
      );
      return { isValid: false, errors, newStatus: currentReviewStatus };
    }

    let newStatus: ReviewStatus = currentReviewStatus;

    // Claims that have already been superseded by a modification cannot undergo further transitions directly
    if (currentReviewStatus === "modified") {
      errors.push("A modified claim has been superseded and cannot undergo direct review decisions; review must be conducted on its child replacement revision.");
      return { isValid: false, errors, newStatus: currentReviewStatus };
    }

    // 2. Decision Specific Invariants
    switch (decision) {
      case "approved": {
        newStatus = "approved";

        // Verification Pre-Condition: Cannot approve unverified assertions
        if (verificationStatus === "unverified") {
          errors.push("Claim cannot be approved while verification status is unverified. Deterministic verification must be executed before human approval.");
        }

        // Phase 9: Policy Compliance & Required Evidence Check
        const isNonCompliantPolicy = options?.policyComplianceStatus === "non_compliant";
        if (isNonCompliantPolicy) {
          if (!options?.overrideReason || options.overrideReason.trim().length < 10) {
            errors.push("Approving a policy non-compliant claim requires a documented override reason of at least 10 characters.");
          }
        }

        // Policy Required Evidence Types
        if (options?.requiredEvidenceTypes && options.requiredEvidenceTypes.length > 0) {
          const attached = (options.attachedEvidenceTypes || []).map((t) => t.toLowerCase());
          const missing = options.requiredEvidenceTypes.filter(
            (req) => !attached.includes(req.toLowerCase())
          );
          if (missing.length > 0 && (!options?.overrideReason || options.overrideReason.trim().length < 10)) {
            errors.push(
              `Claim lacks policy-mandated evidence type(s): [${missing.join(", ")}]. Provide evidence or document a compliance override.`
            );
          }
        }

        // Check if override is required
        const isContradicted = verificationStatus === "contradicted";
        const isHighOrCriticalRisk = riskLevel === "high" || riskLevel === "critical";
        const isOutdated = verificationStatus === "outdated";

        if (isContradicted || isHighOrCriticalRisk || isOutdated) {
          if (!canOverrideContradictedClaims(reviewerRole)) {
            errors.push(
              `Role "${reviewerRole}" is not authorized to approve high-risk or contradicted claims.`
            );
          }
          if (!options?.overrideReason || options.overrideReason.trim().length < 10) {
            errors.push(
              `Approving a ${verificationStatus} (${riskLevel || "standard"} risk) claim requires a documented override reason of at least 10 characters.`
            );
          }
        }
        break;
      }

      case "rejected": {
        newStatus = "rejected";
        break;
      }

      case "escalated": {
        newStatus = "escalated";
        if (!options?.escalationCategory) {
          errors.push("An escalation category must be specified when escalating a claim.");
        } else {
          const validCategories: EscalationCategory[] = [
            "legal",
            "regulatory",
            "clinical",
            "brand_compliance",
            "evidence_conflict",
            "other",
          ];
          if (!validCategories.includes(options.escalationCategory)) {
            errors.push(`Invalid escalation category: "${options.escalationCategory}".`);
          }
        }
        break;
      }

      case "modified": {
        newStatus = "modified";
        if (!options?.modifiedClaimText || options.modifiedClaimText.trim().length < 3) {
          errors.push("A valid modified claim text must be supplied when modifying a claim.");
        } else if (
          options.originalClaimText &&
          options.modifiedClaimText.trim() === options.originalClaimText.trim()
        ) {
          errors.push("Modified claim text cannot be identical to the original claim text.");
        }
        break;
      }

      default: {
        errors.push(`Unrecognized review decision: "${decision}".`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      newStatus,
    };
  }

  /**
   * Pure publication eligibility determination gate.
   * Enforces zero-claim rejection, 100% active claim approval, and absence of unresolved risks.
   * Can be tested in isolation without database dependencies.
   */
  public static evaluatePublicationEligibility(
    claims: Array<{
      id: string;
      review_status?: ReviewStatus | string;
      verification_status: string;
      risk_level?: string | null;
      is_active?: boolean;
      policy_compliance_status?: string | null;
      mandatory_reviewer_role?: string | null;
      required_evidence_types?: string[] | null;
      attached_evidence_types?: string[] | null;
      approved_by_role?: string | null;
      override_reason?: string | null;
    }>
  ): PublicationEligibilityDetails {
    const blockingReasons: string[] = [];
    const activeClaims = claims.filter((c) => c.is_active !== false);

    // Rule 10: Submissions with zero active claims must not automatically become eligible
    if (activeClaims.length === 0) {
      return {
        isEligible: false,
        eligible: false,
        totalActiveClaims: 0,
        approvedClaims: 0,
        unreviewedClaims: 0,
        contradictedClaims: 0,
        rejectedClaims: 0,
        escalatedClaims: 0,
        hasHighOrCriticalRisk: false,
        blockingReasons: ["Submission contains zero active marketing claims."],
        evaluatedAt: new Date().toISOString(),
        policyViolationsCount: 0,
        unmetEvidenceRequirementsCount: 0,
        missingMandatorySignoffsCount: 0,
      };
    }

    let approvedCount = 0;
    let unreviewedCount = 0;
    let contradictedCount = 0;
    let rejectedCount = 0;
    let escalatedCount = 0;
    let hasHighOrCriticalRisk = false;
    let policyViolationsCount = 0;
    let unmetEvidenceRequirementsCount = 0;
    let missingMandatorySignoffsCount = 0;

    for (const c of activeClaims) {
      const reviewStatus = c.review_status || "pending";

      if (reviewStatus === "approved") {
        approvedCount++;
      } else if (reviewStatus === "rejected") {
        rejectedCount++;
        blockingReasons.push(`Claim "${c.id}" was rejected by human compliance.`);
      } else if (reviewStatus === "escalated") {
        escalatedCount++;
        blockingReasons.push(`Claim "${c.id}" is escalated and awaiting specialized sign-off.`);
      } else if (reviewStatus === "modified") {
        blockingReasons.push(`Claim "${c.id}" was modified and its replacement revision is awaiting verification/review.`);
      } else {
        unreviewedCount++;
        blockingReasons.push(`Claim "${c.id}" is pending human compliance review.`);
      }

      // Check for unaddressed high/critical risk claims that were not approved
      if (
        (c.risk_level === "high" || c.risk_level === "critical") &&
        reviewStatus !== "approved"
      ) {
        hasHighOrCriticalRisk = true;
      }

      if (c.verification_status === "contradicted" && reviewStatus !== "approved") {
        contradictedCount++;
      }

      if (c.verification_status === "unverified") {
        blockingReasons.push(`Claim "${c.id}" is unverified. Deterministic verification must be completed prior to publication.`);
      }

      // Phase 9: Policy Intelligence Invariants
      if (c.policy_compliance_status === "non_compliant" && !c.override_reason) {
        policyViolationsCount++;
        blockingReasons.push(`Claim "${c.id}" is non-compliant with workspace policy and lacks a documented override.`);
      }

      if (c.mandatory_reviewer_role && c.approved_by_role) {
        if (c.approved_by_role !== c.mandatory_reviewer_role && c.approved_by_role !== "admin") {
          missingMandatorySignoffsCount++;
          blockingReasons.push(`Claim "${c.id}" requires mandatory sign-off by "${c.mandatory_reviewer_role}".`);
        }
      }

      if (c.required_evidence_types && c.required_evidence_types.length > 0 && !c.override_reason) {
        const attached = (c.attached_evidence_types || []).map((t) => t.toLowerCase());
        const missing = c.required_evidence_types.filter((r) => !attached.includes(r.toLowerCase()));
        if (missing.length > 0) {
          unmetEvidenceRequirementsCount++;
          blockingReasons.push(`Claim "${c.id}" lacks policy-mandated evidence type(s): [${missing.join(", ")}].`);
        }
      }
    }

    const allApproved = approvedCount === activeClaims.length;
    const hasUnverified = activeClaims.some((c) => c.verification_status === "unverified");
    const isEligible =
      allApproved &&
      !hasUnverified &&
      rejectedCount === 0 &&
      escalatedCount === 0 &&
      unreviewedCount === 0 &&
      contradictedCount === 0 &&
      blockingReasons.length === 0;

    return {
      isEligible,
      eligible: isEligible,
      totalActiveClaims: activeClaims.length,
      approvedClaims: approvedCount,
      unreviewedClaims: unreviewedCount,
      contradictedClaims: contradictedCount,
      rejectedClaims: rejectedCount,
      escalatedClaims: escalatedCount,
      hasHighOrCriticalRisk,
      blockingReasons,
      evaluatedAt: new Date().toISOString(),
      policyViolationsCount,
      unmetEvidenceRequirementsCount,
      missingMandatorySignoffsCount,
    };
  }

  /**
   * Deterministic publication compiler that produces the exact final content
   * exclusively from active, approved claims and verifies that NO superseded
   * non-compliant claim wording appears anywhere in the published output.
   */
  public static compilePublishedContent(
    submissionContent: string,
    activeClaims: Array<{
      id: string;
      claim_text: string;
      review_status?: string | null;
      verification_status?: string | null;
      original_claim_id?: string | null;
    }>,
    supersededClaims: Array<{
      id: string;
      claim_text: string;
    }>,
    versionNumber: number
  ): PublicationCompilationResult {
    const unresolvedNonCompliantPhrases: string[] = [];

    // 1. Verify all active claims are approved and verified
    for (const claim of activeClaims) {
      if (claim.review_status !== "approved") {
        unresolvedNonCompliantPhrases.push(
          `Unapproved active claim "${claim.claim_text.substring(0, 40)}..." (status: ${claim.review_status || "pending"})`
        );
      }
      if (claim.verification_status === "unverified") {
        unresolvedNonCompliantPhrases.push(
          `Unverified active claim "${claim.claim_text.substring(0, 40)}..."`
        );
      }
    }

    // 2. Strict provenance check: Ensure no superseded original wording remains in published content
    for (const superseded of supersededClaims) {
      if (submissionContent.includes(superseded.claim_text)) {
        unresolvedNonCompliantPhrases.push(
          `Superseded non-compliant wording present in content: "${superseded.claim_text.substring(0, 50)}..."`
        );
      }
    }

    // 3. Ensure all approved revised wording is verified in content
    const modifiedClaims = activeClaims.filter((c) => Boolean(c.original_claim_id));
    for (const mod of modifiedClaims) {
      if (!submissionContent.includes(mod.claim_text)) {
        unresolvedNonCompliantPhrases.push(
          `Approved modified wording missing from content: "${mod.claim_text.substring(0, 50)}..."`
        );
      }
    }

    const isPublishable = unresolvedNonCompliantPhrases.length === 0 && activeClaims.length > 0;

    return {
      isPublishable,
      publishedContent: submissionContent,
      versionNumber,
      approvedClaimIds: activeClaims.map((c) => c.id),
      supersededClaimsCount: supersededClaims.length,
      reconciledClaimsCount: modifiedClaims.length,
      unresolvedNonCompliantPhrases,
    };
  }

  /**
   * Executes a review decision transactionally in PostgreSQL.
   */
  public static async recordReviewDecision(
    session: ServerSessionIdentity,
    input: SubmitDecisionInput
  ) {
    if (!canReviewClaims(session.role)) {
      throw new Error(`Forbidden: Role "${session.role}" lacks compliance review privileges.`);
    }

    return await withTransaction(async (client) => {
      // 1. Fetch target claim with row-level lock and verify workspace membership
      const hasPhase9Cols = await checkPhase9ClaimColumns(client);
      const policySelect = hasPhase9Cols
        ? 'c.policy_compliance_status, c.mandatory_reviewer_role, c.required_evidence_types,'
        : 'NULL as policy_compliance_status, NULL as mandatory_reviewer_role, ARRAY[]::text[] as required_evidence_types,';

      const claimRes = await client.query<{
        id: string;
        submission_id: string;
        submission_version_id: string;
        claim_text: string;
        claim_type: string;
        verification_status: string;
        risk_level: string | null;
        review_status: ReviewStatus;
        product_id: string | null;
        workspace_id: string;
        policy_compliance_status?: string | null;
        mandatory_reviewer_role?: ReviewerRole | null;
        required_evidence_types?: string[] | null;
      }>(
        `SELECT c.id, c.submission_id, c.submission_version_id, c.claim_text, c.claim_type,
                c.verification_status, c.risk_level, c.review_status, c.product_id,
                ${policySelect}
                s.workspace_id
         FROM claims c
         JOIN submissions s ON c.submission_id = s.id
         JOIN workspaces w ON s.workspace_id = w.id
         WHERE c.id = $1 AND w.slug = $2
         FOR UPDATE OF c`,
        [input.claimId, session.workspaceSlug]
      );

      if (claimRes.rows.length === 0) {
        throw new Error(`Claim "${input.claimId}" not found or unauthorized in workspace.`);
      }

      const claim = claimRes.rows[0];

      // Fetch attached evidence types for this claim
      const evRes = await client.query<{ evidence_type: string }>(
        `SELECT evidence_type FROM claim_evidence WHERE claim_id = $1`,
        [claim.id]
      );
      const attachedEvidenceTypes = evRes.rows.map((r) => r.evidence_type);

      // 2. Validate transition rules
      const validation = this.validateReviewTransition(
        claim.review_status || "pending",
        claim.verification_status,
        claim.risk_level,
        input.decision,
        session.role,
        {
          overrideReason: input.overrideReason,
          escalationCategory: input.escalationCategory,
          modifiedClaimText: input.modifiedClaimText,
          originalClaimText: claim.claim_text,
          mandatoryReviewerRole: claim.mandatory_reviewer_role || undefined,
          policyComplianceStatus: claim.policy_compliance_status || undefined,
          requiredEvidenceTypes: claim.required_evidence_types || undefined,
          attachedEvidenceTypes,
        }
      );

      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join("; ")}`);
      }

      let childClaimId: string | null = null;
      const newClaimStatus: ReviewStatus = validation.newStatus;

      // 3. Handle Modification Lineage & Mandatory Re-Verification (Correction 4)
      if (input.decision === "modified") {
        const revisedText = input.modifiedClaimText!.trim();

        // A. Fetch current submission content to create a new immutable submission version
        const subVerRes = await client.query<{ id: string; version_number: number; content: string }>(
          `SELECT id, version_number, content
           FROM submission_versions
           WHERE submission_id = $1
           ORDER BY version_number DESC
           LIMIT 1
           FOR UPDATE`,
          [claim.submission_id]
        );

        let targetVersionId = claim.submission_version_id;
        if (subVerRes.rows.length > 0) {
          const latestVer = subVerRes.rows[0];
          const newContent = latestVer.content.includes(claim.claim_text)
            ? latestVer.content.replace(claim.claim_text, revisedText)
            : `${latestVer.content}\n\n[Revised: ${revisedText}]`;

          const newVersionNumber = latestVer.version_number + 1;

          // Insert new immutable submission version containing the revised content
          const newVerRes = await client.query<{ id: string }>(
            `INSERT INTO submission_versions (submission_id, version_number, content, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [claim.submission_id, newVersionNumber, newContent, session.userName]
          );
          targetVersionId = newVerRes.rows[0].id;

          // Update master submission content
          await client.query(
            `UPDATE submissions
             SET content = $1, updated_at = now()
             WHERE id = $2`,
            [newContent, claim.submission_id]
          );
        }

        // B. Mark parent claim as 'modified' and inactive
        await client.query(
          `UPDATE claims
           SET review_status = 'modified',
               is_active = false,
               last_reviewed_at = now(),
               assigned_reviewer = $1,
               review_notes = $2,
               updated_at = now()
           WHERE id = $3`,
          [session.userName, input.comments || "Modified by reviewer", claim.id]
        );

        // C. Insert child claim linked to the NEW immutable submission version
        const childRes = await client.query<{ id: string }>(
          `INSERT INTO claims (
            submission_id,
            submission_version_id,
            claim_text,
            claim_type,
            product_id,
            verification_status,
            risk_level,
            review_status,
            assigned_reviewer,
            original_claim_id,
            is_active
          ) VALUES ($1, $2, $3, $4, $5, 'unverified', NULL, 'pending', $6, $7, true)
          RETURNING id`,
          [
            claim.submission_id,
            targetVersionId,
            revisedText,
            claim.claim_type,
            claim.product_id,
            session.userName,
            claim.id,
          ]
        );
        childClaimId = childRes.rows[0].id;
      } else {
        // Normal update on existing claim
        await client.query(
          `UPDATE claims
           SET review_status = $1,
               assigned_reviewer = $2,
               last_reviewed_at = now(),
               review_notes = $3,
               updated_at = now()
           WHERE id = $4`,
          [newClaimStatus, session.userName, input.comments || null, claim.id]
        );
      }

      // 4. Record decision record in review_decisions with full provenance
      const decisionRes = await client.query<{ id: string; created_at: string }>(
        `INSERT INTO review_decisions (
          claim_id,
          workspace_id,
          submission_id,
          reviewer_id,
          reviewer_role,
          decision,
          comments,
          original_claim_text,
          modified_claim_text,
          escalation_category,
          override_reason,
          previous_workflow_state,
          new_workflow_state
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, created_at`,
        [
          claim.id,
          claim.workspace_id,
          claim.submission_id,
          session.userId,
          session.role,
          input.decision,
          input.comments || null,
          claim.claim_text,
          input.decision === "modified" ? input.modifiedClaimText : null,
          input.decision === "escalated" ? input.escalationCategory : null,
          input.overrideReason || null,
          claim.review_status || "pending",
          newClaimStatus,
        ]
      );

      const decisionRecord = decisionRes.rows[0];

      // 5. Append-only audit log entry
      await client.query(
        `INSERT INTO audit_events (
          workspace_id,
          actor_id,
          entity_type,
          entity_id,
          action,
          before_state,
          after_state
        ) VALUES ($1, $2, 'claim', $3, $4, $5, $6)`,
        [
          claim.workspace_id,
          session.userId,
          claim.id,
          input.decision === "modified"
            ? "claim_modified"
            : input.overrideReason
            ? "claim_overridden"
            : input.decision === "escalated"
            ? "claim_escalated"
            : "claim_reviewed",
          JSON.stringify({
            review_status: claim.review_status,
            verification_status: claim.verification_status,
          }),
          JSON.stringify({
            review_status: newClaimStatus,
            decision_id: decisionRecord.id,
            decision: input.decision,
            child_claim_id: childClaimId,
            override_reason: input.overrideReason || null,
            escalation_category: input.escalationCategory || null,
            actor_name: session.userName,
            actor_email: session.userEmail,
            reviewer_role: session.role,
          }),
        ]
      );

      // 6. Recalculate and update submission publication eligibility gate
      const allActiveRes = await client.query<{
        id: string;
        review_status: ReviewStatus;
        verification_status: string;
        risk_level: string | null;
        is_active: boolean;
      }>(
        `SELECT id, review_status, verification_status, risk_level, is_active
         FROM claims
         WHERE submission_id = $1 AND is_active = true`,
        [claim.submission_id]
      );

      const eligibility = this.evaluatePublicationEligibility(allActiveRes.rows);

      await client.query(
        `UPDATE submissions
         SET publication_status = $1,
             publication_eligibility_details = $2,
             last_reviewed_at = now(),
             updated_at = now()
         WHERE id = $3`,
        [
          eligibility.isEligible ? "eligible" : "ineligible",
          JSON.stringify(eligibility),
          claim.submission_id,
        ]
      );

      // Append immutable audit event for review decision
      try {
        await AuditService.recordEvent(
          {
            workspaceId: claim.workspace_id,
            actorId: session.userName,
            actorRole: session.role,
            entityType: "claim",
            entityId: claim.id,
            action: input.overrideReason ? "claim_overridden" : `claim_${input.decision}`,
            beforeState: {
              review_status: claim.review_status,
              verification_status: claim.verification_status,
              risk_level: claim.risk_level,
            },
            afterState: {
              review_status: newClaimStatus,
              decision: input.decision,
              comments: input.comments,
              override_reason: input.overrideReason,
              escalation_category: input.escalationCategory,
              child_claim_id: childClaimId,
              publication_eligible: eligibility.isEligible,
            },
          },
          client
        );
      } catch (auditErr) {
        console.warn("Audit event recording deferred or pending table update:", auditErr);
      }

      return {
        decisionId: decisionRecord.id,
        claimId: claim.id,
        decision: input.decision,
        newReviewStatus: newClaimStatus,
        childClaimId,
        publicationEligibility: eligibility,
      };
    });
  }

  /**
   * Re-verifies a modified claim deterministically.
   */
  public static async reverifyModifiedClaim(
    childClaimId: string,
    workspaceContext?: { workspaceId?: string; workspaceSlug?: string }
  ) {
    return await VerificationEngine.verifyClaim(childClaimId, workspaceContext);
  }

  /**
   * Dedicated publication workflow. Only this method can transition
   * a submission to status = 'published' after re-verifying eligibility.
   */
  public static async publishSubmission(
    session: ServerSessionIdentity,
    submissionId: string
  ) {
    if (!canPublishSubmissions(session.role)) {
      throw new Error(`Forbidden: Role "${session.role}" lacks publication authorization.`);
    }

    return await withTransaction(async (client) => {
      // 1. Lock submission row and verify workspace
      const subRes = await client.query<{
        id: string;
        workspace_id: string;
        status: string;
        publication_status: string;
        title: string;
        content: string;
      }>(
        `SELECT s.id, s.workspace_id, s.status, s.publication_status, s.title, s.content
         FROM submissions s
         JOIN workspaces w ON s.workspace_id = w.id
         WHERE s.id = $1 AND w.slug = $2
         FOR UPDATE`,
        [submissionId, session.workspaceSlug]
      );

      if (subRes.rows.length === 0) {
        throw new Error(`Submission "${submissionId}" not found or unauthorized.`);
      }

      const submission = subRes.rows[0];

      // Phase 15 Resilience: Idempotent publication check
      if (submission.publication_status === "published" || submission.status === "published") {
        return {
          submissionId: submission.id,
          title: submission.title,
          status: "approved",
          publicationStatus: "published",
          publication_status: "published",
          publishedAt: new Date().toISOString(),
          alreadyPublished: true,
        };
      }

      // 2. Fetch all current active claims for verification check (locked FOR UPDATE)
      const hasPhase9Cols = await checkPhase9ClaimColumns(client);
      const claimsRes = await client.query<{
        id: string;
        claim_text: string;
        review_status: ReviewStatus;
        verification_status: string;
        risk_level: string | null;
        is_active: boolean;
        original_claim_id: string | null;
        policy_compliance_status: string | null;
        mandatory_reviewer_role: string | null;
        required_evidence_types: string[] | null;
        approved_by_role: string | null;
        override_reason: string | null;
      }>(
        `SELECT c.id, c.claim_text, c.review_status, c.verification_status, c.risk_level, c.is_active, c.original_claim_id,
                ${hasPhase9Cols ? 'c.policy_compliance_status, c.mandatory_reviewer_role, c.required_evidence_types,' : 'NULL as policy_compliance_status, NULL as mandatory_reviewer_role, ARRAY[]::text[] as required_evidence_types,'}
                rd.reviewer_role as approved_by_role, rd.override_reason
         FROM claims c
         LEFT JOIN LATERAL (
           SELECT reviewer_role, override_reason
           FROM review_decisions
           WHERE claim_id = c.id AND decision = 'approved'
           ORDER BY created_at DESC
           LIMIT 1
         ) rd ON true
         WHERE c.submission_id = $1 AND c.is_active = true
         FOR UPDATE OF c`,
        [submissionId]
      );

      const eligibility = this.evaluatePublicationEligibility(claimsRes.rows);

      if (!eligibility.isEligible) {
        throw new Error(
          `Publication blocked: ${eligibility.blockingReasons.join("; ")}`
        );
      }

      // 3. Fetch superseded claims to verify absence of non-compliant wording
      const supersededRes = await client.query<{
        id: string;
        claim_text: string;
      }>(
        `SELECT id, claim_text
         FROM claims
         WHERE submission_id = $1 AND is_active = false AND review_status = 'modified'`,
        [submissionId]
      );

      // 4. Fetch latest submission version
      const verRes = await client.query<{
        id: string;
        version_number: number;
        content: string;
      }>(
        `SELECT id, version_number, content
         FROM submission_versions
         WHERE submission_id = $1
         ORDER BY version_number DESC
         LIMIT 1`,
        [submissionId]
      );

      const currentContent = verRes.rows.length > 0 ? verRes.rows[0].content : submission.content;
      const currentVersionNumber = verRes.rows.length > 0 ? verRes.rows[0].version_number : 1;

      // 5. Run deterministic publication compiler
      const compilation = this.compilePublishedContent(
        currentContent,
        claimsRes.rows,
        supersededRes.rows,
        currentVersionNumber
      );

      if (!compilation.isPublishable) {
        throw new Error(
          `Publication rejected by deterministic compiler: Non-compliant or unverified wording detected: ${compilation.unresolvedNonCompliantPhrases.join("; ")}`
        );
      }

      // 6. Update submission to approved and published with full compilation snapshot
      await client.query(
        `UPDATE submissions
         SET status = 'approved',
             publication_status = 'published',
             publication_eligibility_details = $1,
             last_reviewed_at = now(),
             updated_at = now()
         WHERE id = $2`,
        [
          JSON.stringify({
            eligibility: {
              ...eligibility,
              isEligible: eligibility.isEligible,
              eligible: eligibility.isEligible,
            },
            compilation: {
              versionNumber: compilation.versionNumber,
              approvedClaimIds: compilation.approvedClaimIds,
              supersededClaimsCount: compilation.supersededClaimsCount,
              reconciledClaimsCount: compilation.reconciledClaimsCount,
            },
            publishedAt: new Date().toISOString(),
          }),
          submissionId,
        ]
      );

      // 7. Log append-only audit event with exact publication metadata
      await client.query(
        `INSERT INTO audit_events (
          workspace_id,
          actor_id,
          entity_type,
          entity_id,
          action,
          before_state,
          after_state
        ) VALUES ($1, $2, 'submission', $3, 'publication_status_updated', $4, $5)`,
        [
          submission.workspace_id,
          session.userId,
          submission.id,
          JSON.stringify({
            status: submission.status,
            publication_status: submission.publication_status,
          }),
          JSON.stringify({
            status: "approved",
            publication_status: "published",
            published_by: session.userName,
            actor_name: session.userName,
            actor_email: session.userEmail,
            reviewer_role: session.role,
            version_number: compilation.versionNumber,
            claims_count: eligibility.totalActiveClaims,
            approved_claim_ids: compilation.approvedClaimIds,
          }),
        ]
      );

      return {
        submissionId: submission.id,
        title: submission.title,
        status: "approved",
        publicationStatus: "published",
        publication_status: "published",
        publishedAt: new Date().toISOString(),
        publishedBy: session.userName,
        eligibility: {
          ...eligibility,
          isEligible: eligibility.isEligible,
          eligible: eligibility.isEligible,
        },
        compilation,
      };
    });
  }

  /**
   * Retrieves claims queue prioritized for human review.
   */
  public static async getReviewQueue(
    session: ServerSessionIdentity,
    filters?: {
      riskLevel?: string;
      reviewStatus?: string;
      claimType?: string;
      search?: string;
    }
  ): Promise<ClaimRecord[]> {
    let sql = `
      SELECT 
        c.id,
        c.submission_id,
        c.submission_version_id,
        c.extraction_run_id,
        c.claim_text,
        c.claim_type,
        c.text_start,
        c.text_end,
        c.product_id,
        c.extracted_entities,
        c.extraction_confidence,
        c.verification_status,
        c.risk_level,
        c.verified_at,
        c.evidence_sufficiency,
        c.explanation,
        c.suggested_correction,
        c.review_status,
        c.assigned_reviewer,
        c.last_reviewed_at,
        c.review_notes,
        c.original_claim_id,
        c.is_active,
        c.created_at,
        c.updated_at,
        p.name as product_name,
        p.sku as product_sku,
        s.title as submission_title,
        s.channel as submission_channel,
        s.status as submission_status,
        sv.version_number
      FROM claims c
      JOIN submissions s ON c.submission_id = s.id
      JOIN workspaces w ON s.workspace_id = w.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN submission_versions sv ON c.submission_version_id = sv.id
      WHERE w.slug = $1 AND c.is_active = true
    `;

    const params: unknown[] = [session.workspaceSlug];
    let pIdx = 2;

    if (filters?.reviewStatus && filters.reviewStatus !== "all") {
      sql += ` AND c.review_status = $${pIdx++}`;
      params.push(filters.reviewStatus);
    } else {
      // By default show pending, in_review, escalated, or modified
      sql += ` AND c.review_status IN ('pending', 'in_review', 'escalated', 'modified')`;
    }

    if (filters?.riskLevel && filters.riskLevel !== "all") {
      sql += ` AND c.risk_level = $${pIdx++}`;
      params.push(filters.riskLevel);
    }

    if (filters?.claimType && filters.claimType !== "all") {
      sql += ` AND c.claim_type = $${pIdx++}`;
      params.push(filters.claimType);
    }

    if (filters?.search && filters.search.trim().length > 0) {
      sql += ` AND (c.claim_text ILIKE $${pIdx++} OR s.title ILIKE $${pIdx++})`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }

    // Priority ordering: Critical risk first, then contradicted, then latest
    sql += `
      ORDER BY 
        CASE c.risk_level 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END ASC,
        c.created_at DESC
      LIMIT 100
    `;

    const res = await query<ClaimRecord>(sql, params);
    return res.rows;
  }
}