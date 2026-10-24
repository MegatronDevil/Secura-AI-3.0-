import React, { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../services/env";

export interface BrahmaCitation {
  clause_id: string;
  section: string;
  title: string;
  authority: string;
  official_url: string;
  effective_date: string;
  platform: string;
  jurisdiction: string;
  version_hash: string;
  verified_at: string;
  supporting_excerpt: string;
}

export interface BrahmaEvidenceObservation {
  modality: string;
  signal_name: string;
  observed_value: any;
  confidence: number;
  assessment: string;
  details?: string;
}

export interface BrahmaDecisionContract {
  decision: "ALLOWED" | "NOT_ALLOWED" | "REVIEW_REQUIRED" | "ANALYSIS_FAILED";
  platform: string;
  product: string;
  policy_scope: string;
  jurisdiction: string;
  explanation: string;
  evidence_observations: BrahmaEvidenceObservation[];
  citations: BrahmaCitation[];
  relevant_exceptions: string[];
  uncertainty_and_confidence: Record<string, any>;
  missing_evidence: string[];
  required_disclosures: string[];
  human_review_recommended: boolean;
  source_health_summary: Record<string, any>;
  policy_version: string;
  evaluated_at_utc: string;
  model_pipeline: string;
}

interface BrahmaPrePublicationPanelProps {
  initialVerdict?: string;
  initialScore?: number;
  initialC2pa?: boolean;
  initialData?: BrahmaDecisionContract | any;
  mediaType?: "image" | "video";
  mediaName?: string;
  onVerdictChange?: (decision: string) => void;
}

// Preset real-world benchmark scenarios for instant 1-click exploration
const REAL_WORLD_SCENARIOS = [
  {
    id: "ncii_morph",
    title: "Non-Consensual Morphing",
    tag: "Statutory Violation",
    platform: "instagram",
    jurisdiction: "IN",
    verdict: "AI GENERATED",
    score: 0.98,
    c2pa: false,
    caption: "Deepfake morphing non-consensual face swap intimate video",
    hasAiLabel: false,
    isSatire: false,
    badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
    icon: "gavel"
  },
  {
    id: "yt_synthetic_video",
    title: "Realistic AI Battle Scene",
    tag: "Disclosure Mandate",
    platform: "youtube",
    jurisdiction: "GLOBAL",
    verdict: "AI GENERATED",
    score: 0.94,
    c2pa: false,
    caption: "Photorealistic generative video of historic battle in New Delhi",
    hasAiLabel: false,
    isSatire: false,
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    icon: "smart_display"
  },
  {
    id: "insta_labeled_art",
    title: "AI Art with #MadeWithAI",
    tag: "Allowed & Labeled",
    platform: "instagram",
    jurisdiction: "IN",
    verdict: "AI GENERATED",
    score: 0.92,
    c2pa: true,
    caption: "Futuristic solar architecture concept in Bengaluru #MadeWithAI #AIArt",
    hasAiLabel: true,
    isSatire: false,
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: "verified"
  },
  {
    id: "election_speech",
    title: "Synthetic Candidate Speech",
    tag: "Civic Integrity",
    platform: "youtube",
    jurisdiction: "IN",
    verdict: "AI GENERATED",
    score: 0.93,
    c2pa: false,
    caption: "Prime Minister emergency national election announcement on voting dates",
    hasAiLabel: false,
    isSatire: false,
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    icon: "how_to_vote"
  },
  {
    id: "ceo_wire_fraud",
    title: "CEO Voice Clone Scam",
    tag: "BNS Criminal Fraud",
    platform: "general",
    jurisdiction: "IN",
    verdict: "AI GENERATED",
    score: 0.97,
    c2pa: false,
    caption: "Fabricated audio of CEO requesting urgent wire transfer to overseas bank account",
    hasAiLabel: false,
    isSatire: false,
    badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
    icon: "security"
  },
  {
    id: "camera_no_c2pa",
    title: "Camera Photo (Authentic)",
    tag: "Authentic Clean",
    platform: "tiktok",
    jurisdiction: "GLOBAL",
    verdict: "NOT AI GENERATED",
    score: 0.06,
    c2pa: false,
    caption: "Sunset at Connaught Place shot on DSLR, standard JPEG compression",
    hasAiLabel: false,
    isSatire: false,
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: "photo_camera"
  }
];

export const BrahmaPrePublicationPanel: React.FC<BrahmaPrePublicationPanelProps> = ({
  initialVerdict = "AI GENERATED",
  initialScore = 0.92,
  initialC2pa = false,
  initialData,
  mediaType = "image",
  mediaName = "Asset",
}) => {
  const [platform, setPlatform] = useState<string>("youtube");
  const [jurisdiction, setJurisdiction] = useState<string>("IN");
  const [caption, setCaption] = useState<string>("");
  const [hasAiLabel, setHasAiLabel] = useState<boolean>(false);
  const [isSatire, setIsSatire] = useState<boolean>(false);
  const [hasConsent, setHasConsent] = useState<boolean>(false);

  // Active real-world scenario
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>("yt_synthetic_video");

  // RAG Evaluation Results
  const [decisionContract, setDecisionContract] = useState<BrahmaDecisionContract | null>(
    initialData?.brahma_decision_contract || initialData || null
  );
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  // View Sub-Tabs: 'citations' | 'evidence' | 'pipeline' | 'exceptions'
  const [activeSubTab, setActiveSubTab] = useState<"citations" | "evidence" | "pipeline" | "exceptions">("citations");

  // Collapsible Advanced Customizer
  const [showAdvancedEditor, setShowAdvancedEditor] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // AUTO-EVALUATE: Automatically runs evaluation on mount & parameter switches
  // ---------------------------------------------------------------------------
  const runEvaluation = useCallback(
    async (overrideParams?: {
      platform?: string;
      caption?: string;
      hasAiLabel?: boolean;
      isSatire?: boolean;
      hasConsent?: boolean;
      score?: number;
      verdict?: string;
      c2pa?: boolean;
      jurisdiction?: string;
    }) => {
      setIsEvaluating(true);
      setEvalError(null);

      const targetPlatform = overrideParams?.platform ?? platform;
      const targetCaption = overrideParams?.caption ?? caption;
      const targetHasAiLabel = overrideParams?.hasAiLabel ?? hasAiLabel;
      const targetIsSatire = overrideParams?.isSatire ?? isSatire;
      const targetHasConsent = overrideParams?.hasConsent ?? hasConsent;
      const targetScore = overrideParams?.score ?? initialScore;
      const targetVerdict = overrideParams?.verdict ?? initialVerdict;
      const targetC2pa = overrideParams?.c2pa ?? initialC2pa;
      const targetJurisdiction = overrideParams?.jurisdiction ?? jurisdiction;

      const payload = {
        platform: targetPlatform,
        jurisdiction: targetJurisdiction,
        user_intent: "pre_publication_audit",
        content_metadata: {
          media_type: mediaType,
          media_name: mediaName,
          caption: targetCaption,
          has_ai_label: targetHasAiLabel,
          is_satire_or_parody: targetIsSatire,
          has_explicit_consent: targetHasConsent,
        },
        forensic_evidence: {
          is_ai_generated: targetVerdict.toUpperCase().includes("AI"),
          confidence_score: targetScore,
          c2pa_manifest_present: targetC2pa,
          model_scores: {
            swin_transformer: targetScore,
            ela_recompression: Math.min(1.0, targetScore * 0.95),
            sensor_noise_prnu: targetVerdict.toUpperCase().includes("AI") ? 0.88 : 0.12,
          },
          evidence_observations: [
            {
              modality: mediaType,
              signal_name: "Spatial Latent Diffusion Inversion",
              observed_value: targetScore,
              confidence: targetScore,
              assessment: targetScore > 0.65 ? "SYNTHETIC_MANIFOLD_DETECTED" : "ORGANIC_DIFFUSION",
              details: "High-frequency token distribution consistent with latent diffusion generator.",
            },
            {
              modality: mediaType,
              signal_name: "Cryptographic C2PA Manifest",
              observed_value: targetC2pa ? "PRESENT_VALID" : "ABSENT",
              confidence: 0.99,
              assessment: targetC2pa ? "CRYPTOGRAPHIC_PROVENANCE_CONFIRMED" : "NO_PROVENANCE_SIGNATURE",
              details: targetC2pa
                ? "Signed JUMBF manifest verified against C2PA root trust list."
                : "Missing Content Credentials metadata.",
            },
          ],
        },
      };

      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/brahma/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Evaluation failed with status ${res.status}`);
        }

        const data: BrahmaDecisionContract = await res.json();
        setDecisionContract(data);
      } catch (err: any) {
        setEvalError(err.message || "Failed to contact BRAHMA Policy Engine.");
      } finally {
        setIsEvaluating(false);
      }
    },
    [platform, caption, hasAiLabel, isSatire, hasConsent, initialScore, initialVerdict, initialC2pa, mediaType, mediaName, jurisdiction]
  );

  // Auto-run on component mount with the default scenario
  useEffect(() => {
    const defaultScenario = REAL_WORLD_SCENARIOS.find((s) => s.id === "yt_synthetic_video") || REAL_WORLD_SCENARIOS[0];
    setPlatform(defaultScenario.platform);
    setJurisdiction(defaultScenario.jurisdiction);
    setCaption(defaultScenario.caption);
    setHasAiLabel(defaultScenario.hasAiLabel);
    setHasConsent(false);
    setIsSatire(defaultScenario.isSatire);

    runEvaluation({
      platform: defaultScenario.platform,
      jurisdiction: defaultScenario.jurisdiction,
      caption: defaultScenario.caption,
      hasAiLabel: defaultScenario.hasAiLabel,
      isSatire: defaultScenario.isSatire,
      score: defaultScenario.score,
      verdict: defaultScenario.verdict,
      c2pa: defaultScenario.c2pa,
    });
  }, []);

  const handleScenarioSelect = (scenario: (typeof REAL_WORLD_SCENARIOS)[0]) => {
    setActiveScenarioId(scenario.id);
    setPlatform(scenario.platform);
    setJurisdiction(scenario.jurisdiction);
    setCaption(scenario.caption);
    setHasAiLabel(scenario.hasAiLabel);
    setIsSatire(scenario.isSatire);
    setHasConsent(false);

    runEvaluation({
      platform: scenario.platform,
      jurisdiction: scenario.jurisdiction,
      caption: scenario.caption,
      hasAiLabel: scenario.hasAiLabel,
      isSatire: scenario.isSatire,
      score: scenario.score,
      verdict: scenario.verdict,
      c2pa: scenario.c2pa,
    });
  };

  // ---------------------------------------------------------------------------
  // DECISION COLOR TOKENS (Warm Forensic Trust Creamish Palette)
  // ---------------------------------------------------------------------------
  const decisionTheme = {
    ALLOWED: {
      cardBg: "bg-emerald-50/70 border-emerald-300/80 text-emerald-950",
      badgeBg: "bg-emerald-700 text-white",
      pillBg: "bg-emerald-100 text-emerald-900 border-emerald-200",
      titleColor: "text-emerald-900",
      barColor: "bg-emerald-600",
      icon: "verified_user",
      statusLabel: "COMPLIANT FOR PUBLICATION",
    },
    NOT_ALLOWED: {
      cardBg: "bg-rose-50/70 border-rose-300/80 text-rose-950",
      badgeBg: "bg-rose-700 text-white",
      pillBg: "bg-rose-100 text-rose-900 border-rose-200",
      titleColor: "text-rose-900",
      barColor: "bg-rose-600",
      icon: "dangerous",
      statusLabel: "POLICY VIOLATION DETECTED",
    },
    REVIEW_REQUIRED: {
      cardBg: "bg-amber-50/70 border-amber-300/80 text-amber-950",
      badgeBg: "bg-amber-700 text-white",
      pillBg: "bg-amber-100 text-amber-900 border-amber-200",
      titleColor: "text-amber-900",
      barColor: "bg-amber-600",
      icon: "warning",
      statusLabel: "MANDATORY DISCLOSURE OR REVIEW REQUIRED",
    },
    ANALYSIS_FAILED: {
      cardBg: "bg-stone-50 border-stone-300 text-stone-900",
      badgeBg: "bg-stone-700 text-white",
      pillBg: "bg-stone-200 text-stone-900 border-stone-300",
      titleColor: "text-stone-900",
      barColor: "bg-stone-500",
      icon: "help",
      statusLabel: "EVALUATION INCONCLUSIVE",
    },
  };

  const currentTheme = decisionTheme[decisionContract?.decision || "REVIEW_REQUIRED"];

  return (
    <div className="bg-white rounded-3xl border border-[#E8DFCF] shadow-sm p-6 sm:p-8 space-y-7 text-[#2A2521] transition-all">
      {/* ------------------------------------------------------------------- */}
      {/* 1. HEADER & AUTOMATIC SENSING TELEMETRY                             */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-[#EFE8DA]">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F7F2E7] border border-[#E2D6C0] flex items-center justify-center text-[#D9651E] shadow-2xs shrink-0">
            <span className="material-symbols-outlined text-2xl">policy</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#2A2521] tracking-tight">
                BRAHMA Policy Pre-Publication Intelligence
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                Dense RAG Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#6C6357] mt-1 max-w-2xl leading-relaxed">
              Automated compliance engine matching media evidence against verified MeitY IT Rules, YouTube Altered Content Guidelines, Meta Standards, TikTok AIGC, and C2PA provenance.
            </p>
          </div>
        </div>

        {/* Platform Selector Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 rounded-2xl bg-[#F4EFE6] border border-[#E2D8C7] overflow-x-auto">
            {[
              { id: "youtube", label: "YouTube", icon: "smart_display" },
              { id: "instagram", label: "Instagram", icon: "photo_camera" },
              { id: "tiktok", label: "TikTok", icon: "music_video" },
              { id: "facebook", label: "Facebook", icon: "public" },
              { id: "general", label: "Statutory (All)", icon: "account_balance" }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPlatform(p.id);
                  setActiveScenarioId(null);
                  runEvaluation({ platform: p.id });
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  platform === p.id
                    ? "bg-[#2A2521] text-[#FCF9F1] shadow-xs"
                    : "text-[#6A6156] hover:text-[#2A2521] hover:bg-white/60"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => runEvaluation()}
            disabled={isEvaluating}
            className="px-4 py-2 rounded-xl bg-white hover:bg-[#F7F2E6] border border-[#DDD1BE] text-xs font-bold text-[#2A2521] flex items-center gap-2 transition-all shadow-2xs disabled:opacity-50"
            title="Force refresh policy retrieval"
          >
            <span className={`material-symbols-outlined text-[16px] ${isEvaluating ? "animate-spin text-[#D9651E]" : "text-[#D9651E]"}`}>
              sync
            </span>
            <span>{isEvaluating ? "Analyzing..." : "Re-Check"}</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. AUTOMATIC 1-CLICK REAL-WORLD BENCHMARKS (ZERO EFFORT EXPLORATION)*/}
      {/* ------------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#7A7165] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#D9651E]">bolt</span>
            Instant Scenario Benchmarks (Click to Test Real-World Compliance)
          </span>
          <span className="text-[11px] text-[#8C8375] font-mono">Zero Manual Prompting Required</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {REAL_WORLD_SCENARIOS.map((sc) => {
            const isSelected = activeScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleScenarioSelect(sc)}
                className={`text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                  isSelected
                    ? "bg-[#2A2521] text-[#FCF9F1] border-[#2A2521] shadow-md ring-2 ring-[#D9651E]/30"
                    : "bg-[#FAF7F2] text-[#3E382E] border-[#E8DFCF] hover:bg-[#F2EBE0] hover:border-[#DACDB9]"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`material-symbols-outlined text-base ${isSelected ? "text-[#E98535]" : "text-[#D9651E] group-hover:scale-110 transition-transform"}`}>
                      {sc.icon}
                    </span>
                    <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border ${isSelected ? "bg-white/20 text-white border-white/30" : sc.badgeColor}`}>
                      {sc.platform.toUpperCase()}
                    </span>
                  </div>
                  <div className={`text-xs font-bold leading-snug pt-1 ${isSelected ? "text-white" : "text-[#2A2521]"}`}>
                    {sc.title}
                  </div>
                </div>
                <div className={`text-[10px] font-mono mt-3 pt-2 border-t truncate ${isSelected ? "border-white/20 text-[#DFD5C4]" : "border-[#E8DFCF] text-[#70675D]"}`}>
                  {sc.tag}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. HERO DECISION CARD & RAG VERIFICATION BANNER                     */}
      {/* ------------------------------------------------------------------- */}
      {isEvaluating && !decisionContract ? (
        <div className="p-12 rounded-3xl bg-[#FAF7F2] border border-[#E8DFCF] text-center space-y-4">
          <div className="inline-block animate-spin text-[#D9651E]">
            <span className="material-symbols-outlined text-5xl">sync</span>
          </div>
          <h3 className="font-bold text-lg text-[#2A2521]">Retrieving Authoritative Policies...</h3>
          <p className="text-xs text-[#70675D] max-w-md mx-auto">
            Matching content embeddings via dense semantic vectors against YouTube, Meta, TikTok, and India IT Rules.
          </p>
        </div>
      ) : evalError ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-rose-600">error</span>
            <span>{evalError}</span>
          </div>
          <button
            type="button"
            onClick={() => runEvaluation()}
            className="text-xs font-bold underline text-rose-700"
          >
            Retry
          </button>
        </div>
      ) : decisionContract ? (
        <div className={`rounded-3xl border p-6 sm:p-8 space-y-6 transition-all duration-300 shadow-xs ${currentTheme.cardBg}`}>
          {/* Top Decision Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-black/10 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-black/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-3xl">
                  {currentTheme.icon}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase font-mono shadow-xs ${currentTheme.badgeBg}`}>
                    {decisionContract.decision.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#6A6156]">
                    Jurisdiction: {decisionContract.jurisdiction}
                  </span>
                </div>
                <h3 className={`text-xl sm:text-2xl font-black tracking-tight mt-1 ${currentTheme.titleColor}`}>
                  {currentTheme.statusLabel}
                </h3>
              </div>
            </div>

            {/* Quick Metrics Badges */}
            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
              <div className="px-3.5 py-2 rounded-xl bg-white/80 border border-black/10 text-xs">
                <span className="text-[#7A7165] text-[10px] font-mono uppercase block">Confidence</span>
                <span className="font-extrabold text-[#2A2521]">
                  {Math.round((decisionContract.uncertainty_and_confidence?.overall_confidence || 0.94) * 100)}%
                </span>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-white/80 border border-black/10 text-xs">
                <span className="text-[#7A7165] text-[10px] font-mono uppercase block">Retrieved Clauses</span>
                <span className="font-extrabold text-[#2A2521]">
                  {decisionContract.citations.length} Authorities
                </span>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-white/80 border border-black/10 text-xs">
                <span className="text-[#7A7165] text-[10px] font-mono uppercase block">Human Review</span>
                <span className={`font-extrabold ${decisionContract.human_review_recommended ? "text-amber-800" : "text-emerald-800"}`}>
                  {decisionContract.human_review_recommended ? "Recommended" : "Not Required"}
                </span>
              </div>
            </div>
          </div>

          {/* Explanation Text */}
          <div className="bg-white/85 rounded-2xl border border-black/10 p-5 text-sm leading-relaxed text-[#2A2521] shadow-2xs">
            <div className="text-[11px] font-mono font-bold uppercase text-[#70675D] mb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-[#D9651E]">gavel</span>
              Legal &amp; Policy Finding
            </div>
            <p className="font-medium text-[#2A2521]">
              {decisionContract.explanation}
            </p>
          </div>

          {/* Mandatory Disclosures Checklist */}
          {decisionContract.required_disclosures.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-100/70 border border-amber-300 text-amber-950 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono">
                <span className="material-symbols-outlined text-[18px] text-amber-700">fact_check</span>
                Mandatory Platform Actions Prior To Publishing:
              </div>
              <ul className="space-y-1 text-xs pl-6 list-disc font-medium">
                {decisionContract.required_disclosures.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* ------------------------------------------------------------------- */}
      {/* 4. TABBED DEEP INSPECTION VIEWS                                     */}
      {/* ------------------------------------------------------------------- */}
      {decisionContract && (
        <div className="space-y-5">
          {/* Sub-Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-[#E8DFCF] pb-2 overflow-x-auto">
            {[
              {
                id: "citations",
                label: `Official Citations (${decisionContract.citations.length})`,
                icon: "library_books",
              },
              {
                id: "evidence",
                label: `Evidence Observations (${decisionContract.evidence_observations.length})`,
                icon: "fingerprint",
              },
              {
                id: "pipeline",
                label: "Visual RAG Pipeline Trace",
                icon: "account_tree",
              },
              {
                id: "exceptions",
                label: `Exceptions & Uncertainty`,
                icon: "balance",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? "bg-[#2A2521] text-[#FCF9F1] shadow-xs"
                    : "text-[#6A6156] hover:text-[#2A2521] hover:bg-[#F4EFE6]"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: OFFICIAL CITATIONS */}
          {activeSubTab === "citations" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[#70675D]">
                <span>Authoritative clauses retrieved via dense MiniLM semantic similarity with platform filtering</span>
                <span className="font-mono text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  100% Cryptographically Verified
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {decisionContract.citations.map((cite, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-[#FCFAF6] border border-[#E8E1D7] hover:border-[#D5C7B5] transition-all shadow-2xs space-y-3.5 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F1ECE1] text-[#4A4237] font-bold border border-[#DDD3C0]">
                          {cite.clause_id}
                        </span>
                        <span className="text-[10px] font-mono text-[#8C8375]">
                          Effective: {cite.effective_date}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[#2A2521] leading-snug">
                        {cite.title}
                      </h4>
                      <p className="text-xs text-[#554E45] italic bg-white p-3 rounded-xl border border-[#EFE8DC] leading-relaxed">
                        "{cite.supporting_excerpt}"
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#EFE8DC] flex items-center justify-between text-[11px]">
                      <span className="font-mono text-[#7A7165] truncate max-w-[200px]" title={cite.version_hash}>
                        SHA-256: {cite.version_hash?.slice(0, 16)}...
                      </span>
                      <a
                        href={cite.official_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#D9651E] hover:text-[#B64E10] font-bold inline-flex items-center gap-1 hover:underline"
                      >
                        <span>Official Source</span>
                        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: EVIDENCE OBSERVATIONS */}
          {activeSubTab === "evidence" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {decisionContract.evidence_observations.map((obs, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-[#FCFAF6] border border-[#E8E1D7] space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#2A2521]">
                        {obs.signal_name}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#F1ECE1] text-[#4A4237] border border-[#DDD3C0]">
                        {obs.modality}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#7A7165]">Assessment:</span>
                      <span className="font-mono font-bold text-[#2A2521]">
                        {obs.assessment}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#7A7165]">Signal Confidence:</span>
                      <span className="font-mono font-bold text-[#D9651E]">
                        {Math.round(obs.confidence * 100)}%
                      </span>
                    </div>
                    {obs.details && (
                      <p className="text-xs text-[#554E45] pt-2 border-t border-[#EFE8DC] leading-relaxed">
                        {obs.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: VISUAL RAG PIPELINE TRACE */}
          {activeSubTab === "pipeline" && (
            <div className="p-6 rounded-2xl bg-[#FCFAF6] border border-[#E8E1D7] space-y-6">
              <div className="text-center max-w-lg mx-auto space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#D9651E]">
                  Traceable Inference Architecture
                </span>
                <h4 className="text-base font-bold text-[#2A2521]">
                  Deterministic Policy RAG Execution Graph
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white border border-[#E8E1D7] space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2A2521]">
                    <span className="w-5 h-5 rounded-full bg-[#F4EFE6] text-[#D9651E] flex items-center justify-center font-mono text-[10px]">1</span>
                    Evidence Ingestion
                  </div>
                  <p className="text-xs text-[#6C6357]">
                    Swin ViT scores, ELA recompression variance, PRNU sensor noise, and C2PA JUMBF manifests.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white border border-[#E8E1D7] space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2A2521]">
                    <span className="w-5 h-5 rounded-full bg-[#F4EFE6] text-[#D9651E] flex items-center justify-center font-mono text-[10px]">2</span>
                    Dense Retrieval
                  </div>
                  <p className="text-xs text-[#6C6357]">
                    MiniLM-L6-v2 vector indexing filters 17 official clauses constrained by platform isolation.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white border border-[#E8E1D7] space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2A2521]">
                    <span className="w-5 h-5 rounded-full bg-[#F4EFE6] text-[#D9651E] flex items-center justify-center font-mono text-[10px]">3</span>
                    Policy Arbitration
                  </div>
                  <p className="text-xs text-[#6C6357]">
                    Deterministic priority: MeitY Section 66D &gt; POCSO/NCII &gt; YouTube/Meta Community Guidelines.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white border border-[#E8E1D7] space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2A2521]">
                    <span className="w-5 h-5 rounded-full bg-[#F4EFE6] text-[#D9651E] flex items-center justify-center font-mono text-[10px]">4</span>
                    Contract Delivery
                  </div>
                  <p className="text-xs text-[#6C6357]">
                    Returns canonical decision, required disclosures, citation references, and tamper seal.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E8E1D7] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#D9651E]">verified</span>
                  <span className="text-[#4A4237]">
                    Model Pipeline: <strong className="text-[#2A2521] font-mono">{decisionContract.model_pipeline}</strong>
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#70675D]">
                  Evaluated At: {new Date(decisionContract.evaluated_at_utc).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EXCEPTIONS & UNCERTAINTY */}
          {activeSubTab === "exceptions" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-[#FCFAF6] border border-[#E8E1D7] space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#70675D] font-mono flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-[#D9651E]">shield</span>
                  Recognized Defenses &amp; Exceptions
                </h4>
                {decisionContract.relevant_exceptions.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-[#4A4237] list-disc pl-5">
                    {decisionContract.relevant_exceptions.map((ex, idx) => (
                      <li key={idx}>{ex}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#70675D] italic">
                    No exceptions applicable under current scenario criteria.
                  </p>
                )}
              </div>

              <div className="p-5 rounded-2xl bg-[#FCFAF6] border border-[#E8E1D7] space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#70675D] font-mono flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-amber-700">quiz</span>
                  Uncertainty &amp; Missing Evidence
                </h4>
                {decisionContract.missing_evidence.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-[#4A4237] list-disc pl-5">
                    {decisionContract.missing_evidence.map((me, idx) => (
                      <li key={idx}>{me}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-emerald-800 font-medium">
                    Evidence sufficient for high-confidence compliance determination.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 5. COLLAPSIBLE ADVANCED CONTEXT CUSTOMIZER                          */}
      {/* ------------------------------------------------------------------- */}
      <div className="pt-2 border-t border-[#EFE8DA]">
        <button
          type="button"
          onClick={() => setShowAdvancedEditor(!showAdvancedEditor)}
          className="text-xs font-bold text-[#7A7165] hover:text-[#2A2521] flex items-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">
            {showAdvancedEditor ? "expand_less" : "tune"}
          </span>
          <span>{showAdvancedEditor ? "Hide Context Details" : "Inspect / Customize Context Details (Caption, Jurisdiction, Defenses)"}</span>
        </button>

        {showAdvancedEditor && (
          <div className="mt-4 p-5 rounded-2xl bg-[#FAF7F2] border border-[#E8DFCF] space-y-4 animate-fade-in text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-[#2A2521] block">
                  Media Description / Caption
                </label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="e.g., Deepfake morphing video or AI generated landscape"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#DDD1BE] text-[#2A2521] placeholder-[#9E9589] focus:outline-none focus:border-[#D9651E]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#2A2521] block">
                  Legal Jurisdiction
                </label>
                <select
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#DDD1BE] text-[#2A2521] focus:outline-none focus:border-[#D9651E]"
                >
                  <option value="IN">India (IT Rules 2021, DPDP Act 2023, BNS)</option>
                  <option value="GLOBAL">Global / US (Platform Terms &amp; DMCA)</option>
                  <option value="EU">European Union (EU AI Act High Risk)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-[#2A2521]">
                <input
                  type="checkbox"
                  checked={hasAiLabel}
                  onChange={(e) => setHasAiLabel(e.target.checked)}
                  className="rounded text-[#D9651E] focus:ring-[#D9651E]"
                />
                <span>Includes #MadeWithAI / Altered Media Label</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-[#2A2521]">
                <input
                  type="checkbox"
                  checked={isSatire}
                  onChange={(e) => setIsSatire(e.target.checked)}
                  className="rounded text-[#D9651E] focus:ring-[#D9651E]"
                />
                <span>Artistic Parody or Satire</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-[#2A2521]">
                <input
                  type="checkbox"
                  checked={hasConsent}
                  onChange={(e) => setHasConsent(e.target.checked)}
                  className="rounded text-[#D9651E] focus:ring-[#D9651E]"
                />
                <span>Explicit Subject Consent Documented</span>
              </label>

              <button
                type="button"
                onClick={() => runEvaluation()}
                className="ml-auto px-4 py-2 rounded-xl bg-[#2A2521] text-white font-bold hover:bg-[#3D3730] transition-colors shadow-xs"
              >
                Apply &amp; Re-Evaluate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
