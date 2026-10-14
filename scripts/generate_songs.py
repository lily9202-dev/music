#!/usr/bin/env python3
"""Generate the player's songs.json using only the Python standard library.

By default this writes songs.json in the project root for local Live Server
testing. Use --site-dir _site in CI to create a whitelisted Pages artifact in
a dedicated empty directory without modifying the checked-in songs.json.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import posixpath
import shutil
import sys
import tempfile
from pathlib import Path, PurePosixPath
from urllib.parse import quote, unquote, urlsplit


AUDIO_EXTENSIONS = {".mp3", ".m4a"}
COVER_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
CORE_FILES = (
    "index.html",
    "style.css",
    "app.js",
    "sw.js",
    "manifest.webmanifest",
)
ICON_FILES = (
    "app-icon.svg",
    "app-icon-180.png",
    "app-icon-192.png",
    "app-icon-512.png",
)


def normalized_site_path(value: object) -> str | None:
    """Return a safe, decoded project-relative path from an existing URL path."""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = urlsplit(value.strip())
        if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
            return None
        decoded = unquote(parsed.path, errors="strict")
    except (UnicodeDecodeError, ValueError):
        return None

    if not decoded or decoded.startswith(("/", "\\")) or "\\" in decoded:
        return None
    normalized = posixpath.normpath(decoded)
    if normalized in (".", "..") or normalized.startswith("../"):
        return None
    return normalized


def audio_path_from_entry(entry: object) -> str | None:
    if not isinstance(entry, dict):
        return None
    path = normalized_site_path(entry.get("audioUrl"))
    if not path or not path.startswith("audio/"):
        return None
    if PurePosixPath(path).suffix.lower() not in AUDIO_EXTENSIONS:
        return None
    return path


def is_safe_file(root: Path, path: Path) -> bool:
    """Reject symlinks and files whose resolved location escapes the project."""
    if path.is_symlink() or not path.is_file():
        return False
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


def scan_audio(root: Path) -> list[tuple[str, Path]]:
    audio_root = root / "audio"
    if not audio_root.is_dir():
        return []

    discovered: list[tuple[str, Path]] = []
    for path in audio_root.rglob("*"):
        if any(part.startswith(".") for part in path.relative_to(audio_root).parts):
            continue
        if path.suffix.lower() not in AUDIO_EXTENSIONS or not is_safe_file(root, path):
            continue
        relative_path = path.relative_to(root).as_posix()
        discovered.append((relative_path, path))

    return sorted(discovered, key=lambda item: (item[0].casefold(), item[0]))


def scan_covers(root: Path) -> dict[str, list[tuple[str, Path]]]:
    covers_root = root / "covers"
    choices: dict[str, list[tuple[str, Path]]] = {}
    if not covers_root.is_dir():
        return choices

    for path in covers_root.rglob("*"):
        if any(part.startswith(".") for part in path.relative_to(covers_root).parts):
            continue
        if path.suffix.lower() not in COVER_EXTENSIONS or not is_safe_file(root, path):
            continue
        relative_to_covers = path.relative_to(covers_root).as_posix()
        stem_key = PurePosixPath(relative_to_covers).with_suffix("").as_posix().casefold()
        choices.setdefault(stem_key, []).append((f"covers/{relative_to_covers}", path))

    extension_order = {ext: index for index, ext in enumerate((".jpg", ".jpeg", ".png", ".webp"))}
    for entries in choices.values():
        entries.sort(key=lambda item: (extension_order.get(item[1].suffix.lower(), 99), item[0].casefold(), item[0]))
    return choices


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as audio_file:
        for chunk in iter(lambda: audio_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_previous_entries(catalog_path: Path) -> dict[str, dict[str, object]]:
    if not catalog_path.exists():
        return {}
    try:
        data = json.loads(catalog_path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"無法讀取既有歌單 {catalog_path}: {error}") from error
    if not isinstance(data, dict) or not isinstance(data.get("songs"), list):
        raise ValueError(f"既有歌單 {catalog_path} 格式錯誤：需要 songs 陣列。")

    previous: dict[str, dict[str, object]] = {}
    for entry in data["songs"]:
        path = audio_path_from_entry(entry)
        if path is None:
            continue
        if path in previous:
            raise ValueError(f"既有歌單重複記錄同一路徑：{path}")
        previous[path] = entry
    return previous


def build_catalog(root: Path, previous_catalog: Path) -> list[dict[str, str]]:
    previous_by_path = load_previous_entries(previous_catalog)
    cover_choices = scan_covers(root)
    songs: list[dict[str, str]] = []
    ids: set[str] = set()

    for relative_path, audio_file in scan_audio(root):
        old_entry = previous_by_path.get(relative_path, {})
        previous_id = old_entry.get("id")
        song_id = previous_id.strip() if isinstance(previous_id, str) and previous_id.strip() else (
            "path-" + hashlib.sha256(relative_path.encode("utf-8")).hexdigest()
        )
        if song_id in ids:
            raise ValueError(f"產生了重複歌曲 ID：{song_id}。請檢查既有 songs.json。")
        ids.add(song_id)

        previous_title = old_entry.get("title")
        title = previous_title.strip() if isinstance(previous_title, str) and previous_title.strip() else Path(relative_path).stem

        previous_cover = normalized_site_path(old_entry.get("coverUrl"))
        previous_cover_file = root / Path(*PurePosixPath(previous_cover).parts) if previous_cover else None
        if (
            previous_cover
            and previous_cover.startswith("covers/")
            and PurePosixPath(previous_cover).suffix.lower() in COVER_EXTENSIONS
            and previous_cover_file is not None
            and is_safe_file(root, previous_cover_file)
        ):
            cover_url = quote(previous_cover, safe="/-._~")
        else:
            relative_audio = PurePosixPath(relative_path).relative_to("audio")
            cover_key = relative_audio.with_suffix("").as_posix().casefold()
            matching_covers = cover_choices.get(cover_key, [])
            cover_url = quote(matching_covers[0][0], safe="/-._~") if matching_covers else ""

        song = {
            "id": song_id,
            "title": title,
            "audioUrl": quote(relative_path, safe="/-._~"),
            "version": sha256_file(audio_file),
        }
        if cover_url:
            song["coverUrl"] = cover_url
        songs.append(song)
    return songs


def write_catalog(songs: list[dict[str, str]], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {"songs": songs}
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            prefix=f"{output.name}.",
            suffix=".tmp",
            dir=output.parent,
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            temporary_file.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        os.replace(temporary_path, output)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def copy_if_safe(source_root: Path, relative_path: str, destination_root: Path) -> None:
    source = source_root / Path(relative_path)
    if not is_safe_file(source_root, source):
        raise ValueError(f"必要網站檔案不存在或不是安全的一般檔案：{relative_path}")
    destination = destination_root / Path(relative_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)


def build_site(root: Path, site_dir: Path, songs: list[dict[str, str]]) -> None:
    site_dir = site_dir.resolve()
    root = root.resolve()
    forbidden_dirs = (root / ".git", root / ".github", root / "audio", root / "covers", root / "icons", root / "scripts")
    if site_dir == root or root not in site_dir.parents or any(site_dir == path or path in site_dir.parents for path in forbidden_dirs):
        raise ValueError("部署輸出目錄必須是專案內獨立的建置目錄，例如 _site。")
    if site_dir.exists() and any(site_dir.iterdir()):
        raise ValueError("部署輸出目錄必須是空目錄，避免把舊檔案或私人檔案放進 Pages 產物。")

    site_dir.mkdir(parents=True, exist_ok=True)
    for relative_path in CORE_FILES:
        copy_if_safe(root, relative_path, site_dir)
    for icon_name in ICON_FILES:
        copy_if_safe(root, f"icons/{icon_name}", site_dir)

    for relative_path, _ in scan_audio(root):
        copy_if_safe(root, relative_path, site_dir)
    referenced_covers = {
        path
        for song in songs
        if (path := normalized_site_path(song.get("coverUrl"))) is not None
        and path.startswith("covers/")
        and PurePosixPath(path).suffix.lower() in COVER_EXTENSIONS
    }
    for relative_path in sorted(referenced_covers, key=lambda path: (path.casefold(), path)):
        copy_if_safe(root, relative_path, site_dir)

    write_catalog(songs, site_dir / "songs.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="掃描 audio/ 並產生播放器使用的 songs.json。")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1], help="專案根目錄（預設為腳本所在專案）。")
    parser.add_argument("--output", type=Path, help="歌單輸出路徑；預設覆寫專案根目錄 songs.json。")
    parser.add_argument("--site-dir", type=Path, help="建立 GitHub Pages 用精簡網站目錄，並在其中輸出歌單。")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    if args.output and args.site_dir:
        print("--output 與 --site-dir 請擇一使用。", file=sys.stderr)
        return 2

    try:
        songs = build_catalog(root, root / "songs.json")
        if args.site_dir:
            site_dir = args.site_dir if args.site_dir.is_absolute() else root / args.site_dir
            build_site(root, site_dir, songs)
            output = site_dir / "songs.json"
        else:
            output = args.output or (root / "songs.json")
            if not output.is_absolute():
                output = root / output
            write_catalog(songs, output)
    except (OSError, ValueError) as error:
        print(f"歌單產生失敗：{error}", file=sys.stderr)
        return 1

    print(f"已產生 {len(songs)} 首歌曲：{output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
