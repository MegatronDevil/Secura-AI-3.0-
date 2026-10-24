"""
FastAPI Routes for BRAHMA Policy Intelligence & Pre-Publication Permission Engine.
Endpoints:
- POST /api/v1/brahma/evaluate: Full evidence-to-policy evaluation with traceable citations
- GET  /api/v1/brahma/sources: Official source registry directory
- POST /api/v1/brahma/sources/verify: Live check of source availability and content hashing
- GET  /api/v1/brahma/clauses: Ingested authoritative clauses directory
- GET  /api/v1/brahma/source-health: Live health, status, and freshness metrics
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.services.brahma import (
    get_brahma_engine,
    get_source_registry,
    BrahmaEvaluationRequest,
    BrahmaDecisionContract,
    OfficialSourceMetadata,
    BrahmaPolicyClause,
    INGESTED_POLICY_CLAUSES,
)

router = APIRouter(prefix="/api/v1/brahma", tags=["BRAHMA Policy Intelligence"])


@router.post("/evaluate", response_model=BrahmaDecisionContract)
async def evaluate_content_permission(payload: BrahmaEvaluationRequest):
    """
    Evaluates content pre-publication against verified platform guidelines and statutory law.
    Returns a standardized typed BrahmaDecisionContract with traceable citations.
    """
    try:
        engine = get_brahma_engine()
        result = engine.evaluate(payload)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BRAHMA Policy evaluation failed: {str(exc)}"
        )


@router.get("/sources", response_model=List[OfficialSourceMetadata])
async def list_official_sources(
    platform: Optional[str] = Query(None, description="Filter by platform (youtube, meta, instagram, facebook, tiktok, india_gov, c2pa)"),
    jurisdiction: Optional[str] = Query(None, description="Filter by jurisdiction (IN, GLOBAL, US, EU)"),
    trust_level: Optional[str] = Query(None, description="Filter by trust level")
):
    """Lists registered authoritative sources across YouTube, Meta, TikTok, India Govt, and C2PA."""
    registry = get_source_registry()
    return registry.list_sources(platform=platform, jurisdiction=jurisdiction, trust_level=trust_level)


@router.post("/sources/verify")
async def verify_official_sources_live():
    """
    Triggers live verification of all registered official source URLs.
    Performs real network checks, HTTP status validation, and sha256 fingerprinting.
    """
    registry = get_source_registry()
    report = registry.verify_all_sources()
    return report


@router.get("/clauses", response_model=List[BrahmaPolicyClause])
async def list_policy_clauses(
    platform: Optional[str] = Query(None, description="Filter clauses by platform"),
    jurisdiction: Optional[str] = Query(None, description="Filter clauses by jurisdiction"),
    query: Optional[str] = Query(None, description="Keyword search in clauses")
):
    """Returns authoritative policy clauses and statutory provisions ingested in BRAHMA."""
    clauses = INGESTED_POLICY_CLAUSES
    if platform:
        plat_norm = platform.lower()
        clauses = [c for c in clauses if c.platform == plat_norm or plat_norm in c.platform]
    if jurisdiction:
        jur_norm = jurisdiction.upper()
        clauses = [c for c in clauses if c.jurisdiction == jur_norm or c.jurisdiction == "GLOBAL"]
    if query:
        q_low = query.lower().strip()
        clauses = [c for c in clauses if q_low in c.title.lower() or q_low in c.excerpt.lower() or any(q_low in kw for kw in c.keywords)]
    return clauses


@router.get("/source-health")
async def get_source_health_summary():
    """Returns telemetry on source freshness, verified URLs, and registry integrity."""
    registry = get_source_registry()
    sources = registry.list_sources()
    
    total = len(sources)
    live_count = sum(1 for s in sources if s.verification_status in ["VERIFIED_LIVE", "REDIRECTED"])
    cached_count = sum(1 for s in sources if s.verification_status in ["OFFLINE_CACHED", "UNVERIFIED"])
    rate_limited_count = sum(1 for s in sources if s.verification_status == "RATE_LIMITED")
    
    platforms_covered = sorted(list(set(s.platform for s in sources)))
    
    return {
        "status": "HEALTHY",
        "total_registered_sources": total,
        "verified_live_or_redirected": live_count,
        "offline_cached_or_unverified": cached_count,
        "rate_limited": rate_limited_count,
        "platforms_covered": platforms_covered,
        "total_ingested_clauses": len(INGESTED_POLICY_CLAUSES),
        "engine_version": "2026.2-BRAHMA-CORE"
    }
