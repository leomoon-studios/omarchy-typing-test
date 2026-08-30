#!/usr/bin/env python3
"""Read or atomically write one application data file.

Reads deliberately validate the descriptor, rather than validating a path and
opening that path later.  This matters because the files are same-user data
and can be replaced between two path operations.
"""

import errno
import os
import stat
import sys
import tempfile


MAX_BYTES = 10 * 1024 * 1024


def read_file(path):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
    except OSError as error:
        return 2 if error.errno == errno.ENOENT else 3
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_BYTES:
            return 4
        remaining = min(info.st_size, MAX_BYTES)
        chunks = []
        while remaining:
            chunk = os.read(fd, min(1024 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        data = b"".join(chunks)
        if len(data) > MAX_BYTES:
            return 4
        # Match FileView's text contract and reject malformed UTF-8 before it
        # reaches the QML parser.
        data.decode("utf-8")
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
        return 0
    finally:
        os.close(fd)


def write_file(path, input_stream=None, maximum_bytes=MAX_BYTES):
    # Read one byte past the shared ceiling so oversized writes are rejected
    # without buffering an attacker-controlled stream or touching the target.
    stream = input_stream if input_stream is not None else sys.stdin.buffer
    data = stream.read(maximum_bytes + 1)
    if len(data) > maximum_bytes:
        return 4
    directory = os.path.dirname(path) or "."
    mode = 0o600
    fd, temporary = tempfile.mkstemp(prefix=".typing-test-", dir=directory)
    directory_fd = None
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, "wb") as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        directory_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
        os.replace(temporary, path)
        temporary = None
        # Persist the directory entry update as well as the file contents so a
        # reported successful replacement survives a power loss.
        os.fsync(directory_fd)
        return 0
    finally:
        if directory_fd is not None:
            os.close(directory_fd)
        if temporary is not None:
            try:
                os.unlink(temporary)
            except FileNotFoundError:
                pass


def main():
    if len(sys.argv) != 3:
        return 64
    try:
        return read_file(sys.argv[2]) if sys.argv[1] == "read" else write_file(sys.argv[2]) if sys.argv[1] == "write" else 64
    except (OSError, UnicodeError):
        return 3


if __name__ == "__main__":
    sys.exit(main())
