"""
BRAHMA Hybrid Policy Retriever.
Combines:
1. Dense Semantic Embeddings (using local all-MiniLM-L6-v2)
2. Lexical & Term Frequency Grounding (Exact keyword and clause identifier matching)
3. Strict Metadata Scoping (Platform, Product, Jurisdiction, Policy Category)
"""
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

from app.services.brahma.models import BrahmaPolicyClause
from app.services.brahma.knowledge_base import INGESTED_POLICY_CLAUSES

logger = logging.getLogger(__name__)


class BrahmaRetriever:
    """Hybrid dense + lexical policy clause retriever with strict metadata filtering."""

    def __init__(self, clauses: Optional[List[BrahmaPolicyClause]] = None):
        self.clauses: List[BrahmaPolicyClause] = clauses or INGESTED_POLICY_CLAUSES
        self.tokenizer = None
        self.model = None
        self.embeddings: Optional[np.ndarray] = None
        self.is_vector_ready = False
        self._init_dense_model()

    def _init_dense_model(self):
        try:
            local_weights = Path(__file__).resolve().parent.parent.parent.parent / "models" / "weights" / "all-MiniLM-L6-v2"
            model_id = str(local_weights) if local_weights.exists() else "sentence-transformers/all-MiniLM-L6-v2"
            self.tokenizer = AutoTokenizer.from_pretrained(model_id, local_files_only=local_weights.exists())
            self.model = AutoModel.from_pretrained(model_id, local_files_only=local_weights.exists())
            self.model.eval()

            # Precompute document embeddings
            doc_texts = [
                f"{c.title} {c.section} {c.category.value} {c.excerpt} {' '.join(c.keywords)}"
                for c in self.clauses
            ]
            inputs = self.tokenizer(doc_texts, padding=True, truncation=True, max_length=256, return_tensors="pt")
            with torch.no_grad():
                out = self.model(**inputs)
                emb = out.last_hidden_state.mean(dim=1)
                emb = torch.nn.functional.normalize(emb, p=2, dim=1)
                self.embeddings = emb.numpy()
            self.is_vector_ready = True
            logger.info("BrahmaRetriever initialized with %d authoritative clauses via dense embeddings.", len(self.clauses))
        except Exception as exc:
            logger.warning("BrahmaRetriever running in lexical-grounded mode (embedding notice: %s)", exc)
            self.is_vector_ready = False

    def retrieve(
        self,
        query: str,
        platform: Optional[str] = None,
        jurisdiction: Optional[str] = None,
        product: Optional[str] = None,
        top_k: int = 4,
        min_threshold: float = 0.35
    ) -> List[Tuple[BrahmaPolicyClause, float, List[str]]]:
        """
        Retrieves matching policy clauses with scores and matched keywords.
        Ensures strict platform isolation: never returns competitor platform rules!
        """
        if not query or not query.strip():
            return []

        q_lower = query.lower().strip()
        filtered_indices = []

        # 1. Scope Filtering by Platform & Jurisdiction
        plat_norm = (platform or "general").lower()
        jur_norm = (jurisdiction or "IN").upper()
        prod_norm = (product or "all").lower()

        for idx, clause in enumerate(self.clauses):
            # Skip demo sandbox rule from general retrieval (it's handled deterministically)
            if clause.clause_id == "SEC-DEMO-POLICY-01":
                continue

            # Platform check:
            # We allow platform-specific rules OR global statutory rules (e.g. India Gov if jurisdiction is IN, or C2PA)
            is_platform_match = False
            if plat_norm in ["all", "general"]:
                is_platform_match = True
            elif clause.platform == plat_norm:
                is_platform_match = True
            elif clause.platform in ["india_gov", "c2pa"]:
                # Statutory and C2PA rules apply across platforms within their jurisdiction
                is_platform_match = True
            elif plat_norm in ["instagram", "facebook", "threads"] and clause.platform == "meta":
                is_platform_match = True
            elif plat_norm == "meta" and clause.platform in ["instagram", "facebook", "threads"]:
                is_platform_match = True

            if not is_platform_match:
                continue

            # Jurisdiction check:
            if jur_norm and clause.jurisdiction != "GLOBAL" and clause.jurisdiction != jur_norm:
                continue

            # Product check (if specified):
            if prod_norm != "all" and "all" not in clause.product_scope and prod_norm not in clause.product_scope:
                continue

            filtered_indices.append(idx)

        if not filtered_indices:
            return []

        # 2. Dense Semantic Vector Scores
        vector_scores = {}
        if self.is_vector_ready and self.tokenizer and self.model:
            try:
                inputs = self.tokenizer([query], padding=True, truncation=True, max_length=128, return_tensors="pt")
                with torch.no_grad():
                    q_out = self.model(**inputs)
                    q_emb = q_out.last_hidden_state.mean(dim=1)
                    q_emb = torch.nn.functional.normalize(q_emb, p=2, dim=1).numpy()
                scores = np.dot(self.embeddings[filtered_indices], q_emb.T).flatten()
                for rank, orig_idx in enumerate(filtered_indices):
                    vector_scores[orig_idx] = float(scores[rank])
            except Exception as e:
                logger.error("Dense semantic similarity computation failed: %s", e)

        # 3. Keyword Grounding & Combined Scoring
        results = []
        for orig_idx in filtered_indices:
            clause = self.clauses[orig_idx]
            v_score = vector_scores.get(orig_idx, 0.0)

            # Check keyword hits
            matched_kws = [kw for kw in clause.keywords if kw in q_lower]
            keyword_bonus = 0.25 * len(matched_kws)

            # Direct clause/section identifier match bonus
            if clause.section.lower() in q_lower or clause.clause_id.lower() in q_lower:
                keyword_bonus += 0.50

            final_score = v_score + keyword_bonus
            if len(matched_kws) > 0 or final_score >= min_threshold:
                results.append((clause, round(float(final_score), 4), matched_kws))

        # Sort descending by final score
        results.sort(key=lambda item: item[1], reverse=True)
        return results[:top_k]
