"""Prepare and verify a host-only 1.75C dual-slot migration candidate."""
import argparse
import binascii
import hashlib
import json
from pathlib import Path
import struct
import subprocess

SECTOR = 4096
ROOT = 65536
MEDIA = 0x1A00000
SLOT = 0x200000
STAGING = 512 * 1024
ACTIVE_BUDGET = MEDIA - 2 * ROOT - STAGING
# Start with the four daily objects, add the previously retained 46-action set,
# and include ten motion and interaction actions from the native 400 export.
DAILY = (0, 4, 1, 11)
REVIEWED = (0, 1, 4, 5, 6, 7, 9, 10, 11, 13, 16, 17, 19, 21, 24, 25, 26, 27, 28, 29,
            30, 31, 32, 34, 36, 38, 39, 43, 44, 47, 49, 50, 51, 52, 55, 58, 59, 62, 63,
            64, 70, 71, 73, 74, 76, 77)
INTERACTIONS = (2, 3, 14, 18, 41, 42, 45, 56, 57, 72)
PRELOAD = DAILY + tuple(action for action in REVIEWED + INTERACTIONS if action not in DAILY)
NAMES = {
    "nvsfactory": (1, 2, 0x9000, 0x32000, 0),
    "nvs": (1, 2, 0x3B000, 0xD2000, 0),
    "otadata": (1, 0, 0x10D000, 0x2000, 0),
    "phy_init": (1, 1, 0x10F000, 0x1000, 0),
    "model": (1, 0x82, 0x110000, 0xF0000, 0),
    "ota_0": (0, 0x10, 0x200000, SLOT, 0),
    "ota_1": (0, 0x11, 0x400000, SLOT, 0),
    "pet_vp8": (1, 0x42, 0x600000, MEDIA, 0),
}


def sha(data):
    return hashlib.sha256(data).digest()


def partitions(table):
    result = {}
    for offset in range(0, len(table), 32):
        magic, kind, sub, address, size, label, flags = struct.unpack_from("<HBBII16sI", table, offset)
        if magic == 0xEBEB:
            if hashlib.md5(table[:offset]).digest() != table[offset + 16:offset + 32]:
                raise ValueError("partition MD5")
            return result
        if magic != 0x50AA:
            raise ValueError("unexpected partition entry")
        name = label.split(b"\0")[0].decode()
        if name in result:
            raise ValueError("duplicate partition")
        result[name] = kind, sub, address, size, flags
    raise ValueError("missing partition table MD5")


def seed_media(asset_dir, update):
    export = json.loads((asset_dir / "manifest.json").read_bytes())
    if (export["codec"], export["container"], export["profile"], export["width"],
        export["height"], export["fps"], export["offset"]) != ("VP8", "IVF", 1, 400, 400, 24, [33, 33]):
        raise ValueError("export profile")
    rows = {row["id"]: row for row in export["samples"]}
    if len(rows) != len(export["samples"]) or len(set(PRELOAD)) != len(PRELOAD) or not set(PRELOAD) <= rows.keys():
        raise ValueError("duplicate or missing seed action")
    latest = next(row for row in json.loads((update / "manifest.json").read_bytes())["samples"] if row["id"] == 1)
    image = bytearray(b"\xff" * MEDIA)
    directory = bytearray(32 + 128 * 56)
    struct.pack_into("<8sII", directory, 0, b"RPVP8RT1", 1, len(PRELOAD))
    position = 2 * ROOT
    catalog = []
    for index, action in enumerate(PRELOAD):
        old = rows[action]
        row = old if action != 1 else latest
        path = asset_dir if action != 1 else update
        if row["file"] != f"{action}-400.ivf" or row["source_sha256"] != old["source_sha256"]:
            raise ValueError(f"seed provenance for action {action}")
        data = (path / row["file"]).read_bytes()
        digest = sha(data)
        frames = row["frames"]
        header = struct.pack("<4sHH4sHHIIII", b"DKIF", 0, 32, b"VP80", 400, 400, 24, 1, frames, 0)
        if (len(data) != row["bytes"] or digest.hex() != row["sha256"] or
                not 32 < len(data) <= STAGING - SECTOR or not 2 <= frames <= 1450 or data[:32] != header):
            raise ValueError(f"seed object {action}")
        footprint = SECTOR + ((len(data) + SECTOR - 1) // SECTOR) * SECTOR
        if position + footprint > MEDIA - STAGING:
            raise ValueError(f"seed budget exceeded at action {action}")
        version = 2 if action == 1 else 1
        struct.pack_into("<6I32s", directory, 32 + index * 56, 0, action, version, position, len(data), frames, digest)
        struct.pack_into("<8sIII4x32s8x", image, position, b"RPVP8IV1", action, len(data), frames, digest)
        image[position + SECTOR:position + SECTOR + len(data)] = data
        position += footprint
        catalog.append({"role": 0, "action": action, "version": version, "bytes": len(data),
                        "frames": frames, "sha256": digest.hex()})
    marker = b"PV8ROOT1\x35\x62\x91\x83\xf0\xa6\x54\x19"
    root = (bytes(directory) + sha(directory)).ljust(ROOT - len(marker), b"\xff") + marker
    image[:2 * ROOT] = root * 2
    layout = {"catalog_bytes": 2 * ROOT, "staging_bytes": STAGING, "object_capacity_bytes": ACTIVE_BUDGET,
              "object_used_bytes": position - 2 * ROOT, "object_remaining_bytes": MEDIA - STAGING - position,
              "optional_action_ids": sorted(rows.keys() - set(PRELOAD))}
    return image, catalog, layout


def otadata():
    # 6.0.2 esp_ota_select_entry_t: seq=1 selects ota_0; 0 is ESP_OTA_IMG_NEW.
    sequence = struct.pack("<I", 1)
    state = struct.pack("<I20sII", 1, b"\xff" * 20, 0, binascii.crc32(sequence, 0xFFFFFFFF))
    return state.ljust(2 * SECTOR, b"\xff")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("build", "signed", "public_key", "old_table", "export", "update_export", "output", "espsecure"):
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    candidate_table = (args.build / "partition_table/partition-table.bin").read_bytes()
    before = partitions(args.old_table.read_bytes())
    if partitions(candidate_table) != NAMES or any(before.get(k) != v for k, v in NAMES.items() if v[2] < SLOT):
        raise ValueError("partition layout differs")
    config = (args.build / "sdkconfig").read_text().splitlines()
    required = {"CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y", "CONFIG_SECURE_SIGNED_ON_UPDATE_NO_SECURE_BOOT=y",
                "CONFIG_ESPTOOLPY_FLASHSIZE_32MB=y", "# CONFIG_SECURE_BOOT is not set"}
    if not required.issubset(config) or "CONFIG_BOOTLOADER_APP_ANTI_ROLLBACK=y" in config:
        raise ValueError("SDK settings differ")
    raw = (args.build / "round_pet_175c_ota.bin").read_bytes()
    signed = args.signed.read_bytes()
    if not signed.startswith(raw) or len(signed) > SLOT or len(signed) % SECTOR or len(signed) < len(raw) + SECTOR:
        raise ValueError("signed image is not this build or exceeds its slot")
    if int.from_bytes(signed[:1], "little") != 0xE9 or signed[80:112].split(b"\0")[0] != b"round_pet_175c_ota":
        raise ValueError("wrong target application image")
    subprocess.run([str(args.espsecure), "verify-signature", "--version", "2", "--keyfile",
                    str(args.public_key), str(args.signed)], check=True)
    boot = (args.build / "bootloader/bootloader.bin").read_bytes()
    if not boot or len(boot) > 0x8000:
        raise ValueError("bootloader size")
    media, catalog, layout = seed_media(args.export, args.update_export)
    files = {
        "bootloader.bin": (0, boot),
        "partition-table.bin": (0x8000, candidate_table),
        "otadata-first-boot.bin": (0x10D000, otadata()),
        "ota_0.bin": (SLOT, signed),
        "ota_1-erased.bin": (2 * SLOT, b"\xff" * SLOT),
        "pet_vp8.bin": (3 * SLOT, media),
    }
    args.output.mkdir(mode=0o700)
    manifest = {"profile": "round-pet-175c-ota/1", "offline_only": True,
                "requires_verified_current_full_backup": True, "seed": catalog, "media": layout, "files": {}}
    for name, (offset, data) in files.items():
        (args.output / name).write_bytes(data)
        manifest["files"][name] = {"offset": offset, "bytes": len(data), "sha256": sha(data).hex()}
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
