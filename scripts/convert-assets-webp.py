from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SOURCE_SUFFIXES = {".ts", ".tsx", ".css", ".json", ".md"}


def convert(source: Path):
    destination = source.with_suffix(".webp")
    with Image.open(source) as image:
        image.seek(0)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        image.save(destination, "WEBP", quality=84, method=6, alpha_quality=92)
    source.unlink()
    return source.stat().st_size if source.exists() else destination.stat().st_size


images = [path for path in PUBLIC.rglob("*") if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg"}]
with ThreadPoolExecutor(max_workers=8) as executor:
    list(executor.map(convert, images))

for path in [*ROOT.joinpath("app").rglob("*"), *ROOT.joinpath("public").rglob("*"), ROOT / "README.md"]:
    if not path.is_file() or path.suffix.lower() not in SOURCE_SUFFIXES:
        continue
    text = path.read_text(encoding="utf-8-sig")
    updated = text.replace(".png", ".webp").replace(".jpeg", ".webp").replace(".jpg", ".webp")
    if updated != text:
        path.write_text(updated, encoding="utf-8")

print(f"converted={len(images)}")
