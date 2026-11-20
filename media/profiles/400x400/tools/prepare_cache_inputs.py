"""Generate cache probe identities, keeping assets on the host HTTP server."""
from hashlib import sha256
from pathlib import Path
import argparse
import json
import struct
import subprocess

FULL_SHA = "ac8589086b3c36040b356b4d7bcabfea30914384530dcc09b69de3ad85a52f48"
MEDIA = 0x400000
SCRATCH = 0x1EFF000
SIZE = 1024 * 1024
DAILY_IDS = (0, 4, 1, 11)
DAILY_SHA = {
    0: "5fbd94b1bd66102e64e90a780e2ba1bc804f26cdd298f88d7d605bdb1b1c8f87",
    4: "d09fe15025fa378b982ebaf04e72c0feeb4dfc616973ee50b1f0df4544f23e9b",
    1: "f384075188f0f372780e21288e0210e2a49615dca149d18fdaf65f8ae569a497",
    11: "e3775f9695133ddae0e596a9584b14997fe40d94ae86209af23a197c6573e27c",
}


def bytes_literal(data):
    return "{" + ", ".join(f"0x{x:02x}" for x in data) + "}"


def frame_digests(path, decoder):
    log = subprocess.check_output(["ffmpeg", "-nostdin", "-v", "error", "-xerror", "-threads", "1",
                                  "-c:v", decoder, "-i", str(path), "-pix_fmt", "yuv420p",
                                  "-f", "framehash", "-hash", "sha256", "pipe:1"], text=True)
    return [row.rsplit(",", 1)[-1].strip() for row in log.splitlines() if row and not row.startswith("#")]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", type=Path)
    parser.add_argument("approved_manifest", type=Path)
    parser.add_argument("backup", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--daily", action="store_true")
    args = parser.parse_args()
    approved = json.loads(args.approved_manifest.read_bytes())
    export = json.loads((args.export / "manifest.json").read_bytes())
    if not (export["codec"] == "VP8" and export["container"] == "IVF" and export["profile"] == 1 and
            export["width"] == export["height"] == 400 and export["fps"] == 24 and export["offset"] == [33, 33]):
        raise ValueError("Export profile drift")
    ids = DAILY_IDS if args.daily else (0, 67)
    rows = {row["id"]: row for row in export["samples"]}
    if not all(action in rows for action in ids):
        raise ValueError("Missing approved actions")
    scratch, size = (SCRATCH - SIZE, 2 * SIZE) if args.daily else (SCRATCH, SIZE)
    flash = args.backup.read_bytes()
    if (len(flash) != 0x2000000 or sha256(flash).hexdigest() != FULL_SHA or
            flash[scratch:scratch + size] != b"\xff" * size):
        raise ValueError("Backup or scratch range mismatch")
    roots = []
    for i in range(2):
        root = flash[MEDIA + 4096 * i:MEDIA + 4096 * (i + 1)]
        if root[:8] != b"PET4ROT2" or [struct.unpack_from("<I", root, 64 + j * 12)[0] for j in range(4)] != list(range(4)):
            raise ValueError("Unexpected PET4 root")
        roots.append(sha256(root).digest())
    header = ['#pragma once', '#include "cache_store.h"', 'namespace vp8_cache {', 'constexpr Asset assets[]{']
    frames_header = ["#pragma once"]
    for action in ids:
        item = rows[action]
        old = next((row for row in approved["samples"] if row["file"] == item["file"]), None)
        path = args.export / item["file"]
        asset = path.read_bytes()
        expected = DAILY_SHA[action] if args.daily else old["sha256"]
        if (sha256(asset).hexdigest() != expected or item["sha256"] != expected or
                len(asset) != item["bytes"] or item["frames"] != 241):
            raise ValueError("New export differs from the pinned export")
        if old is not None:
            frame_sha = old["i420_frame_sha256"]
        else:
            frame_sha = frame_digests(path, "vp8")
            if frame_sha != frame_digests(path, "libvpx"):
                raise ValueError("Host decoder disagreement")
        if len(frame_sha) != 241 or not all(len(sha) == 64 and len(bytes.fromhex(sha)) == 32 for sha in frame_sha):
            raise ValueError("Reference frame SHA mismatch")
        header.append(f'  {{{item["id"]}, {len(asset)}, 241, {bytes_literal(bytes.fromhex(item["sha256"]))}}},')
        frames_header.append(f'constexpr char hash_{item["id"]}_400[241][65] = {{')
        frames_header.extend(f'  "{sha}",' for sha in frame_sha)
        frames_header.append('};')
        print(item["file"], len(asset), item["sha256"])
    header += ['};', 'constexpr Digest approved_roots[]{', *(f'  {bytes_literal(root)},' for root in roots), '};', '}']
    args.output.mkdir(parents=True, exist_ok=True)
    for name, lines in (("cache_expected.h", header), ("expected.h", frames_header)):
        data = ("\n".join(lines) + "\n").encode()
        out = args.output / name
        if out.is_symlink():
            raise ValueError("Refusing symlink destination")
        if not out.exists() or out.read_bytes() != data:
            with out.open("xb") as stream:
                stream.write(data)


if __name__ == "__main__":
    main()
