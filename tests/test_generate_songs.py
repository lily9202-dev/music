import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import quote, unquote

from scripts.generate_songs import build_catalog


class GenerateSongsTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        (self.root / "audio").mkdir()
        (self.root / "covers").mkdir()
        (self.root / "songs.json").write_text('{"songs": []}\n', encoding="utf-8")

    def tearDown(self):
        self.temporary_directory.cleanup()

    def write_file(self, relative_path, content):
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return path

    def test_discovers_case_insensitive_audio_encodes_unicode_and_matches_cover(self):
        filename = "audio/專輯/夜 曲 #1%.M4A"
        cover_filename = "covers/專輯/夜 曲 #1%.WebP"
        content = b"audio test data"
        self.write_file(filename, content)
        self.write_file(cover_filename, b"cover image")
        self.write_file("audio/ignored.wav", b"not supported")

        songs = build_catalog(self.root, self.root / "songs.json")

        self.assertEqual(len(songs), 1)
        song = songs[0]
        self.assertEqual(song["title"], "夜 曲 #1%")
        self.assertEqual(unquote(song["audioUrl"]), filename)
        self.assertIn("%20", song["audioUrl"])
        self.assertIn("%23", song["audioUrl"])
        self.assertIn("%25", song["audioUrl"])
        self.assertEqual(unquote(song["coverUrl"]), cover_filename)
        self.assertEqual(song["version"], hashlib.sha256(content).hexdigest())

    def test_id_is_stable_when_other_songs_are_added_and_version_tracks_content(self):
        audio_path = "audio/one song.mp3"
        self.write_file(audio_path, b"version one")
        first = build_catalog(self.root, self.root / "songs.json")[0]

        self.write_file("audio/another.m4a", b"another song")
        after_add = {song["audioUrl"]: song for song in build_catalog(self.root, self.root / "songs.json")}
        self.assertEqual(after_add[quote(audio_path, safe="/-._~")]["id"], first["id"])

        self.write_file(audio_path, b"version two")
        after_update = {song["audioUrl"]: song for song in build_catalog(self.root, self.root / "songs.json")}
        updated = after_update[quote(audio_path, safe="/-._~")]
        self.assertEqual(updated["id"], first["id"])
        self.assertNotEqual(updated["version"], first["version"])

    def test_preserves_previous_id_title_and_cover_for_same_path(self):
        audio_path = "audio/song.mp3"
        cover_path = "covers/my custom cover.png"
        self.write_file(audio_path, b"audio")
        self.write_file(cover_path, b"cover")
        (self.root / "songs.json").write_text(
            json.dumps(
                {
                    "songs": [
                        {
                            "id": "keep-this-id",
                            "title": "使用者自訂歌名",
                            "audioUrl": quote(audio_path, safe="/-._~"),
                            "coverUrl": quote(cover_path, safe="/-._~"),
                            "version": "old-version",
                        }
                    ]
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        song = build_catalog(self.root, self.root / "songs.json")[0]

        self.assertEqual(song["id"], "keep-this-id")
        self.assertEqual(song["title"], "使用者自訂歌名")
        self.assertEqual(unquote(song["coverUrl"]), cover_path)
        self.assertNotEqual(song["version"], "old-version")

    def test_site_build_contains_only_whitelisted_app_and_referenced_media(self):
        for filename in ("index.html", "style.css", "app.js", "sw.js", "manifest.webmanifest"):
            self.write_file(filename, filename.encode())
        for filename in ("app-icon.svg", "app-icon-180.png", "app-icon-192.png", "app-icon-512.png"):
            self.write_file(f"icons/{filename}", filename.encode())
        self.write_file("audio/song.mp3", b"audio")
        self.write_file("audio/unused.wav", b"ignored")
        self.write_file("covers/song.jpg", b"referenced cover")
        self.write_file("covers/not-referenced.jpg", b"not copied")
        self.write_file("README.md", b"documentation")
        self.write_file(".private-settings", b"private")

        script = Path(__file__).resolve().parents[1] / "scripts" / "generate_songs.py"
        result = subprocess.run(
            [sys.executable, str(script), "--root", str(self.root), "--site-dir", "_site"],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        output = self.root / "_site"

        self.assertTrue((output / "songs.json").is_file())
        self.assertTrue((output / "audio/song.mp3").is_file())
        self.assertTrue((output / "covers/song.jpg").is_file())
        self.assertFalse((output / "audio/unused.wav").exists())
        self.assertFalse((output / "covers/not-referenced.jpg").exists())
        self.assertFalse((output / "README.md").exists())
        self.assertFalse((output / ".private-settings").exists())
        generated = json.loads((output / "songs.json").read_text(encoding="utf-8"))
        self.assertEqual(len(generated["songs"]), 1)

    def test_cli_default_writes_catalog_for_local_testing(self):
        self.write_file("audio/Live Server song.MP3", b"audio")
        script = Path(__file__).resolve().parents[1] / "scripts" / "generate_songs.py"
        result = subprocess.run(
            [sys.executable, str(script), "--root", str(self.root)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        generated = json.loads((self.root / "songs.json").read_text(encoding="utf-8"))
        self.assertEqual(generated["songs"][0]["title"], "Live Server song")


if __name__ == "__main__":
    unittest.main()
