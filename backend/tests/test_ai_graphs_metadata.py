import io
import pytest
from PIL import Image, PngImagePlugin

from app.schemas.evidence import ImageFormat, ImageValidationResult
from app.services.metadata_inspector import inspect_metadata
from app.services.image_validation import validate_image_payload


def test_stable_diffusion_parameters_metadata():
    img = Image.new("RGB", (150, 150), (255, 255, 255))
    info = PngImagePlugin.PngInfo()
    info.add_text("parameters", "a bar chart showing deep learning training progress\nSteps: 30, Sampler: DPM++ 2M Karras, CFG scale: 7, Seed: 12345678")

    buf = io.BytesIO()
    img.save(buf, format="PNG", pnginfo=info)
    raw_bytes = buf.getvalue()

    val_res, loaded = validate_image_payload(raw_bytes, "ai_chart.png")
    res = inspect_metadata(loaded, raw_bytes, val_res)

    assert res.camera_metadata is not None
    assert res.camera_metadata.is_ai_metadata_present is True
    assert "Stable Diffusion" in res.camera_metadata.ai_generation_engine
    assert "bar chart" in (res.camera_metadata.ai_prompt or "")
    assert res.camera_metadata.ai_parameters is not None
    assert "Sampler" in res.camera_metadata.ai_parameters


def test_comfyui_workflow_metadata():
    img = Image.new("RGB", (150, 150), (255, 255, 255))
    info = PngImagePlugin.PngInfo()
    info.add_text("workflow", '{"nodes": [{"type": "KSampler"}, {"type": "CLIPTextEncode"}], "links": []}')

    buf = io.BytesIO()
    img.save(buf, format="PNG", pnginfo=info)
    raw_bytes = buf.getvalue()

    val_res, loaded = validate_image_payload(raw_bytes, "comfy_plot.png")
    res = inspect_metadata(loaded, raw_bytes, val_res)

    assert res.camera_metadata is not None
    assert res.camera_metadata.is_ai_metadata_present is True
    assert "ComfyUI" in res.camera_metadata.ai_generation_engine


def test_matplotlib_software_metadata():
    img = Image.new("RGB", (150, 150), (255, 255, 255))
    info = PngImagePlugin.PngInfo()
    info.add_text("Software", "Matplotlib version 3.8.2, https://matplotlib.org/")

    buf = io.BytesIO()
    img.save(buf, format="PNG", pnginfo=info)
    raw_bytes = buf.getvalue()

    val_res, loaded = validate_image_payload(raw_bytes, "matplotlib_plot.png")
    res = inspect_metadata(loaded, raw_bytes, val_res)

    assert res.camera_metadata is not None
    assert res.camera_metadata.is_ai_metadata_present is False
    assert res.camera_metadata.is_scientific_software_present is True
    assert "Matplotlib" in res.camera_metadata.scientific_software_name


def test_dalle_xmp_metadata():
    img = Image.new("RGB", (150, 150), (255, 255, 255))
    info = PngImagePlugin.PngInfo()
    info.add_text("XML:com.adobe.xmp", "<x:xmpmeta xmlns:x='adobe:ns:meta/'><rdf:RDF><rdf:Description><photoshop:Credit>OpenAI DALL-E 3</photoshop:Credit></rdf:Description></rdf:RDF></x:xmpmeta>")

    buf = io.BytesIO()
    img.save(buf, format="PNG", pnginfo=info)
    raw = buf.getvalue()

    val_res, loaded = validate_image_payload(raw, "dalle_graph.png")
    res = inspect_metadata(loaded, raw, val_res)

    assert res.camera_metadata is not None
    assert res.camera_metadata.is_ai_metadata_present is True
    assert "DALL-E" in res.camera_metadata.ai_generation_engine
