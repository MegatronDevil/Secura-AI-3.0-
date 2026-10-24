import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._element.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=140, bottom=140, left=180, right=180):
    tcPr = cell._element.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def create_speech_document(output_path: str):
    doc = Document()
    
    # Page setup - 1 inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Palette
    C_PRIMARY = RGBColor(233, 133, 53)     # Secura Orange #E98535
    C_DARK = RGBColor(36, 35, 33)          # Dark Charcoal #242321
    C_MUTED = RGBColor(120, 115, 110)      # Muted slate
    C_ACCENT_BLUE = RGBColor(37, 99, 235)  # Royal Blue
    C_WHITE = RGBColor(255, 255, 255)
    
    # Title Block
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(4)
    run_title = p_title.add_run("SECURA AI 2.0 — JUDGES PITCH SCRIPT")
    run_title.font.name = "Arial"
    run_title.font.size = Pt(24)
    run_title.font.bold = True
    run_title.font.color.rgb = C_PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(16)
    run_sub = p_sub.add_run("Team Roles, Sequential Speeches, Stage Directions & Live Demo Flow")
    run_sub.font.name = "Arial"
    run_sub.font.size = Pt(12)
    run_sub.font.color.rgb = C_MUTED

    # Metadata Table
    table = doc.add_table(rows=1, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = table.rows[0].cells
    hdr[0].text = "TARGET DURATION: 7–10 Mins"
    hdr[1].text = "TEAM: 6 Members + Demo Lead"
    hdr[2].text = "VERSION: Secura AI v2.0 Enterprise"
    for cell in hdr:
        set_cell_background(cell, "F5F0EB")
        set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for r in p.runs:
            r.font.name = "Arial"
            r.font.size = Pt(9.5)
            r.font.bold = True
            r.font.color.rgb = C_DARK
            
    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # Speakers Summary Table
    p_sum_head = doc.add_paragraph()
    r = p_sum_head.add_run("Team Presentation Order & Speaking Breakdown")
    r.font.name = "Arial"
    r.font.size = Pt(13)
    r.font.bold = True
    r.font.color.rgb = C_DARK
    p_sum_head.paragraph_format.space_after = Pt(6)

    speakers_summary = [
        ("1. Utkarsh", "Team Lead & AI Architect", "Introduction, Model Capabilities, Scaling with Meta Accelerator", "1.5 Mins"),
        ("2. Jyoti", "Social Impact & ESG Lead", "UN Sustainable Development Goals (SDGs 16, 9, 8, 4, 5, 12, 10, 17)", "1.5 Mins"),
        ("3. Navya", "Engineering & Product Lead", "What Has Been Built Till Now vs. What Is On The Roadmap", "1.5 Mins"),
        ("4. Diya", "Cryptography & Signal Processing", "Deep-Dive: SHA-256 for Images, pHash for Videos, RGB Dynamics", "1.5 Mins"),
        ("5. Harshita", "QA, Testing & Model Evolution", "Adversarial Testing, 80-Image Benchmark & Overcoming Model Drawbacks", "1.5 Mins"),
        ("6. Presenter (You)", "Lead Presenter & Live Demo", "Live Product Demo: Chrome Extension, Fixed Frames, Sentinel & Conclusion", "2.0 Mins"),
    ]

    t_sum = doc.add_table(rows=1, cols=4)
    t_sum.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_sum_hdr = t_sum.rows[0].cells
    headers = ["Speaker", "Role", "Core Agenda / Topic", "Target Time"]
    for i, h in enumerate(headers):
        t_sum_hdr[i].text = h
        set_cell_background(t_sum_hdr[i], "E98535")
        set_cell_margins(t_sum_hdr[i], top=100, bottom=100, left=120, right=120)
        p = t_sum_hdr[i].paragraphs[0]
        for r in p.runs:
            r.font.name = "Arial"
            r.font.size = Pt(9.5)
            r.font.bold = True
            r.font.color.rgb = C_WHITE

    for spk, role, topic, dur in speakers_summary:
        row = t_sum.add_row().cells
        row[0].text = spk
        row[1].text = role
        row[2].text = topic
        row[3].text = dur
        for i, cell in enumerate(row):
            set_cell_background(cell, "FAF7F0" if i % 2 == 0 else "FFFFFF")
            set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
            p = cell.paragraphs[0]
            for r in p.runs:
                r.font.name = "Arial"
                r.font.size = Pt(9)
                r.font.color.rgb = C_DARK
                if i == 0 or i == 3:
                    r.font.bold = True

    doc.add_paragraph().paragraph_format.space_after = Pt(16)

    # Detailed Speaker Scripts
    speakers_data = [
        {
            "num": "SPEAKER 1",
            "name": "Utkarsh",
            "role": "Team Lead & AI Architect",
            "time": "Est. 1 Min 30 Sec",
            "topic": "Opening Hook, Model Capabilities & Scaling with Meta Accelerator",
            "cue": "Takes center stage. Confident, authoritative, visionary tone.",
            "speech": (
                "\"Good morning, respected judges and esteemed audience. My name is Utkarsh, and I am the Team Lead and AI Architect for Secura AI 2.0.\n\n"
                "We live in an era where synthetic reality has officially outpaced human perception. In 2026 alone, over 500,000 deepfakes circulate across social media, "
                "defrauding enterprises of millions, destabilizing public trust, and manipulating global discourse. The central problem is that until today, "
                "detection tools were either too slow, inaccurate under compression, or locked away in academic labs.\n\n"
                "That is why we built Secura AI. Secura AI is an enterprise-grade, multi-modal cyber-forensic intelligence engine capable of analyzing both high-resolution "
                "imagery and streaming video in milliseconds. Under the hood, our model combines Swin Vision Transformers to detect invisible microscopic diffusion residuals, "
                "and NeurIPS 2025-anchored ReStraV spatiotemporal modeling that tracks physical camera trajectory curvature to expose synthetic temporal drift.\n\n"
                "Now, how are we scaling this? We are strategically leveraging Meta's Open-Source AI and Global Accelerator Programs. By integrating Secura AI with Meta's Llama "
                "multimodal architecture and deploying our lightweight inference engine directly into Meta's social infrastructure—Instagram Reels, Facebook Feeds, and WhatsApp—we can "
                "screen synthetic media at the network edge before it goes viral. Our goal is to scale Secura AI from protecting individual users to safeguarding over 3 billion people "
                "across the Meta ecosystem. I'll now hand over to Jyoti to walk through how our work drives the United Nations Sustainable Development Goals.\""
            )
        },
        {
            "num": "SPEAKER 2",
            "name": "Jyoti",
            "role": "Social Impact & ESG Lead",
            "time": "Est. 1 Min 30 Sec",
            "topic": "UN Sustainable Development Goals (SDGs Alignment)",
            "cue": "Passionate, impact-focused, articulating the broader global vision.",
            "speech": (
                "\"Thank you, Utkarsh. Respected judges, at Secura AI, we believe deepfake defense is not just a technological challenge—it is a fundamental human rights imperative. "
                "Our platform is built to directly champion 7 key United Nations Sustainable Development Goals:\n\n"
                "First, SDG 16: Peace, Justice, and Strong Institutions. Truth is the bedrock of democracy. Secura AI protects elections, judicial evidence, and journalism from state-sponsored "
                "synthetic disinformation, ensuring information integrity and societal trust.\n\n"
                "Second, SDG 9: Industry, Innovation, and Digital Infrastructure. By pioneering an 8-branch forensic architecture and open APIs, we are building resilient, future-ready digital "
                "infrastructure that keeps cyberspace secure against malicious generative AI.\n\n"
                "Third, SDG 8: Decent Work and Economic Growth. CEO voice cloning, synthetic wire transfers, and identity theft cost global businesses billions annually. Secura AI insulates "
                "financial systems and enterprises, preserving economic stability.\n\n"
                "Fourth, SDG 4: Quality Education. We believe defense begins with awareness. Our browser extension and public benchmark provide explainable forensic telemetry, teaching citizens "
                "and students how to identify synthetic artifacts.\n\n"
                "Fifth, SDG 5: Gender Equality. Over 90% of malicious deepfakes target women through non-consensual synthetic imagery and cyber-harassment. Secura AI acts as an unyielding protective "
                "shield against gender-based digital violence.\n\n"
                "Sixth, SDG 12: Responsible Consumption and Production. We advocate for responsible AI development through C2PA provenance tracking, distinguishing creative AI art from malicious forgery.\n\n"
                "And finally, SDGs 10 & 17: Reduced Inequalities and Global Partnerships. By offering a free, accessible browser extension and partnering with international standards bodies like C2PA and "
                "Meta, we ensure world-class protection is available to everyone, everywhere—not just wealthy corporations. Now, Navya will present what we have built so far and our future roadmap.\""
            )
        },
        {
            "num": "SPEAKER 3",
            "name": "Navya",
            "role": "Engineering & Product Lead",
            "time": "Est. 1 Min 30 Sec",
            "topic": "What Has Been Built Till Now vs. What Is On The Roadmap",
            "cue": "Clear, grounded, energetic engineering leadership.",
            "speech": (
                "\"Thank you, Jyoti. Hello judges, I'm Navya, Engineering and Product Lead. Let me present the reality of where Secura AI stands today, and where we are heading next.\n\n"
                "Here is what has been built and is fully operational right now:\n"
                "1. A production-ready FastAPI forensic backend orchestrating 8 independent forensic branches: RGB channel dynamics, optical motion vectors, ReStraV temporal representation, "
                "Swin spatial keyframe diffusion, and PRNU sensor noise.\n"
                "2. A consumer-first Canonical Binary Verdict system that converts complex neural logits into definitive, mathematically calibrated decisions: 'AI_GENERATED' or 'CAMERA_ORIGINAL', "
                "eliminating user confusion.\n"
                "3. A Chrome Manifest V3 Extension featuring an in-page cyber-forensic HUD, context menu right-click inspection, and our trademark Live Screen Sentinel that monitors video meetings in real time.\n"
                "4. A 100% deterministic fixed-frame video sampling engine that guarantees identical, reproducible results every single time on Instagram Reels, YouTube Shorts, and TikTok.\n"
                "5. And an exhaustive 80-Image Gold Benchmark across Midjourney v6, Flux, SDXL, and real camera shots, where Secura AI achieved a flawless 80 out of 80—a 100% detection rate.\n\n"
                "Now, what is currently on our roadmap for the next phase?\n"
                "First, we are building Audio-Visual Multi-Modal Fusion, integrating our 16kHz spectrogram cutoff branch to detect synthetic voice cloning and lip-sync mismatch.\n"
                "Second, we are finalizing a Mobile Native SDK to bring on-device camera provenance verification to smartphones.\n"
                "And third, we are porting our neural models to WebGPU for sub-50 millisecond zero-latency local client-side inference without server roundtrips. "
                "Next, Diya will dive deep into our cryptographic hashing and signal processing architecture.\""
            )
        },
        {
            "num": "SPEAKER 4",
            "name": "Diya",
            "role": "Cryptography & Signal Processing Lead",
            "time": "Est. 1 Min 30 Sec",
            "topic": "Deep-Dive: SHA-256 for Images, pHash for Videos & RGB Dynamics",
            "cue": "Technical, precise, confident with deep technical concepts.",
            "speech": (
                "\"Thank you, Navya. Respected judges, I am Diya, and I'll explain the cryptographic and signal-processing foundations that give Secura AI its uncompromising mathematical rigor.\n\n"
                "A common question we receive is: Why do we use SHA-256 for images, but Perceptual Hashing (pHash) for videos?\n\n"
                "For static images, we mandate SHA-256 cryptographic hashing. SHA-256 is an immutable, 256-bit cryptographic digest. Due to the avalanche effect, if even a single pixel or byte of metadata "
                "is altered, the entire hash changes completely. This is vital for digital chain-of-custody, verifying C2PA cryptographic manifests, and matching exact duplicates in law-enforcement evidentiary databases.\n\n"
                "However, videos on platforms like Instagram Reels, TikTok, or WhatsApp undergo aggressive transcoding—variable bitrate compression, re-encoding, and resolution downscaling. Under these conditions, "
                "SHA-256 breaks immediately because the underlying byte stream has changed, even though the visual content remains identical.\n\n"
                "That is why for video, we deploy pHash—Perceptual Hashing using Discrete Cosine Transforms (DCT). pHash generates a visual fingerprint based on low-frequency perceptual structure rather than raw bytes. "
                "It allows Secura AI to identify the exact same video across platforms with Hamming distance matching, even after aggressive social media compression and resizing.\n\n"
                "Furthermore, we implement RGB Temporal Channel Decomposition. Physical cameras rely on hardware Bayer filter sensors with fixed analog gain across red, green, and blue channels. Generative diffusion "
                "models generate video frames sequentially in latent space, which inevitably produces inter-frame chromatic jitter, unnatural saturation spikes, and phase-velocity drift. By decomposing the video into "
                "its RGB components, Secura AI catches temporal deepfake anomalies that spatial inspection completely misses. Harshita will now explain our rigorous testing and drawbacks we conquered.\""
            )
        },
        {
            "num": "SPEAKER 5",
            "name": "Harshita",
            "role": "QA, Testing & Model Evolution Lead",
            "time": "Est. 1 Min 30 Sec",
            "topic": "Adversarial Testing, 80-Image Benchmark & Overcoming Model Drawbacks",
            "cue": "Honest, analytical, showcasing scientific humility and relentless iteration.",
            "speech": (
                "\"Thank you, Diya. Respected judges, my name is Harshita, and I lead QA and Model Evolution. A model is only as credible as its ability to survive adversarial stress testing in the real world.\n\n"
                "During our testing journey across our 80-Image Benchmark, we encountered three major real-world drawbacks that standard AI detectors fail on, and we methodically engineered permanent solutions for each:\n\n"
                "Drawback Number One: Camera Flash Blowout False Positives. Early on, when testing real camera photos taken with direct electronic flash—especially close-up human portraits—the intense luminance "
                "bleached facial pores, mimicking the over-smooth skin texture characteristic of Midjourney and Flux. Our initial Swin probe flagged these as synthetic. We solved this by implementing dynamic facial "
                "lighting normalization and Bayer array PRNU sensor noise verification. This ensures authentic high-frequency photon shot noise grounds the photo as genuine, dropping false positives to zero.\n\n"
                "Drawback Number Two: Aggressive Social Media Downsampling. Compressed images from WhatsApp and Twitter often lose up to 70% of high-frequency pixels, causing traditional detectors to fail. "
                "We overcame this by pairing multi-scale Laplacian frequency analysis with CLIP zero-shot semantic alignment, enabling Secura AI to maintain 100% accuracy even at 50% downscaling.\n\n"
                "Drawback Number Three: Extension Video Non-Determinism on Live Reels. When we first tested live looping Instagram Reels in our Chrome Extension, testing the same reel multiple times yielded "
                "fluctuating verdicts because each click captured whatever random 2-second slice was playing. We resolved this by engineering deterministic zero-seek frame synchronization and embedding a fixed 8-keyframe "
                "strata filmstrip directly in the HUD. Now, repeated scans evaluate the exact same fixed frame sequence with 100% consistency.\n\n"
                "Our Lead Presenter will now bring all these pieces together in a live demonstration of Secura AI 2.0.\""
            )
        },
        {
            "num": "SPEAKER 6",
            "name": "Lead Presenter (You)",
            "role": "Lead Presenter & Live Demo Specialist",
            "time": "Est. 2 Mins 00 Sec",
            "topic": "Live Interactive Demonstration, Real-Time HUD, Sentinel & Closing",
            "cue": "Dynamic, interactive, sharing screen and demonstrating live capabilities with confidence.",
            "speech": (
                "\"Thank you, Harshita. Judges, let's step out of the slides and into the real world. Let me show you Secura AI 2.0 live in action.\n\n"
                "[ACTION: Open browser with Instagram Reel / benchmark asset and Chrome Extension active]\n\n"
                "Imagine you are an everyday citizen scrolling through your social feed, and you encounter this viral video Reel. To the human eye, it looks strikingly realistic. But let's ask Secura AI. "
                "I simply right-click the video, and click 'Inspect with Secura AI'.\n\n"
                "[ACTION: Right-click Reel -> Select 'Inspect with Secura AI (Forensic Scan)']\n\n"
                "Notice what just happened. In less than 2 seconds, our extension penetratively scanned past the platform's transparent overlay, captured the fixed deterministic frame sequence starting from 0.0s, "
                "and transmitted it to our multi-layer forensic engine. Look at the HUD card rendered right on the page:\n"
                "- It displays a clear, unambiguous canonical verdict: 'SYNTHETIC AI VIDEO DETECTED' with an exact 91% confidence score.\n"
                "- Under the hood, ReStraV detected an 85% trajectory anomaly, and Swin Transformer caught 78% spatial diffusion residuals.\n"
                "- Notice the Fixed Sampled Frames row right here—showing thumbnails of all extracted keyframes with individual anomaly flags.\n"
                "- And if I test this Reel again right now, notice that the verdict is 100% identical and stable.\n\n"
                "[ACTION: Click 'Live Screen Sentinel' in the HUD or popup]\n\n"
                "Now, what about live streaming deepfakes during video conferences on Zoom, Teams, or Google Meet? Here is our Live Screen Sentinel. "
                "With one click, Sentinel captures the active display buffer at 1 frame per second, running continuous background health checks. If an adversary injects a deepfake face or synthetic texture, "
                "Sentinel triggers an immediate lockdown alert with an audible strike counter.\n\n"
                "[ACTION: Switch tab to Enterprise Forensic Suite Dashboard]\n\n"
                "Finally, for enterprise compliance officers and forensic investigators, here is our Secura Enterprise Workstation. It displays cryptographic C2PA credentials, Google SynthID watermarks, "
                "interactive Error Level Analysis (ELA) heatmaps, and a full forensic audit ledger ready for court submission.\n\n"
                "[CLOSING STATEMENT]\n\n"
                "Judges, Secura AI is not a concept or a prototype. It is a tested, highly scalable, production-grade cybersecurity platform ready to restore mathematical truth to the digital world. "
                "With Meta's acceleration and global infrastructure, we can deploy this defense across billions of devices worldwide. Thank you, and our entire team is now open for your questions!\""
            )
        }
    ]

    for spk in speakers_data:
        # Speaker Card Table
        t_card = doc.add_table(rows=1, cols=1)
        t_card.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = t_card.rows[0].cells[0]
        set_cell_background(cell, "242321")
        set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
        
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        r_num = p.add_run(f"{spk['num']}: {spk['name'].upper()}")
        r_num.font.name = "Arial"
        r_num.font.size = Pt(14)
        r_num.font.bold = True
        r_num.font.color.rgb = C_PRIMARY

        p_meta = cell.add_paragraph()
        p_meta.paragraph_format.space_before = Pt(0)
        p_meta.paragraph_format.space_after = Pt(4)
        r_role = p_meta.add_run(f"Role: {spk['role']}  |  {spk['time']}  |  Topic: {spk['topic']}")
        r_role.font.name = "Arial"
        r_role.font.size = Pt(9.5)
        r_role.font.color.rgb = RGBColor(220, 215, 210)

        p_cue = cell.add_paragraph()
        p_cue.paragraph_format.space_before = Pt(0)
        p_cue.paragraph_format.space_after = Pt(0)
        r_cue = p_cue.add_run(f"Stage & Delivery Cue: {spk['cue']}")
        r_cue.font.name = "Arial"
        r_cue.font.size = Pt(9)
        r_cue.font.italic = True
        r_cue.font.color.rgb = RGBColor(160, 155, 150)

        # Speech Body
        p_body = doc.add_paragraph()
        p_body.paragraph_format.space_before = Pt(10)
        p_body.paragraph_format.space_after = Pt(16)
        p_body.paragraph_format.line_spacing = 1.15
        
        paragraphs = spk["speech"].split("\n\n")
        for idx, para in enumerate(paragraphs):
            if idx > 0:
                p_body = doc.add_paragraph()
                p_body.paragraph_format.space_before = Pt(0)
                p_body.paragraph_format.space_after = Pt(8)
                p_body.paragraph_format.line_spacing = 1.15
            
            # Check for stage action notes [ACTION: ...]
            if para.startswith("[ACTION:") or para.startswith("[CLOSING"):
                r_act = p_body.add_run(para)
                r_act.font.name = "Arial"
                r_act.font.size = Pt(10)
                r_act.font.bold = True
                r_act.font.color.rgb = C_ACCENT_BLUE
            else:
                r_txt = p_body.add_run(para)
                r_txt.font.name = "Georgia"
                r_txt.font.size = Pt(10.5)
                r_txt.font.color.rgb = C_DARK

        doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Q&A Anticipation Guide
    p_qa = doc.add_paragraph()
    r = p_qa.add_run("Judges Q&A Preparation — High-Probability Questions & Model Answers")
    r.font.name = "Arial"
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = C_PRIMARY
    p_qa.paragraph_format.space_before = Pt(16)
    p_qa.paragraph_format.space_after = Pt(8)

    qas = [
        ("Q1: How do you handle adversarial compression on social media like WhatsApp and Twitter?",
         "Diya & Harshita",
         "We deploy dual-tier evaluation: pHash for structural perceptual preservation under heavy downscaling, combined with multi-scale Laplacian residuals and CLIP semantic zero-shot alignment. In our benchmark, even after 50% resolution downscaling and JPEG quality 40 compression, Secura AI maintained 100% accuracy."),
        ("Q2: Why wouldn't a platform like Meta or Google build this internally?",
         "Utkarsh & Navya",
         "Platforms are incentivized to adopt open, verifiable multi-stakeholder standards (like C2PA) rather than proprietary black boxes that create regulatory liability. Secura AI's architecture is modular, lightweight, and plug-and-play via REST and WebGPU, designed to complement platform pipelines as an independent trust layer."),
        ("Q3: How does the model avoid false positives on professional camera photos with high flash or retouching?",
         "Harshita",
         "This was a key drawback we uncovered and resolved. We incorporated dynamic luminance normalization and physical Bayer-pattern PRNU sensor noise verification. Natural camera shots—even with studio lighting or flash—contain organic Poisson-Gaussian sensor noise and Bayer array color variance that instantly refutes synthetic diffusion claims."),
        ("Q4: What is the computational cost and latency of running an 8-branch video inspection?",
         "Navya & Diya",
         "Under our 'fast' preset, the entire 8-branch pipeline decodes and samples 16 candidate keyframes in 1.4 seconds on CPU, and under 250 milliseconds on GPU/NPU. Furthermore, our WebGPU roadmap allows edge execution directly in the client browser with zero server compute cost.")
    ]

    for q, assign, a in qas:
        p_q = doc.add_paragraph()
        p_q.paragraph_format.space_before = Pt(6)
        p_q.paragraph_format.space_after = Pt(2)
        rq = p_q.add_run(f"{q} ")
        rq.font.name = "Arial"
        rq.font.size = Pt(10)
        rq.font.bold = True
        rq.font.color.rgb = C_DARK
        
        ras = p_q.add_run(f"[{assign}]")
        ras.font.name = "Arial"
        ras.font.size = Pt(9)
        ras.font.bold = True
        ras.font.color.rgb = C_PRIMARY

        p_a = doc.add_paragraph()
        p_a.paragraph_format.space_before = Pt(0)
        p_a.paragraph_format.space_after = Pt(8)
        ra = p_a.add_run(a)
        ra.font.name = "Georgia"
        ra.font.size = Pt(9.5)
        ra.font.color.rgb = RGBColor(60, 60, 60)

    doc.save(output_path)
    print(f"Successfully generated presentation speech document: {output_path}")

if __name__ == "__main__":
    out = os.path.abspath(r"d:\SecuraAI2\Secura_AI_Judges_Presentation_Speech.docx")
    create_speech_document(out)
