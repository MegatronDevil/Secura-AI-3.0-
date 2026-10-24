# SECURA AI — CANONICAL METADATA & PROVENANCE DATA SPECIFICATION & SCHEMA
**Standard:** ISO/IEC 27037:2012 (Digital Evidence Handling) & C2PA Specification 1.3  
**Status:** Canonical Production Specification  
**Version:** 3.0.0-PROV  
**Last Revised:** October 2026  

---

## 1. Architectural Philosophy: The Eight-Dimension Boundary

In compliance with forensic guidelines and evidentiary standards, Secura AI strictly separates digital acquisition characteristics from physical capture reality. Prior systems routinely conflated where an asset was downloaded or analyzed (e.g., host laptop camera, web browser session) with where and how it was physically captured.

Secura AI mandates that **no field may infer or overwrite another without verifiable, cryptographic, or physical sensor evidence.**

```
                               ┌─────────────────────────────────────────────────────────────┐
                               │                    ACQUISITION WORKFLOW                     │
                               └──────────────────────────────┬──────────────────────────────┘
                                                              │
                     ┌────────────────────────────────────────┴────────────────────────────────────────┐
                     ▼                                                                                 ▼
     ┌───────────────────────────────┐                                                 ┌───────────────────────────────┐
     │    ORIGINAL PHYSICAL ASSET    │                                                 │    CONTAINER / TRANSMISSION   │
     ├───────────────────────────────┤                                                 ├───────────────────────────────┤
     │ 1. Original Capture Device    │ (Hardware sensor / EXIF Make & Model)           │ 5. Acquisition Source         │ (Verified URL / Upload Gateway)
     │ 2. Original Capture Location  │ (Hardware GPS receiver tags, redacted)          │ 6. Transfer & Editing History │ (Software markers, re-compression)
     │ 3. Creation Timestamp         │ (EXIF DateTimeOriginal / container atom)        │ 7. Current Analysis Enclave   │ (Auditing host, strictly isolated)
     │ 4. Original Creator / App     │ (C2PA claim generator / author tag)             └───────────────────────────────┘
     └───────────────────────────────┘                                                                 │
                                                              │                                        │
                                                              └───────────────────┬────────────────────┘
                                                                                  ▼
                                                               ┌───────────────────────────────────────┐
                                                               │ 8. Provenance Verification Status     │
                                                               │ (Consensus synthesis across 1-7)      │
                                                               └───────────────────────────────────────┘
```

---

## 2. Mandatory Field Status Taxonomy (7 States)

Every provenance field in Secura AI is accompanied by a standardized `MetadataFieldStatus` indicator:

| Status Code | Description | Example Condition |
| :--- | :--- | :--- |
| `VERIFIED` | Cryptographically validated or sealed with valid signature. | C2PA signed manifest matches root certificate; acquisition source verified by ingestion gateway. |
| `PRESENT_UNVERIFIED` | Present in container tags, but unsigned and subject to manipulation. | EXIF Make/Model tag present in consumer JPEG; unsigned EXIF GPS IFD coordinates. |
| `INFERRED` | Deduced through multi-layer structural heuristics; clearly stated. | Quantization matrix matching Photoshop CS6; file naming convention matching messaging app. |
| `CONFLICTING` | Irreconcilable contradictions between metadata claims and payload. | EXIF claims iPhone 15 Pro, but quantization tables belong to libjpeg and sensor noise is absent. |
| `NOT_AVAILABLE` | Field is absent or stripped from container. Honest neutrality maintained. | Asset downloaded from social media with EXIF stripped; no camera tag present. |
| `EXTRACTION_FAILED` | Parser or decoder encountered corrupted bytes during extraction. | Malformed EXIF header; truncated JUMBF box. |
| `NOT_APPLICABLE` | Field is structurally irrelevant to this media format or analysis mode. | Lens aperture tag on a synthetically generated SVG or pure screen capture stream. |

---

## 3. The Eight Canonical Provenance Dimensions

### Dimension 1: Original Capture Device
* **Definition:** The physical optoelectronic device (camera body, smartphone, drone sensor) that acquired the raw photons.
* **Evidence Source:** Standardized EXIF tags (`Make`, `Model`, `LensModel`, `BodySerialNumber`).
* **Honesty Invariant:** Absence of EXIF tags does not prove synthetic generation (messaging apps strip EXIF). However, non-AI images without EXIF **MUST NOT** be labeled "CAMERA CAPTURED". They are classified as `"NOT_AI_GENERATED"` with status `NOT_AVAILABLE`.
* **Host Telemetry Isolation:** The auditing workstation's hardware (e.g., ASUS webcam) **MUST NEVER** be attributed to an uploaded media asset.
* **Default When Missing:** `"Capture device unavailable from container metadata"` (`status: NOT_AVAILABLE`).

### Dimension 2: Original Capture Location
* **Definition:** The geographic point on Earth where the photons struck the camera sensor.
* **Evidence Source:** Hardware GPS receiver tags embedded in EXIF block (`GPSLatitude`, `GPSLongitude`, `GPSAltitude`).
* **Honesty Invariant:** If an image is uploaded without GPS tags, the system **MUST NOT** substitute the user's IP geolocation, browser location, or computer coordinates.
* **Default When Missing:** `"Original capture location unavailable from this file"` (`status: NOT_AVAILABLE`).
* **Privacy Controls:** Authorized personnel only. Public-facing dossiers obscure precision beyond 2 decimal places to maintain privacy.

### Dimension 3: Original Creation Timestamp
* **Definition:** The exact point in time when the physical recording was initiated.
* **Evidence Source:** EXIF `DateTimeOriginal` (Tag 36867), `CreateDate`, or MP4 `mvhd` creation atom.
* **Default When Missing:** `"Creation timestamp unavailable from container"` (`status: NOT_AVAILABLE`).

### Dimension 4: Original Creator or Tooling
* **Definition:** The legal individual, organization, or software application that authored the initial file bytes.
* **Evidence Source:** IPTC Byline, XMP Creator Tool, C2PA Claim Generator identifier (`c2pa.claim_generator`), or Software tag.
* **Default When Missing:** `"Original creator or application unavailable"` (`status: NOT_AVAILABLE`).

### Dimension 5: Acquisition Source
* **Definition:** The immediate mechanism or channel through which Secura AI ingested the file for inspection.
* **Evidence Source:** Chrome extension DOM capture URL, HTTP multipart form upload, WebRTC media track, or direct file dialog.
* **Examples:**
  * `"Web Client Upload (Browser Ingestion Gateway)"`
  * `"Web Ingestion (Captured from https://unsplash.com/photos/12345)"`
  * `"Live WebRTC Screen Share Capture"`
  * `"Optical Ingestion (Webcam Stream)"`

### Dimension 6: Transfer and Editing History
* **Definition:** Detectable traces of intermediate transmission hops, recompressions, transcodings, or sanitizations.
* **Evidence Source:** Quantization table mismatches, multiple APP markers in JPEG stream, FFmpeg encoder tags in MP4, or messaging app filename patterns (`IMG-WA...`).
* **Forensic Value:** Explains why original EXIF may be absent without indicting the user or assuming generative AI.

### Dimension 7: Current Analysis Environment
* **Definition:** The operational workstation environment where the inspection executed. Strictly isolated from media origin.
* **Evidence Source:** Secura AI Analysis Node runtime telemetry.
* **Example:** `"Secura AI Forensic Workstation (Windows 11 x64 / Python 3.12 / PyTorch Node)"` (`status: VERIFIED`).

### Dimension 8: Provenance Verification Status
* **Definition:** An overarching evidence synthesis indicator categorizing the cryptographic and forensic integrity of the provenance trail.
* **Taxonomy:**
  1. `VERIFIED`: Complete cryptographic verification (C2PA signature matches active root certificate).
  2. `PRESENT_UNVERIFIED`: Device or location metadata exists in container but lacks cryptographic signature seal.
  3. `INFERRED`: Plausible attribution deduced from non-standard vendor tags or secondary heuristics; explicitly labeled as unconfirmed.
  4. `CONFLICTING`: Metadata contains irreconcilable contradictions (e.g., camera make claims iPhone 15 Pro, but quantization tables belong to Adobe Photoshop).
  5. `NOT_AVAILABLE`: Metadata stripped or absent. Honest neutrality maintained.

---

## 4. JSON Schema Specification

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SecuraAI_ProvenanceRecord",
  "type": "object",
  "required": [
    "analysis_id",
    "input_sha256",
    "file_name",
    "file_size_bytes",
    "detected_mime",
    "analysis_timestamp_utc",
    "dim_original_capture_device",
    "dim_original_capture_location",
    "dim_original_creation_timestamp",
    "dim_original_creator",
    "dim_acquisition_source",
    "dim_transfer_history",
    "dim_current_analysis_environment",
    "dim_provenance_verification_status",
    "verification_status",
    "c2pa_status",
    "provenance_notes"
  ],
  "properties": {
    "analysis_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique stable identifier for the forensic audit trail"
    },
    "input_sha256": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "Cryptographic SHA-256 hash computed directly on raw input bytes prior to decoding"
    },
    "file_name": {
      "type": "string",
      "description": "Declared input filename"
    },
    "file_size_bytes": {
      "type": "integer",
      "minimum": 1,
      "description": "Exact byte count of input stream"
    },
    "detected_mime": {
      "type": "string",
      "description": "MIME type validated via magic bytes header inspection"
    },
    "analysis_timestamp_utc": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 UTC timestamp of inspection initiation"
    },
    "dim_original_capture_device": {
      "$ref": "#/definitions/ProvenanceFieldEntry"
    },
    "dim_original_capture_location": {
      "$ref": "#/definitions/ProvenanceFieldEntry"
    },
    "dim_original_creation_timestamp": {
      "$ref": "#/definitions/ProvenanceFieldEntry"
    },
    "dim_original_creator": {
      "$ref": "#/definitions/ProvenanceFieldEntry"
    },
    "dim_acquisition_source": {
      "$ref": "#/definitions/ProvenanceFieldEntry"
    },
    "dim_transfer_history": {
      "$ref": "#/definitions/ProvenanceFieldEntry"
    },
    "dim_current_analysis_environment": {
      "$ref": "#/definitions/ProvenanceFieldEntry"
    },
    "dim_provenance_verification_status": {
      "$ref": "#/definitions/ProvenanceFieldEntry"
    },
    "verification_status": {
      "type": "string",
      "enum": [
        "VERIFIED",
        "PRESENT_UNVERIFIED",
        "INFERRED",
        "CONFLICTING",
        "NOT_AVAILABLE",
        "EXTRACTION_FAILED",
        "NOT_APPLICABLE"
      ]
    },
    "c2pa_status": {
      "type": "string",
      "enum": [
        "VALID",
        "INVALID",
        "UNVERIFIABLE",
        "ABSENT",
        "INSPECTION_ERROR"
      ]
    },
    "provenance_notes": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Explanatory caveats detailing what information cannot be verified from available bytes"
    }
  },
  "definitions": {
    "ProvenanceFieldEntry": {
      "type": "object",
      "required": ["value", "status", "source", "extraction_method", "evidence_notes"],
      "properties": {
        "value": { "type": "string" },
        "status": {
          "type": "string",
          "enum": [
            "VERIFIED",
            "PRESENT_UNVERIFIED",
            "INFERRED",
            "CONFLICTING",
            "NOT_AVAILABLE",
            "EXTRACTION_FAILED",
            "NOT_APPLICABLE"
          ]
        },
        "source": { "type": "string" },
        "extraction_method": { "type": "string" },
        "evidence_notes": { "type": "string" }
      }
    }
  }
}
```

---

## 5. Canonical Decision Mapping & Reporting Guarantees

| Detection Finding | Sensor EXIF Status | Canonical Label | Display Headline | Consumer Explanation |
| :--- | :--- | :--- | :--- | :--- |
| $p_{\text{ai}} \ge 0.50$ | Any | `AI_GENERATED` | **AI GENERATED** | Synthetic generator diffusion artifacts or temporal representations identified. |
| $p_{\text{ai}} < 0.45$ | Hardware EXIF Present | `CAMERA_CAPTURED` | **CAMERA CAPTURED** | Optical sensor noise and authentic device hardware metadata verified. |
| $p_{\text{ai}} < 0.45$ | EXIF Stripped / Absent | `NOT_AI_GENERATED` | **NOT AI GENERATED** | No AI artifacts detected. Origin cannot be certified as physical camera capture because metadata is stripped. |
| $0.45 \le p_{\text{ai}} < 0.50$ | Any | `INCONCLUSIVE` | **INCONCLUSIVE** | Evidence is ambiguous or degraded (high compression / low resolution). Human review required. |

---

## 6. Disclaimers & Evidentiary Invariants

1. **SHA-256 Checksum:** Establishes bit-level integrity and chain-of-custody for the analyzed buffer. It does **NOT** authenticate original physical ownership or author identity.
2. **Unsigned Container:** Standard consumer cameras and messaging apps do not embed cryptographic C2PA manifests. An unsigned container does **NOT** prove that media is AI-generated.
3. **Decoupled Workstation Telemetry:** The client browser or local workstation hardware (e.g., ASUS integrated camera, host GPU) is registered exclusively under Dimension 7 (`Current Analysis Environment`). It must **NEVER** be used to fill in missing metadata for uploaded files.
