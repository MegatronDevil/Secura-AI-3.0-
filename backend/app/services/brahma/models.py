"""
BRAHMA Policy Intelligence Data Models & Decision Contracts.
Strict typed schemas adhering to Section 8 of the specification:
- Canonical Decision Outcomes: ALLOWED, NOT_ALLOWED, REVIEW_REQUIRED, ANALYSIS_FAILED
- Traceable citations resolving to verified official sources
- Multimodal evidence observations and uncertainty calibration
"""
from enum import Enum
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class BrahmaDecisionType(str, Enum):
    ALLOWED = "ALLOWED"
    NOT_ALLOWED = "NOT_ALLOWED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    ANALYSIS_FAILED = "ANALYSIS_FAILED"


class BrahmaPolicyCategory(str, Enum):
    DECEPTIVE_SYNTHETIC_MEDIA = "DECEPTIVE_SYNTHETIC_MEDIA"
    SYNTHETIC_CONTENT_DISCLOSURE = "SYNTHETIC_CONTENT_DISCLOSURE"
    IMPERSONATION_AND_IDENTITY = "IMPERSONATION_AND_IDENTITY"
    NON_CONSENSUAL_INTIMATE_IMAGERY = "NON_CONSENSUAL_INTIMATE_IMAGERY"
    CHILD_EXPLOITATION = "CHILD_EXPLOITATION"
    MISINFORMATION_AND_ELECTIONS = "MISINFORMATION_AND_ELECTIONS"
    FRAUD_AND_FINANCIAL_SCAM = "FRAUD_AND_FINANCIAL_SCAM"
    HARASSMENT_AND_BULLYING = "HARASSMENT_AND_BULLYING"
    VIOLENCE_AND_DANGEROUS_CONTENT = "VIOLENCE_AND_DANGEROUS_CONTENT"
    SOVEREIGNTY_AND_PUBLIC_ORDER = "SOVEREIGNTY_AND_PUBLIC_ORDER"
    BIOMETRIC_DATA_PRIVACY = "BIOMETRIC_DATA_PRIVACY"
    CONTENT_PROVENANCE_AND_C2PA = "CONTENT_PROVENANCE_AND_C2PA"
    SECURA_DEMO_SANDBOX = "SECURA_DEMO_SANDBOX"


class BrahmaPolicyClause(BaseModel):
    """An authoritative, identifiable policy clause or statutory section."""
    clause_id: str
    source_id: str
    platform: str                       # "youtube", "meta", "instagram", "facebook", "tiktok", "india_gov", "c2pa", "general"
    product_scope: List[str] = Field(default_factory=lambda: ["all"])
    jurisdiction: str = "GLOBAL"        # "GLOBAL", "IN", "US", "EU"
    authority: str
    statute_or_guideline: str
    section: str
    title: str
    category: BrahmaPolicyCategory
    action: str                         # "BLOCK", "ALLOW", "DISCLOSURE_REQUIRED", "REVIEW"
    severity: str                       # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    effective_date: str
    official_url: str
    keywords: List[str] = Field(default_factory=list)
    excerpt: str
    explanation: str
    exception_clauses: List[str] = Field(default_factory=list)
    disclosure_requirement: Optional[str] = None
    version_hash: Optional[str] = None


class BrahmaCitation(BaseModel):
    """Verifiable, traceable official citation resolving to an authoritative source."""
    clause_id: str
    section: str
    title: str
    authority: str
    official_url: str
    effective_date: str
    platform: str
    jurisdiction: str
    version_hash: str
    verified_at: str
    supporting_excerpt: str


class BrahmaEvidenceObservation(BaseModel):
    """Structured observation extracted from multimodal content."""
    modality: str                       # "image_neural", "video_frame_temporal", "optical_flow", "ocr_text", "metadata", "c2pa_manifest", "caption_text"
    signal_name: str
    observed_value: Any
    confidence: float = 1.0
    assessment: str                     # "NEUTRAL", "SUSPICIOUS_AI", "STATUTORY_CONFLICT", "DISCLOSURE_MISSING", "PROVENANCE_ABSENT"
    details: Optional[str] = None


class BrahmaDecisionContract(BaseModel):
    """
    The canonical typed response schema for pre-publication permissions.
    No uncalibrated probability scores; explicit uncertainty and citations.
    """
    decision: BrahmaDecisionType
    platform: str
    product: str
    policy_scope: str                   # "PLATFORM_RULES", "LEGAL_STATUTORY", "CONTENT_PROVENANCE", "ALL"
    jurisdiction: str
    explanation: str
    evidence_observations: List[BrahmaEvidenceObservation] = Field(default_factory=list)
    citations: List[BrahmaCitation] = Field(default_factory=list)
    relevant_exceptions: List[str] = Field(default_factory=list)
    uncertainty_and_confidence: Dict[str, Any] = Field(default_factory=dict)
    missing_evidence: List[str] = Field(default_factory=list)
    required_disclosures: List[str] = Field(default_factory=list)
    human_review_recommended: bool = False
    source_health_summary: Dict[str, Any] = Field(default_factory=dict)
    policy_version: str = "2026.2-BRAHMA-CORE"
    evaluated_at_utc: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    model_pipeline: str = "Secura-Brahma-Hybrid-RAG-v2"


class BrahmaEvaluationRequest(BaseModel):
    """Input payload for a pre-publication permission evaluation."""
    platform: str = "general"           # "youtube", "meta", "instagram", "facebook", "tiktok", "general"
    product: str = "all"                # "shorts", "reels", "feed", "stories", "all"
    jurisdiction: str = "IN"            # "IN", "GLOBAL", "US", "EU"
    policy_scope: str = "ALL"           # "PLATFORM_RULES", "LEGAL_STATUTORY", "CONTENT_PROVENANCE", "ALL"
    caption_or_text: Optional[str] = None
    media_type: Optional[str] = "image" # "image", "video", "text"
    canonical_ai_verdict: Optional[str] = None  # "AI GENERATED", "NOT AI GENERATED", "UNCERTAIN"
    ai_confidence_score: Optional[float] = None
    ocr_extracted_text: Optional[str] = None
    c2pa_present: Optional[bool] = False
    c2pa_ai_generative_assertion: Optional[bool] = False
    has_explicit_ai_label: Optional[bool] = False
    metadata_generator: Optional[str] = None
    temporal_variance: Optional[float] = None
    is_satire_or_parody: Optional[bool] = False
    is_educational_or_news: Optional[bool] = False
