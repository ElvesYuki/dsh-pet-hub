"""Verify the exact IVF handoff and generate probe-only linker inputs."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import re
import struct


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("samples", type=Path)
    parser.add_argument("pet4", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    manifest = json.loads((args.samples / "manifest.json").read_bytes())
    require(all(not args.output.resolve().is_relative_to(source.resolve()) for source in (args.samples, args.pet4)),
            "output must be separate from both source directories")
    hashes = ["#pragma once", "#include <cstdint>"]
    inputs = {}
    for name in ("0-232", "0-400", "67-400"):
        row = next(row for row in manifest["samples"] if row["file"] == name + ".ivf")
        data = (args.samples / row["file"]).read_bytes()
        require(len(data) == row["bytes"] and sha256(data).hexdigest() == row["sha256"], f"{name}: IVF SHA/length")
        side = int(name.split("-")[1])
        require(struct.unpack_from("<4sHH4sHHIII", data) == (b"DKIF", 0, 32, b"VP80", side, side, 24, 1, 241),
                f"{name}: IVF header")
        at = 32
        for frame in range(241):
            size, pts = struct.unpack_from("<IQ", data, at)
            at += 12
            require(3 <= size <= min(22000, row["max_packet_bytes"]) and at + size <= len(data) and pts == frame,
                    f"{name}: packet {frame} size/timestamp")
            require((data[at] >> 1 & 7) == 1 and data[at] & 16 and (frame != 0 or not data[at] & 1),
                    f"{name}: packet {frame} version/visibility/keyframe")
            at += size
        require(at == len(data), f"{name}: trailing data")
        pet = (args.pet4 / f"{row['id']}.pet").read_bytes()
        require(len(pet) == row["pet4_bytes"] and sha256(pet).hexdigest() == row["pet4_sha256"], f"{name}: PET4 SHA/length")
        frames = row["i420_frame_sha256"]
        require(len(frames) == 241 and all(re.fullmatch(r"[0-9a-f]{64}", h) for h in frames), f"{name}: I420 digests")
        hashes.append(f'constexpr char hash_{name.replace("-", "_")}[241][65] = {{')
        hashes.extend(f'    "{h}",' for h in frames)
        hashes.append("};")
        inputs[row["file"]] = data
        print(name, len(data), row["sha256"], "PET4", len(pet), row["pet4_sha256"])

    args.output.mkdir(parents=True, exist_ok=True)
    outputs = {**inputs, "expected.h": ("\n".join(hashes) + "\n").encode()}
    for filename, data in outputs.items():
        target = args.output / filename
        require(not target.is_symlink(), f"refusing linked output: {filename}")
        if target.exists():
            require(target.read_bytes() == data, f"refusing to replace different output: {filename}")
        else:
            with target.open("xb") as stream:
                stream.write(data)

if __name__ == "__main__":
    main()
