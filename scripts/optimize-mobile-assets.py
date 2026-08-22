from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public"


def max_dimension(path: Path):
    value = path.as_posix()
    if any(part in value for part in ("/items/", "/equipment/", "/treasures/", "/spells/", "/partners/", "/chests/")):
        return 256
    if any(part in value for part in ("/cha-pics/", "/characters/", "/commission-npcs/")):
        return 640
    if "/heroes/" in value or "/atlas/" in value:
        return None
    return 1280


def optimize(path: Path):
    with Image.open(path) as source:
        image = source.convert("RGBA" if source.mode in ("RGBA", "LA") or "transparency" in source.info else "RGB")
        limit = max_dimension(path)
        if limit and max(image.size) > limit:
            ratio = limit / max(image.size)
            image = image.resize((max(1, round(image.width * ratio)), max(1, round(image.height * ratio))), Image.Resampling.LANCZOS)
        temporary = path.with_suffix(".mobile.webp")
        image.save(temporary, "WEBP", quality=68, method=6, alpha_quality=86)
    temporary.replace(path)


images = list(ROOT.rglob("*.webp"))
with ThreadPoolExecutor(max_workers=8) as executor:
    list(executor.map(optimize, images))
print(f"optimized={len(images)}")
