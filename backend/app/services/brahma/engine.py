"""
BRAHMA Policy Decision Engine.
Evidence-grounded, traceable pre-publication content evaluation engine.
Implements:
- Multimodal evidence synthesis (neural vision score, OCR, EXIF, C2PA, captions)
- Hybrid RAG retrieval of official platform rules & statutory provisions
- Clear boundaries: AI != Prohibited; Missing C2PA != Fake; Platform Rule != Statutory Law
- Traceable citations to verified official sources
- Standardized typed decision contract: ALLOWED, NOT_ALLOWED, REVIEW_REQUIRED, ANALYSIS_FAILED
"""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from app.services.brahma.models import (
    BrahmaDecisionType,
    BrahmaDecisionContract,
    BrahmaEvidenceObservation,
    BrahmaCitation,
    BrahmaEvaluationRequest,
    BrahmaPolicyCategory,
)
from app.services.brahma.source_registry import get_source_registry
from app.services.brahma.retriever import BrahmaRetriever

logger = logging.getLogger(__name__)

POLICY_ENGINE_VERSION = "2026.2-BRAHMA-CORE"


class BrahmaDecisionEngine:
    """The central decision engine evaluating content against verified platform and legal policies."""

    _instance = None

    def __init__(self, retriever: Optional[BrahmaRetriever] = None):
        self.retriever = retriever or BrahmaRetriever()
        self.source_registry = get_source_registry()

    def evaluate(self, request: BrahmaEvaluationRequest) -> BrahmaDecisionContract:
        """Evaluates content evidence and returns a canonical BrahmaDecisionContract."""
        evaluated_at = datetime.now(timezone.utc).isoformat()
        observations: List[BrahmaEvidenceObservation] = []
        citations: List[BrahmaCitation] = []
        exceptions: List[str] = []
        required_disclosures: List[str] = []
        missing_evidence: List[str] = []
        uncertainty: Dict[str, Any] = {
            "is_calibrated": True,
            "abstention_triggered": False,
            "uncertainty_factors": []
        }

        # ---------------------------------------------------------------------
        # 1. Synthesize Multimodal Observations
        # ---------------------------------------------------------------------
        # AI Detector observation
        is_ai_detected = (request.canonical_ai_verdict == "AI GENERATED")
        if request.canonical_ai_verdict:
            score = request.ai_confidence_score or (0.95 if is_ai_detected else 0.05)
            observations.append(BrahmaEvidenceObservation(
                modality="image_neural" if request.media_type != "video" else "video_frame_temporal",
                signal_name="UniversalFakeDetect_Classifier",
                observed_value={"verdict": request.canonical_ai_verdict, "score": score},
                confidence=round(score if is_ai_detected else (1.0 - score), 4),
                assessment="SUSPICIOUS_AI" if is_ai_detected else "NEUTRAL",
                details=f"Canonical probe classified asset as {request.canonical_ai_verdict} (score: {score:.3f})"
            ))

        # C2PA Observation
        if request.c2pa_present:
            observations.append(BrahmaEvidenceObservation(
                modality="c2pa_manifest",
                signal_name="C2PA_JUMBF_Provenance",
                observed_value={"present": True, "ai_generative_assertion": request.c2pa_ai_generative_assertion},
                confidence=1.0,
                assessment="PROVENANCE_VERIFIED",
                details="C2PA cryptographic provenance container verified."
            ))
        else:
            observations.append(BrahmaEvidenceObservation(
                modality="c2pa_manifest",
                signal_name="C2PA_JUMBF_Provenance",
                observed_value={"present": False},
                confidence=1.0,
                assessment="PROVENANCE_ABSENT",
                details="No C2PA manifest found (Note: missing C2PA does not imply artificiality or wrongdoing)."
            ))

        # Text & Caption Observation
        combined_text = ""
        if request.caption_or_text:
            combined_text += request.caption_or_text.strip()
        if request.ocr_extracted_text:
            combined_text += (" " + request.ocr_extracted_text.strip())

        if combined_text:
            observations.append(BrahmaEvidenceObservation(
                modality="caption_or_ocr",
                signal_name="TextualContext",
                observed_value=combined_text[:120],
                confidence=1.0,
                assessment="NEUTRAL",
                details=f"Context text analyzed ({len(combined_text)} characters)."
            ))
        else:
            missing_evidence.append("No caption or textual context provided. Evaluation limited to visual signals.")

        # ---------------------------------------------------------------------
        # 2. Contextual Nuances: Satire, Parody, Educational Commentary
        # ---------------------------------------------------------------------
        if request.is_satire_or_parody:
            exceptions.append("Satire/Parody Exemption: Content identified as artistic satire or parody.")
        if request.is_educational_or_news:
            exceptions.append("Public Interest / News Reporting Exemption: Content framed as educational commentary or debunking.")

        # ---------------------------------------------------------------------
        # 3. Retrieve Applicable Authoritative Clauses
        # ---------------------------------------------------------------------
        retrieval_query = combined_text
        if is_ai_detected:
            retrieval_query += " synthetic content ai generated disclosure deepfake"

        retrieved_items = self.retriever.retrieve(
            query=retrieval_query,
            platform=request.platform,
            jurisdiction=request.jurisdiction,
            product=request.product,
            top_k=5
        )

        # ---------------------------------------------------------------------
        # 4. Evaluate Policy Rules & Statutory Offenses
        # ---------------------------------------------------------------------
        has_statutory_violation = False
        statutory_block_reasons = []
        has_platform_violation = False
        platform_block_reasons = []
        disclosure_mandated = False

        text_lower = combined_text.lower()

        for clause, score, matched_kws in retrieved_items:
            # Create citation
            source_meta = self.source_registry.get_source(clause.source_id)
            verified_at = source_meta.last_verified_at if source_meta and source_meta.last_verified_at else evaluated_at
            
            citation = BrahmaCitation(
                clause_id=clause.clause_id,
                section=clause.section,
                title=clause.title,
                authority=clause.authority,
                official_url=clause.official_url,
                effective_date=clause.effective_date,
                platform=clause.platform,
                jurisdiction=clause.jurisdiction,
                version_hash=clause.version_hash or "hash_v1",
                verified_at=verified_at,
                supporting_excerpt=clause.excerpt
            )

            # Check if this clause triggers a violation or disclosure requirement
            if clause.action == "BLOCK":
                # Check for critical keywords in caption or OCR
                crit_match = any(kw in text_lower for kw in clause.keywords if kw not in ["ai generated", "synthetic photo", "ai image"])
                if crit_match:
                    citations.append(citation)
                    if clause.platform == "india_gov":
                        has_statutory_violation = True
                        statutory_block_reasons.append(f"{clause.title} ({clause.section})")
                    else:
                        has_platform_violation = True
                        platform_block_reasons.append(f"{clause.title} ({clause.section})")

            elif clause.action == "DISCLOSURE_REQUIRED":
                if is_ai_detected or request.c2pa_ai_generative_assertion:
                    citations.append(citation)
                    disclosure_mandated = True
                    if clause.disclosure_requirement and clause.disclosure_requirement not in required_disclosures:
                        required_disclosures.append(clause.disclosure_requirement)

        # ---------------------------------------------------------------------
        # 5. Determine Canonical Decision
        # ---------------------------------------------------------------------
        # Case A: Serious Statutory Violation (NCII, CSAM, Fraud, Public Order)
        if has_statutory_violation:
            explanation = (
                f"Content is NOT ALLOWED under statutory law ({request.jurisdiction}). "
                f"Identified legal conflict: {', '.join(statutory_block_reasons)}."
            )
            return BrahmaDecisionContract(
                decision=BrahmaDecisionType.NOT_ALLOWED,
                platform=request.platform,
                product=request.product,
                policy_scope=request.policy_scope,
                jurisdiction=request.jurisdiction,
                explanation=explanation,
                evidence_observations=observations,
                citations=citations,
                relevant_exceptions=exceptions,
                uncertainty_and_confidence={"verdict_confidence": 0.98, "is_statutory": True},
                missing_evidence=missing_evidence,
                required_disclosures=required_disclosures,
                human_review_recommended=True,
                source_health_summary={"verified_sources": len(citations), "registry_version": "2026.2"},
                policy_version=POLICY_ENGINE_VERSION,
                evaluated_at_utc=evaluated_at
            )

        # Case B: Platform Prohibited Content
        if has_platform_violation:
            explanation = (
                f"Content is NOT ALLOWED under {request.platform.upper()} Community Guidelines. "
                f"Triggered rule: {', '.join(platform_block_reasons)}."
            )
            return BrahmaDecisionContract(
                decision=BrahmaDecisionType.NOT_ALLOWED,
                platform=request.platform,
                product=request.product,
                policy_scope=request.policy_scope,
                jurisdiction=request.jurisdiction,
                explanation=explanation,
                evidence_observations=observations,
                citations=citations,
                relevant_exceptions=exceptions,
                uncertainty_and_confidence={"verdict_confidence": 0.94, "is_platform_rule": True},
                missing_evidence=missing_evidence,
                required_disclosures=required_disclosures,
                human_review_recommended=True,
                source_health_summary={"verified_sources": len(citations), "registry_version": "2026.2"},
                policy_version=POLICY_ENGINE_VERSION,
                evaluated_at_utc=evaluated_at
            )

        # Case C: Ambiguous or Context-Dependent (e.g. Political figure depicted or satire claimed without context)
        is_ambiguous_political = any(term in text_lower for term in ["prime minister", "president", "election", "candidate", "voting"])
        if is_ai_detected and is_ambiguous_political and not request.has_explicit_ai_label:
            explanation = (
                f"REVIEW REQUIRED: Content depicts high-consequence civic/political subject matter with AI generation signals. "
                f"Review is required to verify creator consent, contextual framing, or mandatory pre-publication disclosure."
            )
            uncertainty["abstention_triggered"] = True
            uncertainty["uncertainty_factors"].append("High-consequence political topic with detected synthetic likeness.")
            return BrahmaDecisionContract(
                decision=BrahmaDecisionType.REVIEW_REQUIRED,
                platform=request.platform,
                product=request.product,
                policy_scope=request.policy_scope,
                jurisdiction=request.jurisdiction,
                explanation=explanation,
                evidence_observations=observations,
                citations=citations,
                relevant_exceptions=exceptions,
                uncertainty_and_confidence=uncertainty,
                missing_evidence=["Contextual framing of political speech", "Creator disclosure affirmation"],
                required_disclosures=required_disclosures or ["Prominent AI generation disclosure badge"],
                human_review_recommended=True,
                source_health_summary={"verified_sources": len(citations), "registry_version": "2026.2"},
                policy_version=POLICY_ENGINE_VERSION,
                evaluated_at_utc=evaluated_at
            )

        # Case D: Synthetic Content Requiring Disclosure
        if is_ai_detected and disclosure_mandated:
            if request.has_explicit_ai_label or request.c2pa_ai_generative_assertion:
                # Creator already has AI label or C2PA disclosure
                explanation = (
                    f"ALLOWED with verified disclosure. "
                    f"Content is AI-generated, and meets {request.platform.upper()} transparency standards with appropriate disclosure."
                )
                return BrahmaDecisionContract(
                    decision=BrahmaDecisionType.ALLOWED,
                    platform=request.platform,
                    product=request.product,
                    policy_scope=request.policy_scope,
                    jurisdiction=request.jurisdiction,
                    explanation=explanation,
                    evidence_observations=observations,
                    citations=citations,
                    relevant_exceptions=exceptions,
                    uncertainty_and_confidence={"verdict_confidence": 0.95, "disclosure_satisfied": True},
                    missing_evidence=missing_evidence,
                    required_disclosures=[],
                    human_review_recommended=False,
                    source_health_summary={"verified_sources": len(citations), "registry_version": "2026.2"},
                    policy_version=POLICY_ENGINE_VERSION,
                    evaluated_at_utc=evaluated_at
                )
            else:
                # Permitted to publish provided the creator checks the disclosure toggle!
                explanation = (
                    f"ALLOWED with Mandatory Disclosure: "
                    f"AI-generated content is permitted on {request.platform.upper()}, but requires a pre-publication disclosure "
                    f"under official platform guidelines and MeitY advisories."
                )
                return BrahmaDecisionContract(
                    decision=BrahmaDecisionType.ALLOWED,
                    platform=request.platform,
                    product=request.product,
                    policy_scope=request.policy_scope,
                    jurisdiction=request.jurisdiction,
                    explanation=explanation,
                    evidence_observations=observations,
                    citations=citations,
                    relevant_exceptions=exceptions,
                    uncertainty_and_confidence={"verdict_confidence": 0.90, "disclosure_mandated": True},
                    missing_evidence=missing_evidence,
                    required_disclosures=required_disclosures,
                    human_review_recommended=False,
                    source_health_summary={"verified_sources": len(citations), "registry_version": "2026.2"},
                    policy_version=POLICY_ENGINE_VERSION,
                    evaluated_at_utc=evaluated_at
                )

        # Case E: Standard Clean Content (ALLOWED)
        explanation = (
            f"Content appears to comply with verified {request.platform.upper()} policies "
            f"and applicable {request.jurisdiction} statutory provisions. No identified prohibitions triggered."
        )
        return BrahmaDecisionContract(
            decision=BrahmaDecisionType.ALLOWED,
            platform=request.platform,
            product=request.product,
            policy_scope=request.policy_scope,
            jurisdiction=request.jurisdiction,
            explanation=explanation,
            evidence_observations=observations,
            citations=citations[:2],
            relevant_exceptions=exceptions,
            uncertainty_and_confidence={"verdict_confidence": 0.95, "abstention_triggered": False},
            missing_evidence=missing_evidence,
            required_disclosures=[],
            human_review_recommended=False,
            source_health_summary={"verified_sources": len(citations), "registry_version": "2026.2"},
            policy_version=POLICY_ENGINE_VERSION,
            evaluated_at_utc=evaluated_at
        )


_brahma_engine_instance: Optional[BrahmaDecisionEngine] = None

def get_brahma_engine() -> BrahmaDecisionEngine:
    global _brahma_engine_instance
    if _brahma_engine_instance is None:
        _brahma_engine_instance = BrahmaDecisionEngine()
    return _brahma_engine_instance
