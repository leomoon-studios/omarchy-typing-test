#!/usr/bin/env python3

import importlib.util
import io
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest import mock


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

    def test_file_and_directory_are_synced_in_order(self):
        with tempfile.TemporaryDirectory(prefix="typing-test-safe-file-") as directory:
            target = Path(directory) / "data.jsonl"
            sync_targets = []
            real_fsync = os.fsync

            def record_sync(descriptor):
                mode = os.fstat(descriptor).st_mode
                sync_targets.append("directory" if stat.S_ISDIR(mode) else "file")
                return real_fsync(descriptor)

            with mock.patch.object(SAFE_FILE.os, "fsync", side_effect=record_sync):
                result = SAFE_FILE.write_file(target, io.BytesIO(b"durable"), maximum_bytes=1024)

            self.assertEqual(result, 0)
            self.assertEqual(sync_targets, ["file", "directory"])
            self.assertEqual(target.read_bytes(), b"durable")

    def test_directory_sync_failure_closes_descriptor_and_leaves_no_temp_file(self):
        with tempfile.TemporaryDirectory(prefix="typing-test-safe-file-") as directory:
            target = Path(directory) / "data.jsonl"
            directory_descriptor = []
            real_fsync = os.fsync

            def fail_directory_sync(descriptor):
                if stat.S_ISDIR(os.fstat(descriptor).st_mode):
                    directory_descriptor.append(descriptor)
                    raise OSError("simulated directory fsync failure")
                return real_fsync(descriptor)

            with mock.patch.object(SAFE_FILE.os, "fsync", side_effect=fail_directory_sync):
                with self.assertRaisesRegex(OSError, "simulated directory fsync failure"):
                    SAFE_FILE.write_file(target, io.BytesIO(b"replacement"), maximum_bytes=1024)

            self.assertEqual(target.read_bytes(), b"replacement")
            self.assertEqual(list(Path(directory).glob(".typing-test-*")), [])
            with self.assertRaises(OSError):
                os.fstat(directory_descriptor[0])


if __name__ == "__main__":
    unittest.main()
