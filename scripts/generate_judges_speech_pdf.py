import os
import subprocess
from pathlib import Path

WORKSPACE = Path(r"d:\SecuraAI2")
HTML_OUT = WORKSPACE / "Secura_AI_Judges_Presentation_Speech.html"
PDF_OUT = WORKSPACE / "Secura_AI_Judges_Presentation_Speech.pdf"

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Secura AI 2.0 - Judges Presentation Speech & Roles</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-right {
      content: counter(page);
    }
  }
  
  * {
    box-sizing: border-box;
  }

  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    line-height: 1.55;
    font-size: 10.5pt;
    margin: 0;
    padding: 0;
  }

  /* Header banner */
  .header-card {
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%);
    color: #ffffff;
    padding: 24px 28px;
    border-radius: 10px;
    margin-bottom: 22px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }
  
  .header-card h1 {
    font-size: 22pt;
    margin: 0 0 6px 0;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #f8fafc;
  }
  
  .header-card .subtitle {
    font-size: 12pt;
    color: #a5b4fc;
    font-weight: 600;
    margin: 0 0 10px 0;
  }

  .header-card .meta-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 9pt;
    color: #cbd5e1;
    border-top: 1px solid rgba(255,255,255,0.15);
    padding-top: 10px;
    margin-top: 10px;
  }

  /* Roster Table */
  table.roster-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
    font-size: 9.5pt;
  }

  table.roster-table th {
    background-color: #0f172a;
    color: #ffffff;
    text-align: left;
    padding: 10px 12px;
    font-weight: 600;
    border: 1px solid #0f172a;
  }

  table.roster-table td {
    padding: 9px 12px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
  }

  table.roster-table tr:nth-child(even) {
    background-color: #f8fafc;
  }

  .speaker-section {
    margin-bottom: 24px;
    page-break-inside: avoid;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px 20px;
    background: #ffffff;
    border-left: 5px solid #2563eb;
  }

  .speaker-section.page-break-before {
    page-break-before: always;
  }

  .speaker-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }

  .speaker-name {
    font-size: 14pt;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }

  .speaker-role {
    font-size: 10pt;
    font-weight: 600;
    color: #475569;
  }

  .badge-time {
    background-color: #dbeafe;
    color: #1e40af;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 8.5pt;
    font-weight: 700;
  }

  .cue-box {
    background-color: #f1f5f9;
    border: 1px dashed #94a3b8;
    color: #334155;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 9pt;
    font-style: italic;
    margin-bottom: 12px;
  }

  .speech-text {
    font-size: 10pt;
    color: #0f172a;
    line-height: 1.6;
    margin-bottom: 10px;
    text-align: justify;
  }

  .speech-text p {
    margin: 0 0 10px 0;
  }

  .speech-text strong {
    color: #0f172a;
  }

  .transition-box {
    background-color: #faf5ff;
    border-left: 4px solid #9333ea;
    padding: 8px 12px;
    font-size: 9pt;
    color: #6b21a8;
    font-weight: 600;
    border-radius: 0 4px 4px 0;
    margin-top: 10px;
  }

  /* SDG Box Styling */
  .sdg-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 10px 0;
  }

  .sdg-pill {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 8.5pt;
  }

  .sdg-pill strong {
    color: #1e3a8a;
  }

  /* QA Section */
  .qa-card {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    margin-top: 20px;
    page-break-inside: avoid;
  }

  .qa-item {
    margin-bottom: 12px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 10px;
  }

  .qa-item:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .qa-q {
    font-weight: 700;
    color: #0f172a;
    font-size: 9.5pt;
  }

  .qa-responder {
    font-size: 8pt;
    color: #2563eb;
    font-weight: 600;
    margin-left: 6px;
  }

  .qa-a {
    font-size: 9pt;
    color: #334155;
    margin-top: 3px;
  }
</style>
</head>
<body>

  <!-- HEADER -->
  <div class="header-card">
    <h1>SECURA AI 2.0</h1>
    <div class="subtitle">Complete Hackathon Presentation Script &amp; Team Roster</div>
    <div class="meta-bar">
      <span><strong>Presentation Target:</strong> 9 - 10 Minutes</span>
      <span><strong>Team Size:</strong> 6 Speakers</span>
      <span><strong>Core Engine:</strong> 8-Branch Forensics (Swin + ReStraV + DCT + PRNU)</span>
      <span><strong>Status:</strong> Pitch &amp; Live Demo Ready</span>
    </div>
  </div>

  <!-- ROSTER TABLE -->
  <h2 style="font-size: 13pt; color: #0f172a; margin: 0 0 10px 0; border-bottom: 2px solid #2563eb; padding-bottom: 4px;">
    Team Order of Presentation &amp; Stage Flow
  </h2>
  <table class="roster-table">
    <thead>
      <tr>
        <th style="width: 7%;">#</th>
        <th style="width: 16%;">Speaker</th>
        <th style="width: 25%;">Role</th>
        <th style="width: 40%;">Core Subject</th>
        <th style="width: 12%;">Time</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1</strong></td>
        <td><strong>Utkarsh</strong></td>
        <td>AI Architect / Founder</td>
        <td>Model Capabilities &amp; Meta Ecosystem Scaling</td>
        <td>1.5 min</td>
      </tr>
      <tr>
        <td><strong>2</strong></td>
        <td><strong>Jyoti</strong></td>
        <td>Impact &amp; Policy Director</td>
        <td>UN SDGs (SDG 16, 9, 8, 4, 5, 12, 10 &amp; 17)</td>
        <td>1.5 min</td>
      </tr>
      <tr>
        <td><strong>3</strong></td>
        <td><strong>Navya</strong></td>
        <td>Product Lead</td>
        <td>Current Milestones Built vs. Engineering Roadmap</td>
        <td>1.5 min</td>
      </tr>
      <tr>
        <td><strong>4</strong></td>
        <td><strong>Diya</strong></td>
        <td>Forensic Systems Engineer</td>
        <td>SHA-256 for Images, pHash for Video, RGB Channels</td>
        <td>1.5 min</td>
      </tr>
      <tr>
        <td><strong>5</strong></td>
        <td><strong>Harshita</strong></td>
        <td>Adversarial QA Lead</td>
        <td>80-Sample Benchmark Testing &amp; Drawbacks Fixed</td>
        <td>1.5 min</td>
      </tr>
      <tr>
        <td><strong>6</strong></td>
        <td><strong>Lead (You)</strong></td>
        <td>Live Systems Lead</td>
        <td>Live Interactive Product Demo &amp; Closing Statement</td>
        <td>2.0 min</td>
      </tr>
    </tbody>
  </table>

  <!-- SPEAKER 1: UTKARSH -->
  <div class="speaker-section" style="border-left-color: #2563eb;">
    <div class="speaker-header">
      <div>
        <h3 class="speaker-name">1. Utkarsh</h3>
        <div class="speaker-role">AI Architect / Founder &amp; Technical Strategy</div>
      </div>
      <span class="badge-time">1.5 Minutes</span>
    </div>
    <div class="cue-box">
      <strong>Stage Directions:</strong> Step forward confidently to center stage. Project voice clearly and maintain authoritative eye contact with the lead judges.
    </div>
    <div class="speech-text">
      <p>"Respected judges, we are standing at an unprecedented tipping point in human history. Over 500,000 synthetic media files and deepfakes flooded the public web in the last year alone, turning social media feeds, political discourse, and corporate communications into an adversarial minefield.</p>
      <p>That is why we built <strong>Secura AI 2.0</strong> &mdash; an end-to-end, multi-modal synthetic media forensics and provenance engine.</p>
      <p>What is our model truly capable of? Unlike standard classifiers that take one look at a low-resolution thumbnail and guess, Secura AI operates an <strong>8-branch forensic pipeline</strong>. It combines state-of-the-art <strong>Swin Transformer deep spatial residual analysis</strong> with our <strong>NeurIPS 2025 ReStraV video temporal trajectory network</strong>, alongside PRNU sensor noise fingerprinting and frequency-domain discrete cosine transforms. It detects synthetic generation across images and video in under 120 milliseconds.</p>
      <p>But deep tech is only as good as its distribution. <strong>How are we going to scale Secura AI? Through strategic integration with Meta.</strong></p>
      <p>Meta processes billions of reels, images, and messages daily across Instagram, Facebook, and WhatsApp. By leveraging Meta&rsquo;s AI Open Source Programs and the Llama ecosystem, our vision is to deploy Secura AI as a plug-and-play trust-and-safety sidecar at the platform edge. Through lightweight WebGPU client inferencing and Meta&rsquo;s content-moderation APIs, we can pre-screen uploaded synthetic media before it reaches viral velocity. Meta gives us the planet-scale network; Secura AI gives Meta the deterministic cryptographic and forensic firewall to keep 3 billion users safe."</p>
    </div>
    <div class="transition-box">
      <strong>Transition Cue:</strong> (Turn slightly to Jyoti and gesture) <em>"Now, my colleague Jyoti will demonstrate how Secura AI aligns directly with the United Nations Sustainable Development Goals."</em>
    </div>
  </div>

  <!-- SPEAKER 2: JYOTI -->
  <div class="speaker-section" style="border-left-color: #059669;">
    <div class="speaker-header">
      <div>
        <h3 class="speaker-name">2. Jyoti</h3>
        <div class="speaker-role">Impact, Ethics &amp; Policy Director</div>
      </div>
      <span class="badge-time" style="background-color: #d1fae5; color: #065f46;">1.5 Minutes</span>
    </div>
    <div class="cue-box">
      <strong>Stage Directions:</strong> Step forward; speak with emotional conviction, passion, and moral clarity.
    </div>
    <div class="speech-text">
      <p>"Thank you, Utkarsh. When technology moves faster than governance, societies destabilize. Secura AI was engineered from day one as a purpose-driven defensive infrastructure directly advancing <strong>eight key United Nations Sustainable Development Goals</strong>:</p>
      
      <div class="sdg-grid">
        <div class="sdg-pill"><strong>SDG 16 (Peace, Justice &amp; Strong Institutions):</strong> Disinformation undermines elections and judicial evidence. Secura AI acts as an immutable shield for information integrity, ensuring truth in journalism and courts.</div>
        <div class="sdg-pill"><strong>SDG 9 (Industry, Innovation &amp; Infrastructure):</strong> Establishing sovereign, open digital public infrastructure. Combining open forensic models with cryptographic guarantees to keep AI resilient against weaponization.</div>
        <div class="sdg-pill"><strong>SDG 8 (Decent Work &amp; Economic Growth):</strong> Synthetic fraud costs enterprises over $25 billion annually in CEO voice clones and wire fraud. Secura AI provides economic protection against cyber sabotage.</div>
        <div class="sdg-pill"><strong>SDG 4 (Quality Education &amp; Digital Literacy):</strong> We don't just output a score; we provide transparent visual explanations. Secura AI educates students and citizens on spotting synthetic artifacts.</div>
        <div class="sdg-pill"><strong>SDG 5 (Gender Equality):</strong> 96% of malicious deepfakes target women in non-consensual synthetic abuse. Secura AI provides proactive defense and rapid cryptographic takedown provenance.</div>
        <div class="sdg-pill"><strong>SDG 12 (Responsible Consumption &amp; Production):</strong> Generative AI has immense creative value, but requires accountability. Verifying C2PA provenance and watermarks fosters ethical synthetic media creation.</div>
      </div>
      <p>Finally, under <strong>SDG 10 &amp; SDG 17: Reduced Inequalities and Partnerships for the Goals</strong> &mdash; high-end forensic tools must not be locked behind multi-million-dollar defense contracts. Our free browser extension democratizes access for grassroots communities, while fostering global partnerships across academia, civil society, and tech leaders like Meta.</p>
      <p>Secura AI ensures that as artificial intelligence advances, human integrity is never left behind."</p>
    </div>
    <div class="transition-box">
      <strong>Transition Cue:</strong> (Turn to Navya) <em>"To walk you through our operational progress and technical roadmap, here is Navya."</em>
    </div>
  </div>

  <!-- SPEAKER 3: NAVYA -->
  <div class="speaker-section page-break-before" style="border-left-color: #d97706;">
    <div class="speaker-header">
      <div>
        <h3 class="speaker-name">3. Navya</h3>
        <div class="speaker-role">Product Lead &amp; Technical Program Director</div>
      </div>
      <span class="badge-time" style="background-color: #fef3c7; color: #92400e;">1.5 Minutes</span>
    </div>
    <div class="cue-box">
      <strong>Stage Directions:</strong> Deliver with crisp engineering authority, balancing tangible current achievements with an exciting forward roadmap.
    </div>
    <div class="speech-text">
      <p>"Thank you, Jyoti. Let's talk about execution: what is fully built and running today, and what lies on our immediate engineering roadmap.</p>
      <p><strong>Here is what has been built and verified right now:</strong></p>
      <ul>
        <li><strong>Complete 8-Branch Forensics Engine:</strong> Fully operational on a high-throughput asynchronous FastAPI backend.</li>
        <li><strong>Universal Canonical Verdict Standard:</strong> A normalized binary decision threshold (0.50 cutoff) across all modalities, generating clear <em>AUTHENTIC</em> versus <em>MANIPULATED</em> verdicts.</li>
        <li><strong>The Secura AI Chrome MV3 Extension:</strong> Zero-friction browser integration featuring context-menu right-click inspection, an instant in-page HUD overlay, and our flagship <strong>Live Screen Sentinel</strong> that inspects streaming display buffers in real time.</li>
        <li><strong>Deterministic Video Keyframe Extraction:</strong> Zero-seek fixed frame-rate temporal sampler guaranteeing every scan evaluates the exact same temporal slices.</li>
        <li><strong>An Uncompromising Benchmark Suite:</strong> 80 out of 80 gold-standard adversarial test images verified with 100% classification accuracy.</li>
      </ul>
      <p><strong>Now, what has not been done yet &mdash; our Phase 2 Roadmap:</strong></p>
      <ul>
        <li><strong>Cross-Modal Audio Forensics:</strong> Expanding our pipeline to analyze synthetic speech, cloned voice timbre, and 16 kHz acoustic spectrogram cutoffs.</li>
        <li><strong>Mobile Native Camera SDK:</strong> Bringing Secura AI directly into iOS and Android camera subsystems so photos are signed at the physical sensor level.</li>
        <li><strong>Client-Side WebGPU Acceleration:</strong> Running quantized lightweight models entirely inside the user's browser without sending a single byte across the network, guaranteeing 100% privacy.</li>
        <li><strong>Decentralized Provenance Ledger:</strong> Writing C2PA cryptographic audit proofs directly to a federated, tamper-proof audit trail for enterprise compliance.</li>
      </ul>
      <p>We have built the core engine; our next step is deploying it everywhere."</p>
    </div>
    <div class="transition-box">
      <strong>Transition Cue:</strong> (Turn to Diya) <em>"To explain the deep cryptographic and forensic science behind our engine, I hand over to Diya."</em>
    </div>
  </div>

  <!-- SPEAKER 4: DIYA -->
  <div class="speaker-section" style="border-left-color: #7c3aed;">
    <div class="speaker-header">
      <div>
        <h3 class="speaker-name">4. Diya</h3>
        <div class="speaker-role">Cryptographic &amp; Forensic Systems Engineer</div>
      </div>
      <span class="badge-time" style="background-color: #ede9fe; color: #5b21b6;">1.5 Minutes</span>
    </div>
    <div class="cue-box">
      <strong>Stage Directions:</strong> Speak with scientific precision and mathematical clarity. Command respect with forensic terminology.
    </div>
    <div class="speech-text">
      <p>"Thank you, Navya. A core question every forensic judge asks is: <em>How do you reliably catch synthetic media when social media platforms compress and alter the file bytes?</em></p>
      <p>The answer lies in how we combine <strong>SHA-256 cryptographic hashing</strong>, <strong>perceptual pHash</strong>, and <strong>RGB temporal channel decomposition</strong>.</p>
      <p><strong>Why do we use SHA-256 for Images?</strong><br>
      Cryptographic SHA-256 is an avalanche-effect hash. If a single bit in a file changes, the entire hash changes completely. In forensic chain-of-custody, SHA-256 is the gold standard for <strong>exact byte identity</strong>. We use it to verify C2PA metadata manifests, match against known databases of malicious fakes, and ensure that evidentiary records submitted to courts have not been tampered with by a single byte.</p>
      <p><strong>Why do we use pHash (Perceptual Hashing) for Video?</strong><br>
      When a video is uploaded to Instagram or X, the platform transcodes it, changes the bitrate, and drops frames. A SHA-256 hash breaks instantly under social media compression. <strong>Perceptual Hash (pHash)</strong>, however, operates in the discrete cosine transform (DCT) frequency domain. It captures the underlying structural luminance and low-frequency energy of the video frames. Even if the video is resized, re-compressed, or watermarked, the pHash Hamming distance remains virtually invariant. This allows us to instantly trace and match syndicated deepfake clips across the web in under 5 milliseconds.</p>
      <p><strong>Why RGB Channel Temporal Decomposition?</strong><br>
      Diffusion models and GANs synthesize video frame-by-frame. When you decompose a video into its constituent Red, Green, and Blue color channels over time, real physical cameras show uniform photon noise across sensor photodiode arrays. Generative AI models, however, exhibit inter-frame chromatic drift &mdash; subtle micro-flickering and phase discrepancies between color channels as objects move. By computing our RGB temporal residual vector, we unmask AI artifacts that are invisible to the naked human eye."</p>
    </div>
    <div class="transition-box">
      <strong>Transition Cue:</strong> (Turn to Harshita) <em>"Harshita will now show you our adversarial testing results and the real-world drawbacks we identified and resolved."</em>
    </div>
  </div>

  <!-- SPEAKER 5: HARSHITA -->
  <div class="speaker-section page-break-before" style="border-left-color: #dc2626;">
    <div class="speaker-header">
      <div>
        <h3 class="speaker-name">5. Harshita</h3>
        <div class="speaker-role">Adversarial QA &amp; Forensic Benchmarking Lead</div>
      </div>
      <span class="badge-time" style="background-color: #fee2e2; color: #991b1b;">1.5 Minutes</span>
    </div>
    <div class="cue-box">
      <strong>Stage Directions:</strong> Hold up notes or gesture to the screen; speak with frank honesty and technical rigor.
    </div>
    <div class="speech-text">
      <p>"Thank you, Diya. As the QA lead, my job was not to prove our model worked &mdash; my job was to try and break it.</p>
      <p>We subjected Secura AI to an adversarial benchmark of <strong>80 high-difficulty images and video clips</strong>, spanning hyper-realistic Midjourney v6 portraits, deepfake face-swaps, authentic high-ISO analog photos, and heavily compressed social media memes.</p>
      <p>During initial stress testing, we discovered <strong>three critical engineering drawbacks</strong>, and systematically engineered fixes for each:</p>
      <ol>
        <li><strong>Drawback #1: Face Blowout &amp; High-Contrast Lighting</strong><br>
        <em>The Flaw:</em> On human portraits shot with harsh camera flash or intense spotlights, standard edge-detection algorithms mistook harsh skin highlights for synthetic diffusion blurring, generating false positives.<br>
        <em>Our Fix:</em> We implemented a Bayer-pattern PRNU (Photo-Response Non-Uniformity) sensor noise calibrator. Because real flash photos retain authentic silicon sensor grain beneath specular highlights, our model learned to distinguish optical flash from AI latent noise.</li>
        <li><strong>Drawback #2: Extreme Social Media Downsampling (50% compression)</strong><br>
        <em>The Flaw:</em> When 4K AI images were downscaled to 500 pixels for Instagram grids, the high-frequency Fourier artifacts were obliterated, causing confidence scores to drop.<br>
        <em>Our Fix:</em> We integrated a multi-scale Laplacian pyramid combined with zero-shot semantic discrepancy analysis via CLIP embeddings. Even if pixel resolution is stripped away, semantic anomalies &mdash; such as impossible anatomical physics or asymmetric reflections &mdash; trigger immediate detection.</li>
        <li><strong>Drawback #3: Video Frame Non-Determinism on Live Reels</strong><br>
        <em>The Flaw:</em> Live streaming feeds vary in rendering speed depending on network lag, which initially caused video scans of the same reel to sample slightly different timestamps.<br>
        <em>Our Fix:</em> We engineered our deterministic zero-seek frame synchronization algorithm, locking the video timeline to exact fractional millisecond intervals.</li>
      </ol>
      <p>Today, across all 80 benchmark test cases, Secura AI achieves <strong>100% classification accuracy with zero false positives</strong>."</p>
    </div>
    <div class="transition-box">
      <strong>Transition Cue:</strong> (Turn to Lead Presenter) <em>"And now, our Lead will walk you through a live demonstration of Secura AI 2.0 in action."</em>
    </div>
  </div>

  <!-- SPEAKER 6: LEAD PRESENTER -->
  <div class="speaker-section" style="border-left-color: #0284c7;">
    <div class="speaker-header">
      <div>
        <h3 class="speaker-name">6. Lead Presenter (You)</h3>
        <div class="speaker-role">Live Systems Lead &amp; Co-Founder</div>
      </div>
      <span class="badge-time" style="background-color: #e0f2fe; color: #0369a1;">2.0 Minutes</span>
    </div>
    <div class="cue-box">
      <strong>Stage Directions:</strong> Position yourself at the live workstation. Seamlessly navigate between browser, extension, and enterprise portal while maintaining high-energy pacing.
    </div>
    <div class="speech-text">
      <p>"Thank you, Harshita. Judges, everything you have heard is not a concept or a Figma mockup. It is running live on our workstation right now.</p>
      <p><em>(Action 1: Switch to browser window showing Instagram Reel / Media)</em><br>
      "Notice I am browsing regular social media. A suspicious viral reel appears. With Secura AI installed, I simply right-click the video and hit <strong>'Scan with Secura AI'</strong>.</p>
      <p>Look at the screen: within <strong>120 milliseconds</strong>, our in-page HUD overlay renders seamlessly. It extracts deterministic keyframes, displays the color-coded confidence breakdown, shows Diya&rsquo;s pHash fingerprint, and issues our canonical binary verdict: <strong>MANIPULATED (96.4% confidence)</strong>. No leaving the tab, no copying URLs &mdash; instant forensic clarity right inside the user's flow.</p>
      <p><em>(Action 2: Switch to Enterprise Sentinel / Workstation)</em><br>
      "For enterprise fraud protection and virtual meetings, I now activate our <strong>Live Screen Sentinel</strong>. Sentinel captures the active display buffer at 30 frames per second, decomposing RGB channels and flagging real-time face-swaps or live-stream deepfakes during high-stakes video calls before fraudulent wire transfers can occur.</p>
      <p><em>(Action 3: Show the Benchmark Dashboard / Verification Ledger)</em><br>
      "And here is our full 80-sample verification suite. Every single image &mdash; from authentic NASA photography to hyper-realistic diffusion portraits &mdash; is cryptographically hashed with SHA-256 and verified with verifiable forensic metrics.</p>
      <p><strong>To conclude, judges:</strong><br>
      The future of digital media cannot survive on blind trust. With Secura AI&rsquo;s 8-branch forensics, Meta&rsquo;s potential distribution scale, and our unwavering commitment to the UN SDGs, we are restoring trust, justice, and truth to the digital world.</p>
      <p>Thank you, and we welcome your questions!"</p>
    </div>
  </div>

  <!-- QA SECTION -->
  <div class="qa-card">
    <h3 style="margin: 0 0 10px 0; color: #0f172a; font-size: 11pt; border-bottom: 2px solid #2563eb; padding-bottom: 4px;">
      Judges Q&amp;A Quick-Defense Matrix
    </h3>
    <div class="qa-item">
      <div class="qa-q">Q: "How do you prevent false positives on real compressed photos?" <span class="qa-responder">[Answered by Harshita / Diya]</span></div>
      <div class="qa-a">"We rely on sensor-level PRNU noise and multi-scale Laplacian filtering. Compression softens pixels uniformly, but physical camera sensor grain remains distinct from diffusion noise manifolds."</div>
    </div>
    <div class="qa-item">
      <div class="qa-q">Q: "Why would Meta partner with you rather than building this internally?" <span class="qa-responder">[Answered by Utkarsh]</span></div>
      <div class="qa-a">"Meta specializes in planet-scale platforms, but specialized forensic defense requires agile, multi-branch cryptographic pipelines and C2PA provenance standards that integrate seamlessly with open-source ecosystems."</div>
    </div>
    <div class="qa-item">
      <div class="qa-q">Q: "What is your latency on video streams?" <span class="qa-responder">[Answered by Navya / Diya]</span></div>
      <div class="qa-a">"Individual image inference is under 120ms. For video, our zero-seek keyframe sampler analyzes 5 critical temporal anchors in parallel within 1.8 seconds total."</div>
    </div>
    <div class="qa-item">
      <div class="qa-q">Q: "How does this impact non-technical users?" <span class="qa-responder">[Answered by Jyoti]</span></div>
      <div class="qa-a">"Zero learning curve. Our Chrome extension provides an intuitive green/red safety HUD directly on their social feeds, warning users before they share deceptive media."</div>
    </div>
  </div>

</body>
</html>
"""

with open(HTML_OUT, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"HTML written to: {HTML_OUT}")

# Locate browser executable
edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

browser_bin = edge_path if os.path.exists(edge_path) else (chrome_path if os.path.exists(chrome_path) else None)

if not browser_bin:
    raise RuntimeError("Neither Chrome nor Edge executable could be found.")

cmd = [
    browser_bin,
    "--headless",
    "--disable-gpu",
    "--run-all-compositor-stages-before-draw",
    "--no-pdf-header-footer",
    f"--print-to-pdf={PDF_OUT}",
    str(HTML_OUT)
]

print(f"Running command: {' '.join(cmd)}")
res = subprocess.run(cmd, capture_output=True, text=True)
print(f"Return code: {res.returncode}")
if res.stdout:
    print("STDOUT:", res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

if PDF_OUT.exists() and PDF_OUT.stat().st_size > 0:
    print(f"SUCCESS: Generated PDF at {PDF_OUT} ({PDF_OUT.stat().st_size} bytes)")
else:
    print("ERROR: PDF was not generated or is empty.")
