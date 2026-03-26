from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from datetime import datetime
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
OUT = ROOT / f"gpt-handover-{datetime.now():%Y%m%d-%H%M}.zip"

EXCLUDE_DIRS = {
    ".git", ".godot", "node_modules", ".idea", ".vscode",
    "dist", "build", "coverage", "export"
}

EXCLUDE_NAMES = {
    ".DS_Store", "Thumbs.db"
}

EXCLUDE_SUFFIXES = {
    ".tmp", ".log"
}

# For AI-only handover these are usually unnecessary.
# If you want a more runnable slim project, remove ".uid" and ".import" from this set.
EXCLUDE_ENDINGS = (
    ".uid",
    ".import",
)

ALWAYS_INCLUDE = {
    "README.md",
    "CHANGELOG.md",
    "client/project.godot",
    "client/export_presets.cfg",
    "server/package.json",
    "server/package-lock.json",
    "server/tsconfig.json",
    "docs/Cozy_Chaos_City_Handover_Prompt.md",
    "docs/TECHNICAL_SUMMARY_FOR_GPT_ASSISTANT.md",
}

INCLUDE_PREFIXES = (
    "docs/",
    "client/scripts/",
    "client/scenes/",
    "client/shaders/",
    "client/assets/",
    "client/sound/",
    "server/src/",
    "server/data/",
)

INCLUDE_EXTS = {
    ".gd", ".tscn", ".tres", ".gdshader", ".shader",
    ".png", ".jpg", ".jpeg", ".webp", ".svg",
    ".glb", ".gltf", ".obj", ".mtl",
    ".ogg", ".wav", ".mp3",
    ".json", ".ts", ".js", ".mjs", ".cjs",
    ".md", ".txt", ".cfg", ".ini", ".yml", ".yaml", ".toml"
}

def should_keep(rel_path: Path) -> bool:
    rel = rel_path.as_posix()

    if any(part in EXCLUDE_DIRS for part in rel_path.parts):
        return False

    if rel_path.name in EXCLUDE_NAMES:
        return False

    if rel_path.suffix.lower() in EXCLUDE_SUFFIXES:
        return False

    if rel.endswith(EXCLUDE_ENDINGS):
        return False

    if rel in ALWAYS_INCLUDE:
        return True

    if any(rel.startswith(prefix) for prefix in INCLUDE_PREFIXES):
        return True

    if rel_path.suffix.lower() in INCLUDE_EXTS:
        return True

    return False

files = [
    p for p in ROOT.rglob("*")
    if p.is_file() and should_keep(p.relative_to(ROOT))
]

with ZipFile(OUT, "w", compression=ZIP_DEFLATED, compresslevel=9) as zf:
    summary = [
        "GPT handover bundle",
        f"Project: {ROOT.name}",
        f"Generated: {datetime.now().isoformat()}",
        "",
        "Included files:",
    ]

    for file_path in files:
        rel = file_path.relative_to(ROOT)
        zf.write(file_path, rel.as_posix())
        summary.append(rel.as_posix())

    zf.writestr("HANDOVER_SUMMARY.txt", "\n".join(summary))

print(f"Created: {OUT}")
print(f"Included files: {len(files)}")