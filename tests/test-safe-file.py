#!/usr/bin/env python3

import importlib.util
import io
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "scripts" / "safe-file.py"
SPEC = importlib.util.spec_from_file_location("typing_test_safe_file", HELPER)
SAFE_FILE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SAFE_FILE)


class SafeFileWriteTests(unittest.TestCase):
    def test_production_limit_matches_reader_limit(self):
        self.assertEqual(SAFE_FILE.MAX_BYTES, 10 * 1024 * 1024)

    def test_oversized_write_is_bounded_and_preserves_destination(self):
        with tempfile.TemporaryDirectory(prefix="typing-test-safe-file-") as directory:
            target = Path(directory) / "data.jsonl"
            target.write_bytes(b"preserve-existing-data")
            payload = io.BytesIO(b"a" * (1024 * 1024))

            result = SAFE_FILE.write_file(target, payload, maximum_bytes=1024)

            self.assertEqual(result, 4)
            self.assertEqual(payload.tell(), 1025)
            self.assertEqual(target.read_bytes(), b"preserve-existing-data")
            self.assertEqual(list(Path(directory).glob(".typing-test-*")), [])

    def test_maximum_sized_write_succeeds_and_stays_readable(self):
        with tempfile.TemporaryDirectory(prefix="typing-test-safe-file-") as directory:
            target = Path(directory) / "data.jsonl"
            payload = b"b" * 1024

            result = SAFE_FILE.write_file(target, io.BytesIO(payload), maximum_bytes=1024)

            self.assertEqual(result, 0)
            self.assertEqual(target.read_bytes(), payload)
            self.assertEqual(stat.S_IMODE(os.stat(target).st_mode), 0o600)
            self.assertLessEqual(target.stat().st_size, SAFE_FILE.MAX_BYTES)
            read_result = subprocess.run(
                ["python3", str(HELPER), "read", str(target)],
                check=False,
                capture_output=True,
            )
            self.assertEqual(read_result.returncode, 0)
            self.assertEqual(read_result.stdout, payload)


if __name__ == "__main__":
    unittest.main()
