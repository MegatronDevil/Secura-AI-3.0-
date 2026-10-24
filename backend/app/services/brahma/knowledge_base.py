"""
Authoritative Knowledge Base of Ingested Policy Clauses and Statutory Provisions.
Covering:
1. YouTube / Google LLC
2. Meta (Instagram, Facebook, Threads)
3. TikTok / ByteDance
4. India Statutory / Government (MeitY IT Rules, DPDP Act 2023, BNS 2023, POCSO)
5. C2PA Content Credentials Standards
6. Secura Demonstration Sandbox Rule
"""
import hashlib
from typing import List
from app.services.brahma.models import BrahmaPolicyClause, BrahmaPolicyCategory

def _hash_clause(source_id: str, section: str, excerpt: str) -> str:
    raw = f"{source_id}::{section}::{excerpt.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

INGESTED_POLICY_CLAUSES: List[BrahmaPolicyClause] = [
    # =========================================================================
    # 1. YOUTUBE / GOOGLE OFFICIAL POLICIES
    # =========================================================================
    BrahmaPolicyClause(
        clause_id="YT-SYNTHETIC-DISCLOSURE-14328491",
        source_id="YT-ALTERED-SYNTHETIC-DISCLOSURE",
        platform="youtube",
        product_scope=["all", "shorts", "longform"],
        jurisdiction="GLOBAL",
        authority="YouTube / Google LLC",
        statute_or_guideline="YouTube Help Center: Disclosure of Altered or Synthetic Content",
        section="Article 14328491 (Mandatory Creator Disclosure)",
        title="YouTube Policy on Altered or Synthetic Content Disclosure",
        category=BrahmaPolicyCategory.SYNTHETIC_CONTENT_DISCLOSURE,
        action="DISCLOSURE_REQUIRED",
        severity="MEDIUM",
        effective_date="2024-03-18",
        official_url="https://support.google.com/youtube/answer/14328491",
        keywords=[
            "synthetic content", "altered media", "generative ai", "deepfake", "realistic",
            "youtube shorts", "creator studio disclosure", "ai label", "synthetic person",
            "real-sounding voice", "altered real event"
        ],
        excerpt=(
            "Creators must disclose when content is altered or synthetic (including generative AI) "
            "if it depicts a real person saying or doing something they did not do, alters footage of a real event or place, "
            "or generates a realistic-looking scene that did not occur. "
            "Creators can select 'Altered content' in YouTube Studio during upload."
        ),
        explanation=(
            "YouTube mandates that realistic synthetic and AI-altered content depicting real people, "
            "places, or events must carry a clear viewer disclosure label applied in YouTube Studio."
        ),
        exception_clauses=[
            "Content that is clearly unrealistic or animated (e.g., cartoons, fantasy worlds).",
            "Color grading, lighting adjustments, or standard beauty filters.",
            "Special effects such as background blurring, artistic green-screen, or synthetic background music."
        ],
        disclosure_requirement="Check 'Altered content' box in YouTube Creator Studio or tag description with explicit AI creation disclosure."
    ),
    BrahmaPolicyClause(
        clause_id="YT-COMMUNITY-HARASSMENT",
        source_id="YT-COMMUNITY-GUIDELINES",
        platform="youtube",
        product_scope=["all", "shorts", "longform", "livestream"],
        jurisdiction="GLOBAL",
        authority="YouTube / Google LLC",
        statute_or_guideline="YouTube Community Guidelines — Harassment and Cyberbullying Policy",
        section="Harassment Policy §2",
        title="YouTube Policy Against Malicious Impersonation & Synthetic Harassment",
        category=BrahmaPolicyCategory.HARASSMENT_AND_BULLYING,
        action="BLOCK",
        severity="HIGH",
        effective_date="2024-03-18",
        official_url="https://www.youtube.com/howyoutubeworks/our-policies/",
        keywords=[
            "harassment", "cyberbullying", "doxxing", "synthetic abuse", "defamation",
            "malicious impersonation", "target individual", "non-consensual"
        ],
        excerpt=(
            "Content that maliciously insults, intimidates, or harasses an individual is not allowed on YouTube. "
            "This includes synthetically generated or altered media used to target individuals with non-consensual sexualization, "
            "defamatory fabrications, or abusive impersonation."
        ),
        explanation="Malicious synthetic targeting or defamatory harassment is strictly prohibited under YouTube Community Guidelines.",
        exception_clauses=["High-profile political satire or public interest debates that do not cross into targeted abusive doxxing or sexualization."]
    ),
    BrahmaPolicyClause(
        clause_id="YT-COMMUNITY-MISINFO-ELECTIONS",
        source_id="YT-COMMUNITY-GUIDELINES",
        platform="youtube",
        product_scope=["all", "shorts", "longform"],
        jurisdiction="GLOBAL",
        authority="YouTube / Google LLC",
        statute_or_guideline="YouTube Community Guidelines — Misinformation Policy",
        section="Misinformation Policy §4 (Elections and Democratic Integrity)",
        title="YouTube Policy on Deceptive Media & Election Misinformation",
        category=BrahmaPolicyCategory.MISINFORMATION_AND_ELECTIONS,
        action="BLOCK",
        severity="CRITICAL",
        effective_date="2024-01-01",
        official_url="https://www.youtube.com/howyoutubeworks/our-policies/",
        keywords=[
            "election fraud", "fake voting date", "synthetic candidate", "fabricated speech",
            "polling misinformation", "ai election", "deceptive candidate speech", "voter suppression"
        ],
        excerpt=(
            "Certain types of misleading or deceptive content with serious risk of egregious harm are not allowed. "
            "This includes manipulated or synthetic media deceiving voters about the time, place, means, or eligibility requirements for voting, "
            "or fabricated statements by political candidates on key civic processes."
        ),
        explanation="Synthetic media deceiving voters or fabricating political statements on civic integrity is prohibited on YouTube.",
        exception_clauses=["News coverage or documentary analysis debunking the deceptive media with clear contextual framing."]
    ),
    BrahmaPolicyClause(
        clause_id="YT-SAFETY-DECEPTIVE-VIOLENCE",
        source_id="YT-SAFETY-DOCUMENTATION",
        platform="youtube",
        product_scope=["all", "shorts", "longform"],
        jurisdiction="GLOBAL",
        authority="YouTube / Google LLC",
        statute_or_guideline="YouTube Policies & Safety Documentation — Violent or Graphic Content",
        section="Violent and Graphic Content §1",
        title="YouTube Prohibition on Deceptive Synthetic Violence and Crisis Depictions",
        category=BrahmaPolicyCategory.DECEPTIVE_SYNTHETIC_MEDIA,
        action="BLOCK",
        severity="HIGH",
        effective_date="2024-01-01",
        official_url="https://support.google.com/youtube/topic/2803240",
        keywords=[
            "violent deepfake", "synthetic war", "fabricated tragedy", "fake disaster", "crisis hoax"
        ],
        excerpt=(
            "Fabricated or synthetically created footage depicting real violent events, natural disasters, or mass casualties "
            "intended to mislead viewers into believing an emergency or tragedy is occurring is strictly prohibited."
        ),
        explanation="Prohibits synthetic depictions of real violent events or crisis hoaxes.",
        exception_clauses=["Clear dramatic fiction, cinematic trailers, or documentary debunking."]
    ),

    # =========================================================================
    # 2. META (INSTAGRAM, FACEBOOK, THREADS) OFFICIAL POLICIES
    # =========================================================================
    BrahmaPolicyClause(
        clause_id="META-MANIPULATED-MEDIA-2024",
        source_id="META-TRANSPARENCY-POLICIES",
        platform="meta",
        product_scope=["all", "reels", "feed", "stories", "threads"],
        jurisdiction="GLOBAL",
        authority="Meta Platforms, Inc.",
        statute_or_guideline="Meta Transparency Center: Manipulated Media & Generative AI Policy",
        section="Community Standards — Manipulated Media (Updated April 2024)",
        title="Meta Manipulated Media & 'Made with AI' Labeling Standards",
        category=BrahmaPolicyCategory.DECEPTIVE_SYNTHETIC_MEDIA,
        action="DISCLOSURE_REQUIRED",
        severity="HIGH",
        effective_date="2024-04-05",
        official_url="https://transparency.meta.com/policies/",
        keywords=[
            "meta", "instagram", "facebook", "threads", "manipulated media", "made with ai",
            "synthetic voice", "reels ai", "deepfake speech", "ai label", "invisible watermark"
        ],
        excerpt=(
            "Meta requires labeling of photorealistic video, audio, or images created or altered with AI. "
            "Content containing industry-standard AI indicators (such as C2PA or IPTC metadata) or self-disclosed by creators "
            "will display a prominent 'Made with AI' or 'AI info' label. "
            "Manipulated media that creates a high risk of material deception on matters of public interest without disclosure may be removed."
        ),
        explanation="Meta requires 'Made with AI' disclosure on photorealistic AI-generated media across Instagram, Facebook, and Threads.",
        exception_clauses=[
            "Minor editing, retouching, or color enhancements.",
            "Obvious artistic, fantasy, or non-photorealistic illustrations."
        ],
        disclosure_requirement="Toggle 'Add AI label' in Instagram/Facebook advanced post settings or include '#MadeWithAI' tag."
    ),
    BrahmaPolicyClause(
        clause_id="META-COMMUNITY-NCII",
        source_id="META-SAFETY-CENTER",
        platform="meta",
        product_scope=["all", "instagram", "facebook", "threads"],
        jurisdiction="GLOBAL",
        authority="Meta Platforms, Inc.",
        statute_or_guideline="Meta Community Standards — Adult Nudity & Sexual Exploitation",
        section="Community Standards §14 (Non-Consensual Sexual Imagery)",
        title="Meta Zero-Tolerance Ban on Non-Consensual Intimate Imagery & Synthetic Nudity",
        category=BrahmaPolicyCategory.NON_CONSENSUAL_INTIMATE_IMAGERY,
        action="BLOCK",
        severity="CRITICAL",
        effective_date="2024-01-01",
        official_url="https://about.meta.com/actions/safety/",
        keywords=[
            "ncii", "deepfake porn", "synthetic nude", "undressing ai", "face swap sexual",
            "intimate imagery", "non-consensual", "nudity morphing", "stopncii"
        ],
        excerpt=(
            "Meta strictly prohibits non-consensual sexual imagery, including digitally generated, synthetic, "
            "or AI-morphed depictions of individuals without clothing or engaged in sexual activity. "
            "Violations result in immediate removal, account termination, and potential reporting to law enforcement."
        ),
        explanation="Strict global prohibition on synthetic non-consensual intimate imagery and sexual face-swaps across all Meta apps.",
        exception_clauses=[]
    ),
    BrahmaPolicyClause(
        clause_id="INSTA-REELS-AI-LABEL-2024",
        source_id="INSTAGRAM-HELP-CENTER",
        platform="instagram",
        product_scope=["reels", "feed", "stories"],
        jurisdiction="GLOBAL",
        authority="Instagram / Meta Platforms, Inc.",
        statute_or_guideline="Instagram Help Center — Creator AI Labeling Guidelines",
        section="Help Article: Labeling AI Content on Instagram",
        title="Instagram Mandatory AI Labeling for Photorealistic Reels and Feed Posts",
        category=BrahmaPolicyCategory.SYNTHETIC_CONTENT_DISCLOSURE,
        action="DISCLOSURE_REQUIRED",
        severity="MEDIUM",
        effective_date="2024-04-05",
        official_url="https://help.instagram.com/",
        keywords=[
            "instagram reel", "instagram post", "ai generated reel", "ai label instagram",
            "ai info tag", "photorealistic ai face", "virtual influencer"
        ],
        excerpt=(
            "If you share a Reel or feed post containing photorealistic video or audio generated with AI, "
            "you must turn on the 'AI label' switch before publishing so viewers understand the media is synthetic."
        ),
        explanation="Instagram creators must enable the 'AI label' toggle before posting photorealistic synthetic Reels.",
        exception_clauses=["Cartoon, hyper-stylized anime, or obvious hand-drawn animations."],
        disclosure_requirement="Turn on 'AI label' in Advanced Settings before sharing to Instagram Reels or Feed."
    ),

    # =========================================================================
    # 3. TIKTOK OFFICIAL POLICIES
    # =========================================================================
    BrahmaPolicyClause(
        clause_id="TIKTOK-SYNTHETIC-MEDIA-RULE-01",
        source_id="TIKTOK-COMMUNITY-GUIDELINES",
        platform="tiktok",
        product_scope=["all", "short_video", "stories", "livestream"],
        jurisdiction="GLOBAL",
        authority="TikTok / ByteDance Ltd.",
        statute_or_guideline="TikTok Community Guidelines — Integrity and Authenticity (AIGC Policy)",
        section="Section: Synthetic and Manipulated Media §1",
        title="TikTok Mandatory AI-Generated Content (AIGC) Labeling Policy",
        category=BrahmaPolicyCategory.SYNTHETIC_CONTENT_DISCLOSURE,
        action="DISCLOSURE_REQUIRED",
        severity="MEDIUM",
        effective_date="2024-05-17",
        official_url="https://www.tiktok.com/in/about",
        keywords=[
            "tiktok aigc", "ai generated content", "tiktok ai label", "synthetic voiceover",
            "c2pa credentials tiktok", "fyp restriction", "ai toggle", "realistic synthetic scene"
        ],
        excerpt=(
            "We welcome creativity enabled by AI, but we require creators to clearly disclose AI-generated content (AIGC). "
            "Creators must use our in-app AI label toggle or clearly caption the video using #AI, #AIGenerated, or a prominent on-screen sticker. "
            "Unlabeled realistic synthetic media will be removed or made ineligible for the For You feed (FYP)."
        ),
        explanation="TikTok mandates the AIGC label toggle or prominent hashtag on all realistic synthetic video uploads.",
        exception_clauses=["Content that does not depict realistic scenes, real people, or real-world events."],
        disclosure_requirement="Enable 'AI-generated content' toggle in More Options, or add '#AIGenerated' in caption."
    ),
    BrahmaPolicyClause(
        clause_id="TIKTOK-DEPICTION-PRIVATE-FIGURES",
        source_id="TIKTOK-COMMUNITY-GUIDELINES",
        platform="tiktok",
        product_scope=["all", "short_video"],
        jurisdiction="GLOBAL",
        authority="TikTok / ByteDance Ltd.",
        statute_or_guideline="TikTok Community Guidelines — Integrity and Authenticity §2",
        section="Section: Synthetic Media §2 (Depiction of Real Figures)",
        title="TikTok Absolute Ban on Synthetic Depiction of Private Real Individuals",
        category=BrahmaPolicyCategory.IMPERSONATION_AND_IDENTITY,
        action="BLOCK",
        severity="HIGH",
        effective_date="2024-05-17",
        official_url="https://www.tiktok.com/in/about",
        keywords=[
            "tiktok likeness", "synthetic private citizen", "cloned classmate", "face swap non-celebrity",
            "synthetic impersonation", "deepfake student", "voice clone colleague"
        ],
        excerpt=(
            "We do not allow synthetic media that depicts the likeness of any real private figure without their explicit consent. "
            "Synthetic media depicting public figures is permitted only if clearly labeled and does not show them endorsing a product "
            "or violating our hate speech, harassment, or election policies."
        ),
        explanation="TikTok strictly prohibits synthetic media depicting private individuals without their verified consent.",
        exception_clauses=["Public figures who are clearly labeled as satire or parody and do not mislead on civic/commercial endorsements."]
    ),

    # =========================================================================
    # 4. INDIA GOVERNMENT & LEGAL STATUTORY PROVISIONS
    # =========================================================================
    BrahmaPolicyClause(
        clause_id="MEITY-IT-RULE-3-1-B-II",
        source_id="MEITY-IT-RULES-2021",
        platform="india_gov",
        product_scope=["all"],
        jurisdiction="IN",
        authority="Ministry of Electronics and Information Technology (MeitY), Government of India",
        statute_or_guideline="Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021",
        section="Rule 3(1)(b)(ii)",
        title="IT Rules 2021 Rule 3(1)(b)(ii) — Non-Consensual Intimate Imagery & Privacy Infringement",
        category=BrahmaPolicyCategory.NON_CONSENSUAL_INTIMATE_IMAGERY,
        action="BLOCK",
        severity="CRITICAL",
        effective_date="2021-02-25",
        official_url="https://www.meity.gov.in/rules-and-regulations",
        keywords=[
            "nude", "intimate", "sexually explicit", "impersonation", "identity theft", "privacy",
            "bodily privacy", "morphing", "deepfake porn", "fake video of person", "it rules 2021"
        ],
        excerpt=(
            "An intermediary shall not host, display, upload, modify, publish, transmit, store, update or share any information "
            "that is obscene, pornographic, pedophilic, invasive of another's privacy including bodily privacy, insulting or "
            "harassing on the basis of gender, racially or ethnically objectionable, or otherwise inconsistent with or contrary to the laws in force."
        ),
        explanation="Prohibits non-consensual intimate imagery, bodily privacy violations, and gender-based harassment under Indian Law.",
        exception_clauses=[]
    ),
    BrahmaPolicyClause(
        clause_id="MEITY-IT-RULE-3-1-B-V",
        source_id="MEITY-IT-RULES-2021",
        platform="india_gov",
        product_scope=["all"],
        jurisdiction="IN",
        authority="Ministry of Electronics and Information Technology (MeitY), Government of India",
        statute_or_guideline="Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021",
        section="Rule 3(1)(b)(v)",
        title="IT Rules 2021 Rule 3(1)(b)(v) — Deceptive Synthetic Media & Patently False Misinformation",
        category=BrahmaPolicyCategory.DECEPTIVE_SYNTHETIC_MEDIA,
        action="BLOCK",
        severity="HIGH",
        effective_date="2021-02-25",
        official_url="https://www.meity.gov.in/rules-and-regulations",
        keywords=[
            "misinformation", "fake news", "deceptive", "election fraud", "hoax",
            "fabricated audio", "fabricated speech", "voice clone", "synthetic politician", "patently false"
        ],
        excerpt=(
            "An intermediary shall not host, store or publish any information that knowingly and intentionally communicates any misinformation "
            "or information which is patently false or misleading in nature, but may reasonably be perceived as a fact."
        ),
        explanation="Prohibits communicating patently false, misleading, or deceptive synthetic media masquerading as fact.",
        exception_clauses=["Clear artistic satire, parody, or educational counter-speech where the fabricated nature is unambiguous."]
    ),
    BrahmaPolicyClause(
        clause_id="MEITY-ADVISORY-DEEPFAKES-2024",
        source_id="MEITY-AI-ADVISORY-2024",
        platform="india_gov",
        product_scope=["all"],
        jurisdiction="IN",
        authority="Ministry of Electronics and Information Technology (MeitY), Government of India",
        statute_or_guideline="MeitY Advisory No. e-Gov/2024 under Information Technology Act, 2000",
        section="Paragraphs 2 & 3 (AI Due Diligence & Technical Labeling)",
        title="MeitY Advisory on Mandatory AI Labeling, Watermarks & Metadata Provenance (March 2024)",
        category=BrahmaPolicyCategory.SYNTHETIC_CONTENT_DISCLOSURE,
        action="DISCLOSURE_REQUIRED",
        severity="HIGH",
        effective_date="2024-03-01",
        official_url="https://www.meity.gov.in/cyber-security-policy",
        keywords=[
            "synthetic content label", "watermark", "identifier", "AI generated label",
            "AI provenance", "metadata disclosure", "meity advisory", "deepfake due diligence"
        ],
        excerpt=(
            "All intermediaries must deploy reliable technical measures to identify and label synthetically created or modified content. "
            "Where synthetic content is permitted, it must carry a clear and prominent label, metadata-embedded identifier, or watermark "
            "indicating AI creation or alteration."
        ),
        explanation="Mandates prominent watermarking, labeling, or metadata attribution for all synthetic and AI-altered content published in India.",
        exception_clauses=[],
        disclosure_requirement="Affix permanent visual watermark or embedded C2PA/IPTC metadata denoting synthetic AI provenance."
    ),
    BrahmaPolicyClause(
        clause_id="MEITY-IT-RULE-3-1-B-VII",
        source_id="MEITY-IT-RULES-2021",
        platform="india_gov",
        product_scope=["all"],
        jurisdiction="IN",
        authority="Ministry of Electronics and Information Technology (MeitY), Government of India",
        statute_or_guideline="Information Technology Rules, 2021",
        section="Rule 3(1)(b)(vii)",
        title="IT Rules 2021 Rule 3(1)(b)(vii) — Sovereignty, Integrity & Public Order",
        category=BrahmaPolicyCategory.SOVEREIGNTY_AND_PUBLIC_ORDER,
        action="BLOCK",
        severity="CRITICAL",
        effective_date="2021-02-25",
        official_url="https://www.meity.gov.in/rules-and-regulations",
        keywords=[
            "sovereignty", "integrity of india", "security of state", "public order",
            "incitement to offense", "riot", "terror", "riot incitement", "communal violence"
        ],
        excerpt=(
            "Information that threatens the unity, integrity, defence, security or sovereignty of India, friendly relations with foreign States, "
            "or public order, or causes incitement to the commission of any cognisable offence or prevents investigation of any offence."
        ),
        explanation="Zero-tolerance statutory prohibition on content threatening Indian sovereignty, defence, security, or communal public order.",
        exception_clauses=[]
    ),
    BrahmaPolicyClause(
        clause_id="DPDP-ACT-2023-SEC-6",
        source_id="INDIA-CODE-DPDP-ACT-2023",
        platform="india_gov",
        product_scope=["all"],
        jurisdiction="IN",
        authority="Ministry of Law and Justice / Data Protection Board of India",
        statute_or_guideline="Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023)",
        section="Sections 6 & 9 (Consent & Biometric Likeness Processing)",
        title="DPDP Act 2023 Section 6 — Processing of Biometric Likeness Without Lawful Consent",
        category=BrahmaPolicyCategory.BIOMETRIC_DATA_PRIVACY,
        action="BLOCK",
        severity="HIGH",
        effective_date="2023-08-11",
        official_url="https://www.indiacode.nic.in/",
        keywords=[
            "biometric clone", "voice clone without consent", "face swap without consent",
            "personal data processing", "facial biometric", "data principal", "dpdp act"
        ],
        excerpt=(
            "Personal data shall only be processed for a lawful purpose for which the Data Principal has given, or is deemed to have given, "
            "her consent. Processing biometric facial and voice features without explicit consent is a breach of digital personal data privacy."
        ),
        explanation="Statutory violation for harvesting or synthetically cloning personal biometric facial or voice likeness without verifiable consent.",
        exception_clauses=["Law enforcement investigations or legitimate statutory purposes recognized under Section 17 of DPDP Act."]
    ),
    BrahmaPolicyClause(
        clause_id="BNS-2023-SEC-318-336",
        source_id="INDIA-CODE-BNS-2023",
        platform="india_gov",
        product_scope=["all"],
        jurisdiction="IN",
        authority="Ministry of Home Affairs / Legislative Department, Government of India",
        statute_or_guideline="Bharatiya Nyaya Sanhita, 2023 (BNS) / IPC Sections 419, 420, 468",
        section="Sections 318 & 336",
        title="BNS 2023 Sections 318 & 336 — Cheating by Personation & Electronic Forgery",
        category=BrahmaPolicyCategory.FRAUD_AND_FINANCIAL_SCAM,
        action="BLOCK",
        severity="CRITICAL",
        effective_date="2024-07-01",
        official_url="https://www.indiacode.nic.in/",
        keywords=[
            "financial fraud", "cheating", "impersonation", "ceo fraud", "bank scam",
            "forged document", "wire fraud", "forgery", "bns 318", "bns 336"
        ],
        excerpt=(
            "Whoever cheats by personation, uses a forged electronic record or makes false electronic representations to deceive or defraud "
            "any individual or entity commits a punishable offence under Sections 318 and 336 of the Bharatiya Nyaya Sanhita, 2023."
        ),
        explanation="Criminal offense for using synthetic identity personation or forged electronic media to defraud or deceive.",
        exception_clauses=[]
    ),
    BrahmaPolicyClause(
        clause_id="POCSO-ACT-2012-SEC-15",
        source_id="GAZETTE-OF-INDIA",
        platform="india_gov",
        product_scope=["all"],
        jurisdiction="IN",
        authority="Ministry of Women and Child Development, Government of India",
        statute_or_guideline="Protection of Children from Sexual Offences (POCSO) Act, 2012 (Amended 2019)",
        section="Section 15",
        title="POCSO Act 2012 Section 15 — Child Sexual Abuse Material (CSAM & Synthetic Depictions)",
        category=BrahmaPolicyCategory.CHILD_EXPLOITATION,
        action="BLOCK",
        severity="CRITICAL",
        effective_date="2012-11-14",
        official_url="https://egazette.gov.in/",
        keywords=[
            "child abuse", "csam", "minor", "underage", "child intimate", "synthetic csam", "pocso"
        ],
        excerpt=(
            "Any person who stores, transmits, or produces sexually explicit material involving a child in digital or physical form "
            "shall be liable for strict criminal prosecution under Section 15 of the POCSO Act."
        ),
        explanation="Absolute zero-tolerance statutory prohibition on child sexual abuse material and synthetic depictions under Indian Law.",
        exception_clauses=[]
    ),

    # =========================================================================
    # 5. C2PA CONTENT PROVENANCE STANDARDS
    # =========================================================================
    BrahmaPolicyClause(
        clause_id="C2PA-SPEC-2-2-ASSERTION",
        source_id="C2PA-SPEC-2-2",
        platform="c2pa",
        product_scope=["all", "image", "video"],
        jurisdiction="GLOBAL",
        authority="Coalition for Content Provenance and Authenticity (C2PA)",
        statute_or_guideline="C2PA Technical Specification v2.2 — Generative AI Assertions",
        section="Section 8.4 (c2pa.ai_generative & Actions)",
        title="C2PA Specification v2.2 — Standardized Generative AI Manifest Assertions",
        category=BrahmaPolicyCategory.CONTENT_PROVENANCE_AND_C2PA,
        action="ALLOW",
        severity="LOW",
        effective_date="2024-05-01",
        official_url="https://spec.c2pa.org/specifications/specifications/2.2/index.html",
        keywords=[
            "c2pa manifest", "content credentials", "jumbf", "cryptographic signature",
            "c2pa.ai_generative", "c2pa.actions", "content provenance"
        ],
        excerpt=(
            "Content credentials encode tamper-evident assertions into JUMBF boxes regarding media origin and edits. "
            "An assertion of type 'c2pa.ai_generative' signals that generative AI tools were utilized in the creation or editing pipeline. "
            "NOTE: C2PA is a technical provenance format; missing credentials do not imply illegality or malice."
        ),
        explanation="Technical standard for cryptographically verifying whether content carries structured provenance or AI generative assertions.",
        exception_clauses=["Missing C2PA manifest does NOT imply the media is fake, illegal, or prohibited by platform policies."],
        disclosure_requirement="C2PA manifest serves as a standard machine-readable provenance credential."
    ),

    # =========================================================================
    # 6. SECURA DEMONSTRATION SANDBOX POLICY (Retained for sandbox regression)
    # =========================================================================
    BrahmaPolicyClause(
        clause_id="SEC-DEMO-POLICY-01",
        source_id="PIB-GOV-IN",
        platform="general",
        product_scope=["all"],
        jurisdiction="IN",
        authority="Secura AI 2.0 System Owner / Platform Demonstration Policy",
        statute_or_guideline="Secura AI 2.0 Demonstration Policy (Local Sandbox)",
        section="Section 1.0 (Demo Configuration)",
        title="Secura Demonstration Policy — Mandatory Pre-Publication Block on AI-Generated Media",
        category=BrahmaPolicyCategory.SECURA_DEMO_SANDBOX,
        action="BLOCK",
        severity="HIGH",
        effective_date="2026-10-18",
        official_url="https://c2pa.org/",
        keywords=["ai generated", "synthetic photo", "ai image", "ai video", "universal fake detect"],
        excerpt=(
            "Under active demonstration configuration BLOCK_AI_GENERATED_MEDIA, any image or video classified as AI GENERATED "
            "is prohibited from publication to public feeds, channels, or private delivery. "
            "NOTE: This is a platform demonstration policy, distinct from statutory legal offenses under Indian Law."
        ),
        explanation="Media blocked under Secura demo policy BLOCK_AI_GENERATED_MEDIA. (Platform demonstration rule).",
        exception_clauses=["When DEMO_POLICY_CONFIG['BLOCK_AI_GENERATED_MEDIA'] is toggled to False."]
    )
]

# Compute version hashes for every clause
for clause in INGESTED_POLICY_CLAUSES:
    clause.version_hash = _hash_clause(clause.source_id, clause.section, clause.excerpt)
