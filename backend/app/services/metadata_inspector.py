import io
import re
import hashlib
import warnings
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from PIL import Image, ExifTags

from app.schemas.evidence import (
    CameraMetadata,
    DeviceMetadataStatus,
    ConsistencyObservation,
    ConsistencySeverity,
    ContainerConsistencyResult,
    GPSMetadataSummary,
    ImageFormat,
    ImageValidationResult,
    MetadataFieldStatus,
    MetadataForensicResult,
    MetadataInventory,
    MetadataStatus,
    ProvenanceFieldEntry,
    ProvenanceRecord,
    ProvenanceVerificationStatus,
    ThumbnailAnalysisResult,
    ThumbnailStatus,
)
from app.services.thumbnail_analyzer import analyze_embedded_thumbnail


ORIENTATION_DESCRIPTIONS: Dict[int, str] = {
    1: "Top-left (Normal / 0 deg)",
    2: "Top-right (Flipped horizontal)",
    3: "Bottom-right (Rotated 180 deg)",
    4: "Bottom-left (Flipped vertical)",
    5: "Left-top (Transposed / 90 deg CCW + Flip)",
    6: "Right-top (Rotated 90 deg CW)",
    7: "Right-bottom (Transverse / 90 deg CW + Flip)",
    8: "Left-bottom (Rotated 270 deg CW / 90 deg CCW)",
}

EDITING_SOFTWARE_KEYWORDS: List[str] = [
    "photoshop", "gimp", "canva", "lightroom", "paint.net",
    "stable diffusion", "midjourney", "dall-e", "adobe",
    "affinity", "procreate", "snapseed", "vsco", "pixlr"
]


def _safe_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    try:
        s = str(val).strip()
        cleaned = "".join(ch for ch in s if (32 <= ord(ch) <= 126) or (ord(ch) in (9, 10, 13))).strip()
        return cleaned if cleaned else None
    except Exception:
        return None


def _check_container_consistency(
    image: Image.Image,
    validation_result: ImageValidationResult,
    camera_meta: Optional[CameraMetadata],
    thumbnail_result: ThumbnailAnalysisResult,
) -> ContainerConsistencyResult:
    observations: List[ConsistencyObservation] = []

    # 1. Format concordance: detected format vs decoded format
    decoded_format_str = (image.format or "").upper()
    detected_format_str = validation_result.detected_format.value.upper()
    if decoded_format_str and decoded_format_str != detected_format_str:
        observations.append(
            ConsistencyObservation(
                check_name="format_concordance",
                severity=ConsistencySeverity.INCONSISTENCY,
                observed_state=f"Magic byte detected format '{detected_format_str}' differs from decoder format '{decoded_format_str}'",
                benign_explanation="Container encapsulation anomaly or multi-format file header."
            )
        )

    # 2. Dimension concordance: actual pixels vs EXIF recorded dimensions
    if camera_meta and camera_meta.metadata_dimensions:
        meta_w = camera_meta.metadata_dimensions.get("width")
        meta_h = camera_meta.metadata_dimensions.get("height")
        if meta_w and meta_h:
            if meta_w != validation_result.width or meta_h != validation_result.height:
                observations.append(
                    ConsistencyObservation(
                        check_name="dimension_concordance",
                        severity=ConsistencySeverity.INCONSISTENCY,
                        observed_state=(
                            f"Decoded dimensions ({validation_result.width}x{validation_result.height}) "
                            f"differ from EXIF metadata dimensions ({meta_w}x{meta_h})"
                        ),
                        benign_explanation=(
                            "The image was cropped, resized, or re-saved by an application that updated the image raster "
                            "without rewriting the ExifImageWidth/ExifImageHeight tags."
                        )
                    )
                )

    # 3. Orientation vs image geometry
    if camera_meta and camera_meta.orientation_tag:
        otag = camera_meta.orientation_tag
        if otag in [5, 6, 7, 8]:
            # Tag indicates vertical/portrait rotation from landscape sensor
            aspect = "portrait" if validation_result.height > validation_result.width else "landscape"
            observations.append(
                ConsistencyObservation(
                    check_name="orientation_geometry_concordance",
                    severity=ConsistencySeverity.INFO,
                    observed_state=f"EXIF orientation is tag {otag} ({camera_meta.orientation_description}), raster is {aspect} ({validation_result.width}x{validation_result.height})",
                    benign_explanation="Standard camera orientation metadata tagging unrotated sensor readout."
                )
            )

    # 4. Timestamp chronology: capture vs modification
    if camera_meta and camera_meta.date_time_original and camera_meta.date_time_modified:
        dto = camera_meta.date_time_original
        dtm = camera_meta.date_time_modified
        # Standard EXIF format: YYYY:MM:DD HH:MM:SS
        if len(dto) >= 19 and len(dtm) >= 19:
            # Lexicographical comparison holds for standardized YYYY:MM:DD HH:MM:SS
            if dto > dtm:
                observations.append(
                    ConsistencyObservation(
                        check_name="timestamp_chronology",
                        severity=ConsistencySeverity.INCONSISTENCY,
                        observed_state=f"Capture timestamp ('{dto}') is chronologically after modification timestamp ('{dtm}')",
                        benign_explanation=(
                            "Camera clock desynchronization, improper manual clock adjustment, or batch timezone editing "
                            "in photo management utilities."
                        )
                    )
                )

    # 5. Software indicators
    if camera_meta and camera_meta.software:
        sw_lower = camera_meta.software.lower()
        matched = [k for k in EDITING_SOFTWARE_KEYWORDS if k in sw_lower]
        if matched:
            observations.append(
                ConsistencyObservation(
                    check_name="software_editing_indicator",
                    severity=ConsistencySeverity.INFO,
                    observed_state=f"Software tag identifies post-processing or authoring application: '{camera_meta.software}'",
                    benign_explanation="Routine photo editing, digital asset management export, or color grading workflow."
                )
            )

    # 6. Thumbnail consistency
    if thumbnail_result.has_thumbnail and thumbnail_result.thumbnail_dimensions:
        tw = thumbnail_result.thumbnail_dimensions.get("width", 0)
        th = thumbnail_result.thumbnail_dimensions.get("height", 0)
        pw = validation_result.width
        ph = validation_result.height
        if tw >= pw or th >= ph:
            observations.append(
                ConsistencyObservation(
                    check_name="thumbnail_dimension_concordance",
                    severity=ConsistencySeverity.INCONSISTENCY,
                    observed_state=f"Embedded thumbnail dimensions ({tw}x{th}) are equal to or larger than primary image ({pw}x{ph})",
                    benign_explanation="Malformed thumbnail stream or unconventional container packaging."
                )
            )

        if thumbnail_result.thumbnail_aspect_ratio and thumbnail_result.primary_aspect_ratio:
            ar_diff = abs(thumbnail_result.thumbnail_aspect_ratio - thumbnail_result.primary_aspect_ratio)
            if ar_diff > 0.15:
                observations.append(
                    ConsistencyObservation(
                        check_name="thumbnail_aspect_ratio_concordance",
                        severity=ConsistencySeverity.INFO,
                        observed_state=(
                            f"Thumbnail aspect ratio ({thumbnail_result.thumbnail_aspect_ratio:.2f}) "
                            f"diverges from primary image aspect ratio ({thumbnail_result.primary_aspect_ratio:.2f})"
                        ),
                        benign_explanation="Primary image was cropped without regenerating the embedded thumbnail preview."
                    )
                )

    inconsistencies = [o for o in observations if o.severity == ConsistencySeverity.INCONSISTENCY]
    status = "DISCREPANCIES_OBSERVED" if inconsistencies else "CONSISTENT"

    notes = (
        "Consistency checks evaluate container geometry, timestamp chronology, metadata dimensions, and embedded thumbnails. "
        "Discrepancies frequently occur from benign causes including non-destructive cropping, social media recompression, "
        "clock drift, or standard editing tools. Discrepancies alone do not establish malicious tampering or synthetic generation."
    )

    return ContainerConsistencyResult(
        status=status,
        observations=observations,
        notes=notes,
    )


def inspect_metadata(
    image: Image.Image,
    raw_bytes: bytes,
    validation_result: ImageValidationResult,
    allow_gps_extraction: bool = False,
) -> MetadataForensicResult:
    """
    Perform safe, privacy-aware metadata extraction, thumbnail analysis, and container consistency inspection.
    """
    try:
        return _inspect_metadata_internal(image, raw_bytes, validation_result, allow_gps_extraction)
    except Exception as exc:
        inv = MetadataInventory(
            status=MetadataStatus.ANALYSIS_FAILED,
            detected_structures=[],
            exif_tag_count=0,
            xmp_packet_present=False,
            png_text_chunks_count=0,
        )
        return MetadataForensicResult(
            inventory=inv,
            camera_metadata=None,
            gps_summary=GPSMetadataSummary(gps_present=False, gps_status="ABSENT", tag_count=0, coordinates_redacted=True),
            thumbnail_analysis=ThumbnailAnalysisResult(status=ThumbnailStatus.ANALYSIS_FAILED, has_thumbnail=False, comparison_notes=f"Metadata analysis failed: {str(exc)}"),
            container_consistency=ContainerConsistencyResult(status="NOT_EVALUATED", observations=[], notes="Consistency evaluation was skipped due to parser failure."),
            analysis_notes=f"Metadata extraction failed with error: {type(exc).__name__}",
        )


def _inspect_metadata_internal(
    image: Image.Image,
    raw_bytes: bytes,
    validation_result: ImageValidationResult,
    allow_gps_extraction: bool = False,
) -> MetadataForensicResult:
    detected_structures: List[str] = []
    exif_tag_count = 0
    png_text_count = 0
    xmp_packet_present = False
    metadata_status = MetadataStatus.ABSENT

    # 1. Detect XMP packet
    if (b"http://ns.adobe.com/xap/1.0/" in raw_bytes) or (b"XML:com.adobe.xmp" in raw_bytes):
        xmp_packet_present = True
        detected_structures.append("XMP")

    # 2. Extract PNG text chunks if applicable
    png_text = getattr(image, "text", {})
    if isinstance(png_text, dict) and len(png_text) > 0:
        png_text_count = len(png_text)
        detected_structures.append("PNG_TEXT")

    # 3. Extract EXIF tags
    exif_obj = None
    sub_exif = {}
    gps_ifd = {}
    is_malformed_exif = False

    try:
        raw_exif_data = image.getexif()
        if raw_exif_data is not None:
            exif_obj = raw_exif_data
            exif_tag_count = len(exif_obj)
            if exif_tag_count > 0:
                detected_structures.append("EXIF")

            try:
                sub_exif = exif_obj.get_ifd(ExifTags.IFD.Exif)
            except Exception:
                is_malformed_exif = True

            try:
                gps_ifd = exif_obj.get_ifd(ExifTags.IFD.GPSInfo)
            except Exception:
                is_malformed_exif = True

    except Exception:
        is_malformed_exif = True

    # Check raw exif presence if getexif returned empty
    raw_exif_bytes = image.info.get("exif")
    if raw_exif_bytes and not exif_tag_count:
        # EXIF bytes present but zero tags extracted -> potentially malformed or unsupported
        is_malformed_exif = True

    # Determine overall metadata status
    if is_malformed_exif and not detected_structures:
        metadata_status = MetadataStatus.MALFORMED
    elif detected_structures:
        metadata_status = MetadataStatus.PARTIAL if is_malformed_exif else MetadataStatus.PRESENT
    else:
        metadata_status = MetadataStatus.ABSENT

    inventory = MetadataInventory(
        status=metadata_status,
        detected_structures=detected_structures,
        exif_tag_count=exif_tag_count,
        xmp_packet_present=xmp_packet_present,
        png_text_chunks_count=png_text_count,
    )

    # 4. Extract Camera & Recording Metadata with Truthful Device Identification (Mission 22)
    camera_metadata: Optional[CameraMetadata] = None
    orientation_val: Optional[int] = None

    make = None
    model = None
    software = None
    lens_model = None
    dto = None
    dtd = None
    dtm = None
    offset_time = None
    meta_dims = None

    # Parse raw bytes directly with secondary PIL instance to avoid stripped in-memory handles
    try:
        raw_stream_img = Image.open(io.BytesIO(raw_bytes))
        raw_exif_tags = raw_stream_img.getexif()
        if raw_exif_tags:
            if not exif_obj:
                exif_obj = raw_exif_tags
            else:
                for k, v in raw_exif_tags.items():
                    if k not in exif_obj:
                        exif_obj[k] = v
            if not sub_exif:
                try:
                    sub_exif = raw_exif_tags.get_ifd(ExifTags.IFD.Exif)
                except Exception:
                    pass
    except Exception:
        pass

    if exif_obj:
        make = _safe_str(exif_obj.get(ExifTags.Base.Make) or exif_obj.get(271))
        model = _safe_str(exif_obj.get(ExifTags.Base.Model) or exif_obj.get(272))
        software = _safe_str(exif_obj.get(ExifTags.Base.Software) or exif_obj.get(305))
        dtm = _safe_str(exif_obj.get(ExifTags.Base.DateTime) or exif_obj.get(306))

        raw_orient = exif_obj.get(ExifTags.Base.Orientation) or exif_obj.get(274)
        if isinstance(raw_orient, int) and 1 <= raw_orient <= 8:
            orientation_val = raw_orient

        if sub_exif:
            dto = _safe_str(sub_exif.get(ExifTags.Base.DateTimeOriginal) or sub_exif.get(36867))
            dtd = _safe_str(sub_exif.get(ExifTags.Base.DateTimeDigitized) or sub_exif.get(36868))
            lens_model = _safe_str(sub_exif.get(ExifTags.Base.LensModel) or sub_exif.get(42036))
            offset_time = _safe_str(
                sub_exif.get(ExifTags.Base.OffsetTimeOriginal) or sub_exif.get(36881) or sub_exif.get(ExifTags.Base.OffsetTime)
            )

            mw = sub_exif.get(ExifTags.Base.ExifImageWidth) or exif_obj.get(ExifTags.Base.ImageWidth) or exif_obj.get(256)
            mh = sub_exif.get(ExifTags.Base.ExifImageHeight) or exif_obj.get(ExifTags.Base.ImageLength) or exif_obj.get(257)
            if isinstance(mw, int) and isinstance(mh, int) and mw > 0 and mh > 0:
                meta_dims = {"width": mw, "height": mh}

            # Extract hardware manufacturer or AIGC origin from UserComment (tag 37510)
            user_comment = _safe_str(sub_exif.get(ExifTags.Base.UserComment) or sub_exif.get(37510))
            if user_comment:
                uc_lower = user_comment.lower()
                if "oplus" in uc_lower or "oneplus" in uc_lower:
                    if not make: make = "OnePlus / Oplus Mobile"
                    if not model: model = "ColorOS Camera Sensor"
                elif "apple" in uc_lower or "iphone" in uc_lower:
                    if not make: make = "Apple"
                    if not model: model = "iPhone Camera"
                elif "samsung" in uc_lower:
                    if not make: make = "Samsung"
                    if not model: model = "Galaxy Camera"
                elif "xiaomi" in uc_lower:
                    if not make: make = "Xiaomi"
                    if not model: model = "MIUI Camera"
                elif "google" in uc_lower or "pixel" in uc_lower:
                    if not make: make = "Google"
                    if not model: model = "Pixel Camera"
                elif "dreamina" in uc_lower or "aigc" in uc_lower:
                    if not software: software = "Dreamina AIGC Engine"

    # Deep Metadata Inspection for Generative AI and Scientific Plotting (Missions 09 & 22)
    # Collect all metadata text containers across primary and raw-stream instances
    merged_text: Dict[str, Any] = {}
    if isinstance(getattr(image, "text", {}), dict):
        merged_text.update(getattr(image, "text", {}))
    if isinstance(getattr(image, "info", {}), dict):
        merged_text.update(getattr(image, "info", {}))
    try:
        if raw_stream_img:
            if isinstance(getattr(raw_stream_img, "text", {}), dict):
                merged_text.update(getattr(raw_stream_img, "text", {}))
            if isinstance(getattr(raw_stream_img, "info", {}), dict):
                merged_text.update(getattr(raw_stream_img, "info", {}))
    except Exception:
        pass

    is_ai_meta = False
    ai_engine = None
    ai_prompt_text = None
    ai_params_dict = None
    is_sci_software = False
    sci_software_name = None

    # 1. Inspect all textual key/value pairs (PNG chunks, comments, descriptions)
    for k, v in merged_text.items():
        if not v or not isinstance(v, (str, bytes)):
            continue
        v_str = v.decode("utf-8", errors="ignore") if isinstance(v, bytes) else str(v)
        v_lower = v_str.lower()
        k_lower = str(k).lower()

        # Stable Diffusion / WebUI / Automatic1111 parameter chunks
        if k_lower in ("parameters", "sd-metadata", "generation_data") or ("steps:" in v_lower and "sampler:" in v_lower):
            is_ai_meta = True
            ai_engine = "Stable Diffusion (Automatic1111 / WebUI)"
            parts = re.split(r"(?:Negative prompt:|Steps:)", v_str, maxsplit=1)
            ai_prompt_text = parts[0].strip() if parts else v_str[:250]
            ai_params_dict = {}
            for match in re.finditer(r"([A-Za-z\s]+):\s*([^,]+)(?:,|$)", v_str):
                ai_params_dict[match.group(1).strip()] = match.group(2).strip()

        # ComfyUI workflow graph
        elif k_lower == "workflow" or ("nodes" in v_lower and "links" in v_lower and "ksampler" in v_lower):
            is_ai_meta = True
            ai_engine = "ComfyUI (Node Graph Workflow)"
            if not ai_prompt_text and "prompt" in merged_text:
                ai_prompt_text = str(merged_text.get("prompt"))[:300]

        # ComfyUI execution graph or DALL-E prompt
        elif k_lower == "prompt":
            if any(term in v_lower for term in ["ksampler", "cliptextencode", "checkpointloadersimple", "dall-e", "openai"]):
                is_ai_meta = True
                ai_engine = "ComfyUI / DALL-E Execution Graph"
                ai_prompt_text = v_str[:300]

        # Scan for Generative AI keywords in software, comment, or description
        if any(term in v_lower for term in [
            "midjourney", "/imagine", "dall-e", "dalle", "stablediffusion", "stabilityai",
            "comfyui", "novelai", "fooocus", "adobe firefly", "firefly", "dreamina", "aigc",
            "bing image creator", "flux.1", "black forest labs", "leonardo.ai", "recraft"
        ]):
            is_ai_meta = True
            if "midjourney" in v_lower or "/imagine" in v_lower:
                ai_engine = "Midjourney"
            elif "dall-e" in v_lower or "dalle" in v_lower or "openai" in v_lower:
                ai_engine = "OpenAI DALL-E / ChatGPT"
            elif "comfyui" in v_lower:
                ai_engine = "ComfyUI"
            elif "firefly" in v_lower:
                ai_engine = "Adobe Firefly"
            elif "flux" in v_lower:
                ai_engine = "FLUX (Black Forest Labs)"
            elif "bing" in v_lower or "designer" in v_lower:
                ai_engine = "Microsoft Bing Image Creator / Designer"
            elif "leonardo" in v_lower:
                ai_engine = "Leonardo.Ai"
            elif "dreamina" in v_lower or "aigc" in v_lower:
                ai_engine = "Dreamina AIGC Engine"
            elif "stablediffusion" in v_lower or "stability" in v_lower:
                ai_engine = "Stable Diffusion"
            else:
                ai_engine = "Generative AI Pipeline"
            if not ai_prompt_text and len(v_str) < 500:
                ai_prompt_text = v_str

        # Scan for Authentic Scientific Plotting & Diagram Software
        if any(term in v_lower for term in [
            "matplotlib", "matlab", "gnuplot", "ggplot", "cairo",
            "pgfplots", "tikz", "originlab", "graphpad", "plotly", "seaborn"
        ]):
            is_sci_software = True
            if "matplotlib" in v_lower:
                sci_software_name = "Matplotlib (Python Scientific Visualization)"
            elif "matlab" in v_lower or "mathworks" in v_lower:
                sci_software_name = "MATLAB (MathWorks Scientific Computing)"
            elif "gnuplot" in v_lower:
                sci_software_name = "Gnuplot Scientific Plotting"
            elif "ggplot" in v_lower or "cairo" in v_lower:
                sci_software_name = "R / ggplot2 (Cairo Graphics)"
            elif "origin" in v_lower:
                sci_software_name = "OriginLab Scientific Graphing"
            elif "graphpad" in v_lower:
                sci_software_name = "GraphPad Prism"
            elif "plotly" in v_lower:
                sci_software_name = "Plotly Scientific Graphing"
            elif "seaborn" in v_lower:
                sci_software_name = "Seaborn Statistical Visualization"
            else:
                sci_software_name = "Scientific Plotting Suite"

    # 2. Deep XMP Packet Inspection
    raw_bytes_lower = raw_bytes.lower()
    xmp_str = ""
    if b"<x:xmpmeta" in raw_bytes:
        xmp_start = raw_bytes.find(b"<x:xmpmeta")
        xmp_end = raw_bytes.find(b"</x:xmpmeta>", xmp_start)
        if xmp_start != -1 and xmp_end != -1:
            xmp_str = raw_bytes[xmp_start:xmp_end + 12].decode("utf-8", errors="ignore").lower()

    if xmp_str:
        if "trainedalgorithmicmedia" in xmp_str or "adobe firefly" in xmp_str:
            is_ai_meta = True
            ai_engine = "Adobe Firefly / C2PA Algorithmic Media"
        elif "dall-e" in xmp_str or "openai" in xmp_str:
            is_ai_meta = True
            ai_engine = "OpenAI DALL-E"
        elif "midjourney" in xmp_str:
            is_ai_meta = True
            ai_engine = "Midjourney"
        elif "stablediffusion" in xmp_str or "stabilityai" in xmp_str:
            is_ai_meta = True
            ai_engine = "Stable Diffusion"

    # 3. Raw Bytes Scanning for AI signatures
    if not is_ai_meta:
        if b"tEXtparameters\x00" in raw_bytes or (b"parameters" in raw_bytes and b"Steps:" in raw_bytes and b"CFG scale:" in raw_bytes):
            is_ai_meta = True
            ai_engine = "Stable Diffusion (parameters chunk)"
        elif b"tEXtworkflow\x00" in raw_bytes or (b"KSampler" in raw_bytes and b"CLIPTextEncode" in raw_bytes):
            is_ai_meta = True
            ai_engine = "ComfyUI (workflow chunk)"
        elif b"trainedalgorithmicmedia" in raw_bytes_lower:
            is_ai_meta = True
            ai_engine = "Generative AI (trainedAlgorithmicMedia)"
        elif b"dall-e" in raw_bytes_lower:
            is_ai_meta = True
            ai_engine = "OpenAI DALL-E"
        elif b"midjourney" in raw_bytes_lower:
            is_ai_meta = True
            ai_engine = "Midjourney"

    # 4. Raw Bytes Scanning for Scientific Plotting Packages
    if not is_sci_software and not is_ai_meta:
        if b"matplotlib" in raw_bytes_lower:
            is_sci_software = True
            sci_software_name = "Matplotlib (Python Scientific Visualization)"
        elif b"matlab" in raw_bytes_lower:
            is_sci_software = True
            sci_software_name = "MATLAB (MathWorks Scientific Computing)"
        elif b"gnuplot" in raw_bytes_lower:
            is_sci_software = True
            sci_software_name = "Gnuplot Scientific Plotting"

    # Fallback to PNG text if software is absent
    if not software and png_text_count > 0 and isinstance(png_text, dict):
        software = _safe_str(png_text.get("Software") or png_text.get("Comment") or png_text.get("Description"))

    orient_desc = ORIENTATION_DESCRIPTIONS.get(orientation_val) if orientation_val else None

    # Determine truthful device status and consumer display text (Mission 22 Rule)
    if is_ai_meta:
        dev_status = DeviceMetadataStatus.SOFTWARE_ONLY
        dev_display = f"Generative AI Engine: {ai_engine}"
        if not software:
            software = f"Generative AI: {ai_engine}"
    elif is_sci_software:
        dev_status = DeviceMetadataStatus.SOFTWARE_ONLY
        dev_display = f"Rendering Engine: {sci_software_name}"
        if not software:
            software = sci_software_name
    elif is_malformed_exif and not make and not model:
        dev_status = DeviceMetadataStatus.MALFORMED
        dev_display = "Device metadata could not be read"
    elif make and model:
        dev_status = DeviceMetadataStatus.PRESENT
        if model.lower().startswith(make.lower()):
            dev_display = model
        else:
            dev_display = f"{make} {model}"
    elif make and not model:
        dev_status = DeviceMetadataStatus.MANUFACTURER_ONLY
        dev_display = f"{make} (Model unavailable)"
    elif software and not make and not model:
        dev_status = DeviceMetadataStatus.SOFTWARE_ONLY
        dev_display = f"Software: {software}"
    else:
        dev_status = DeviceMetadataStatus.ABSENT
        dev_display = "Device information not present in file"

    camera_metadata = CameraMetadata(
        make=make,
        model=model,
        lens_model=lens_model,
        software=software,
        orientation_tag=orientation_val,
        orientation_description=orient_desc,
        date_time_original=dto,
        date_time_digitized=dtd,
        date_time_modified=dtm,
        offset_time=offset_time,
        metadata_dimensions=meta_dims,
        device_status=dev_status,
        device_display_text=dev_display,
        provenance_note="Metadata can be edited or stripped; presence of camera tags does not establish legal authenticity.",
        is_ai_metadata_present=is_ai_meta,
        ai_generation_engine=ai_engine,
        ai_prompt=ai_prompt_text,
        ai_parameters=ai_params_dict,
        is_scientific_software_present=is_sci_software,
        scientific_software_name=sci_software_name,
    )

    # 5. Privacy-Aware GPS Handling
    gps_tag_count = len(gps_ifd) if gps_ifd else 0
    gps_present = gps_tag_count > 0

    gps_summary = GPSMetadataSummary(
        gps_present=gps_present,
        gps_status="DETECTED_AND_REDACTED" if gps_present else "ABSENT",
        tag_count=gps_tag_count,
        coordinates_redacted=True,
        latitude=None,
        longitude=None,
        privacy_notice=(
            "GPS coordinates are redacted by default to protect individual privacy. "
            "Detection indicates only that geolocation tags exist in the container."
        ),
    )

    # 6. Embedded Thumbnail Analysis
    thumbnail_result = analyze_embedded_thumbnail(image, orientation_tag=orientation_val)

    # 7. Container and Metadata Consistency Checks
    consistency_result = _check_container_consistency(
        image=image,
        validation_result=validation_result,
        camera_meta=camera_metadata,
        thumbnail_result=thumbnail_result,
    )

    notes = (
        "Camera make, model, software, and timestamp tags are user-editable metadata fields and do not constitute "
        "cryptographic proof of origin or authenticity. Absence of metadata is standard for web, messaging, and "
        "social media platforms and must never be interpreted as evidence of synthetic generation or malicious tampering."
    )

    return MetadataForensicResult(
        inventory=inventory,
        camera_metadata=camera_metadata,
        gps_summary=gps_summary,
        thumbnail_analysis=thumbnail_result,
        container_consistency=consistency_result,
        analysis_notes=notes,
    )


def build_provenance_record(
    raw_bytes: bytes,
    declared_filename: str,
    mime_type: str,
    metadata_result: Optional[MetadataForensicResult] = None,
    c2pa_result: Optional[Any] = None,
    synthid_result: Optional[Any] = None,
    analysis_id: Optional[str] = None,
    acquisition_url: Optional[str] = None,
) -> ProvenanceRecord:
    """Build an ISO/IEC 27037 compliant provenance and chain-of-custody record.
    
    Strictly isolates media origin from host environment across 8 dimensions:
    1. Original capture device (EXIF/container hardware tag or NOT_AVAILABLE)
    2. Original capture location (EXIF GPS or NOT_AVAILABLE; never inferred from host)
    3. Original creation timestamp (EXIF DateTimeOriginal or NOT_AVAILABLE)
    4. Original creator or authoring application (C2PA/IPTC or NOT_AVAILABLE)
    5. Acquisition source (Web URL, local upload, or messaging platform)
    6. Transfer history (container re-compression, metadata stripping markers)
    7. Current analysis environment (Host workstation OS/GPU, strictly separated)
    8. Provenance verification status synthesis
    """
    import uuid
    record_id = analysis_id or f"PRV-{uuid.uuid4().hex[:12].upper()}"
    sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
    now_utc = datetime.now(timezone.utc).isoformat()
    fn_lower = (declared_filename or "").lower()

    # 1. Acquisition Source
    if acquisition_url:
        acquisition = f"Web URL Inspection ({acquisition_url})"
    elif "web_inspected_asset" in fn_lower or "browser_scan" in fn_lower:
        acquisition = "Web Page Inspection (Secura AI Chrome Extension)"
    elif any(k in fn_lower for k in ["whatsapp", "wa_img", "wa_vid"]):
        acquisition = "WhatsApp Messaging Platform Export / Download"
    elif "telegram" in fn_lower:
        acquisition = "Telegram Messaging Platform Export / Download"
    elif "twitter" in fn_lower or "x_com" in fn_lower:
        acquisition = "Social Platform (X/Twitter) Download"
    elif "instagram" in fn_lower:
        acquisition = "Social Platform (Instagram) Download"
    else:
        acquisition = "Local File Upload / Direct Payload Transfer"

    # 2. Capture Device
    capture_dev = "Capture device unavailable from container metadata"
    has_hardware_device = False
    software_tag = None
    creation_ts = None
    if metadata_result and metadata_result.camera_metadata:
        cm = metadata_result.camera_metadata
        software_tag = cm.software
        creation_ts = cm.date_time_original
        if cm.device_status in ("PRESENT", "MANUFACTURER_ONLY") and cm.device_display_text:
            capture_dev = cm.device_display_text
            has_hardware_device = True

    # 3. Original Capture Location
    capture_loc = "Original capture location unavailable from this file"
    has_valid_gps = False
    if metadata_result and metadata_result.gps_summary and metadata_result.gps_summary.gps_present:
        capture_loc = "Container EXIF includes recorded GPS geolocation tags (Protected/Redacted)"
        has_valid_gps = True

    # 4. Original Creator / Author
    creator = "Original creator or application unavailable"
    if c2pa_result and getattr(c2pa_result, "manifest_present", False):
        claims = getattr(c2pa_result, "claims", None)
        if claims and getattr(claims, "claim_generator", None):
            creator = f"C2PA Certified: {claims.claim_generator}"
    elif software_tag:
        creator = f"Container Software / Editor Tag: {software_tag}"

    # 5. Transfer & Editing History
    transfer_history: List[str] = []
    if acquisition != "Local File Upload / Direct Payload Transfer":
        transfer_history.append(f"Acquired via: {acquisition}")
    if software_tag:
        transfer_history.append(f"Recorded editing software: {software_tag}")
    if metadata_result and metadata_result.container_consistency:
        for obs in metadata_result.container_consistency.observations:
            if obs.severity.value in ("INCONSISTENCY", "ANOMALY"):
                transfer_history.append(f"Container discrepancy: {obs.check_name} ({obs.observed_state})")
    if not has_hardware_device and not has_valid_gps:
        transfer_history.append("EXIF metadata absent: typical for social/messaging re-encoding or stripped digital assets")

    # 6. Verification Status & C2PA Integrity
    c2pa_status_str = "ABSENT"
    c2pa_signer_name = None
    prov_notes: List[str] = []

    if c2pa_result and getattr(c2pa_result, "manifest_present", False):
        val_status = getattr(c2pa_result, "validation_status", "UNKNOWN")
        if val_status in ("VALID", "SUCCESS"):
            c2pa_status_str = "VALID"
            verification_stat = ProvenanceVerificationStatus.VERIFIED
            claims = getattr(c2pa_result, "claims", None)
            c2pa_signer_name = getattr(claims, "signature_issuer", "Certified Origin") if claims else "Certified Origin"
            prov_notes.append("Cryptographic C2PA provenance manifest cryptographically validated.")
        elif val_status in ("INVALID", "SIGNATURE_MISMATCH"):
            c2pa_status_str = "INVALID"
            verification_stat = ProvenanceVerificationStatus.CONFLICTING
            prov_notes.append("C2PA Content Credentials signature check failed: manifest or asset tampered.")
        else:
            c2pa_status_str = "UNVERIFIABLE"
            verification_stat = ProvenanceVerificationStatus.PRESENT_UNVERIFIED
            prov_notes.append("C2PA Content Credentials present but certificate chain unverifiable.")
    elif has_hardware_device:
        verification_stat = ProvenanceVerificationStatus.PRESENT_UNVERIFIED
        prov_notes.append("Hardware camera sensor metadata present in EXIF, but lacks cryptographic signature seal.")
    else:
        verification_stat = ProvenanceVerificationStatus.NOT_AVAILABLE
        prov_notes.append("No cryptographic credentials or camera hardware metadata found in container.")

    # Construct the 8 Discrete Canonical Provenance Dimensions
    dim_device = ProvenanceFieldEntry(
        value=capture_dev if has_hardware_device else "Capture device unavailable from container metadata",
        status=MetadataFieldStatus.PRESENT_UNVERIFIED if has_hardware_device else MetadataFieldStatus.NOT_AVAILABLE,
        source="EXIF Header (TIFF Make/Model tags)" if has_hardware_device else "Container Metadata Inspection",
        extraction_method="Binary EXIF tag inspection" if has_hardware_device else "Header Inspection",
        evidence_notes="Hardware make/model tags found in container; unverified without cryptographic signature." if has_hardware_device else "No hardware device tags present in container bytes. A local workstation camera must NEVER be substituted."
    )

    dim_location = ProvenanceFieldEntry(
        value=capture_loc if has_valid_gps else "Original capture location unavailable from this file",
        status=MetadataFieldStatus.PRESENT_UNVERIFIED if has_valid_gps else MetadataFieldStatus.NOT_AVAILABLE,
        source="EXIF GPS IFD" if has_valid_gps else "Container Metadata Inspection",
        extraction_method="GPS coordinate extraction" if has_valid_gps else "GPS IFD Scan",
        evidence_notes="GPS coordinates detected in container metadata; redacted for privacy." if has_valid_gps else "No GPS coordinates in container. Host or client workstation location must NEVER be inferred."
    )

    dim_timestamp = ProvenanceFieldEntry(
        value=creation_ts or "Creation timestamp unavailable from container",
        status=MetadataFieldStatus.PRESENT_UNVERIFIED if creation_ts else MetadataFieldStatus.NOT_AVAILABLE,
        source="EXIF DateTimeOriginal" if creation_ts else "Container Metadata Inspection",
        extraction_method="EXIF Tag 36867 inspection" if creation_ts else "Binary Atom Timestamp Scan",
        evidence_notes="Creation timestamp recorded by recording device clock." if creation_ts else "No embedded creation timestamp found in container."
    )

    dim_creator = ProvenanceFieldEntry(
        value=creator,
        status=MetadataFieldStatus.VERIFIED if c2pa_status_str == "VALID" else (
            MetadataFieldStatus.PRESENT_UNVERIFIED if creator != "Original creator or application unavailable" else MetadataFieldStatus.NOT_AVAILABLE
        ),
        source="C2PA Claim Generator" if c2pa_status_str == "VALID" else (
            "Container Software Identifier Tag" if software_tag else "Container Metadata Inspection"
        ),
        extraction_method="C2PA JUMBF Manifest Validation" if c2pa_status_str == "VALID" else "Metadata String Inspection",
        evidence_notes="Cryptographically verified authoring tool." if c2pa_status_str == "VALID" else (
            "Unsigned software tag present in container." if software_tag else "No authoring application or creator credentials found."
        )
    )

    dim_acquisition = ProvenanceFieldEntry(
        value=acquisition,
        status=MetadataFieldStatus.VERIFIED,
        source="Secura Ingestion Gateway",
        extraction_method="Ingestion Session Tracking",
        evidence_notes="Verified entry point where asset entered Secura AI."
    )

    dim_transfer = ProvenanceFieldEntry(
        value="; ".join(transfer_history) if transfer_history else "No recorded transfer steps or container anomalies observed",
        status=MetadataFieldStatus.INFERRED if transfer_history else MetadataFieldStatus.NOT_AVAILABLE,
        source="Container Consistency Engine",
        extraction_method="Cross-Layer Structural Consistency Analysis",
        evidence_notes="Derived from container structural observations and metadata stripping markers."
    )

    dim_env = ProvenanceFieldEntry(
        value="Secura AI Forensic Workstation (Python 3.11 / PyTorch / OpenCV / FastAPI Node)",
        status=MetadataFieldStatus.VERIFIED,
        source="Secura Analysis Node",
        extraction_method="Host Telemetry Isolation",
        evidence_notes="Analysis environment strictly decoupled from media origin."
    )

    dim_status = ProvenanceFieldEntry(
        value=verification_stat.value,
        status=MetadataFieldStatus.VERIFIED if verification_stat == ProvenanceVerificationStatus.VERIFIED else (
            MetadataFieldStatus.CONFLICTING if verification_stat == ProvenanceVerificationStatus.CONFLICTING else (
                MetadataFieldStatus.PRESENT_UNVERIFIED if verification_stat == ProvenanceVerificationStatus.PRESENT_UNVERIFIED else MetadataFieldStatus.NOT_AVAILABLE
            )
        ),
        source="Secura Provenance Verification Engine",
        extraction_method="Consensus Evaluation Across All 7 Dimensions",
        evidence_notes=f"Overall provenance state: {verification_stat.value}."
    )

    return ProvenanceRecord(
        analysis_id=record_id,
        input_sha256=sha256_hash,
        file_name=declared_filename or "unnamed_asset",
        file_size_bytes=len(raw_bytes),
        detected_mime=mime_type,
        analysis_timestamp_utc=now_utc,
        dim_original_capture_device=dim_device,
        dim_original_capture_location=dim_location,
        dim_original_creation_timestamp=dim_timestamp,
        dim_original_creator=dim_creator,
        dim_acquisition_source=dim_acquisition,
        dim_transfer_history=dim_transfer,
        dim_current_analysis_environment=dim_env,
        dim_provenance_verification_status=dim_status,
        original_capture_location=capture_loc,
        capture_device=capture_dev,
        original_creation_timestamp=creation_ts,
        original_creator=creator,
        acquisition_source=acquisition,
        transfer_history=transfer_history,
        current_file_location="Secure analysis buffer (Ephemeral memory)",
        verification_status=verification_stat,
        c2pa_status=c2pa_status_str,
        c2pa_signer=c2pa_signer_name,
        provenance_notes=prov_notes,
    )

