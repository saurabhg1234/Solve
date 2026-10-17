#!/usr/bin/env python3
"""Verify a delivered MP4's actual streams, complete decode and audio level.

Technical checks complement visual/spoken-content review; they do not certify
domain correctness, subjective voice quality, recipient acceptance or approval.
"""
import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def check_video(path: Path, duration: float, width: int, height: int) -> dict:
    metadata = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
    ]))
    video = next(s for s in metadata["streams"] if s["codec_type"] == "video")
    audio = next(s for s in metadata["streams"] if s["codec_type"] == "audio")
    actual_duration = float(metadata["format"]["duration"])
    if abs(actual_duration - duration) > 0.1:
        raise ValueError(f"Duration {actual_duration} differs from {duration}")
    if (video["width"], video["height"]) != (width, height):
        raise ValueError("Video dimensions differ from the requested output")
    if video["codec_name"] != "h264" or audio["codec_name"] != "aac":
        raise ValueError("Expected H.264 video with AAC audio")
    decode = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    )
    if decode.stderr.strip():
        raise ValueError("Full-file decode reported errors")
    levels = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-vn", "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    ).stderr
    mean = float(re.search(r"mean_volume: ([\-\d.]+)", levels).group(1))
    peak = float(re.search(r"max_volume: ([\-\d.]+)", levels).group(1))
    if not -27 < mean < -12 or peak >= 0:
        raise ValueError(f"Check narration levels: mean {mean} dB, peak {peak} dB")
    with path.open("rb") as handle:
        sha256 = hashlib.file_digest(handle, "sha256").hexdigest()
    return {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "filename": path.name,
        "sha256": sha256,
        "bytes": path.stat().st_size,
        "durationSeconds": actual_duration,
        "dimensions": [width, height],
        "fps": video["avg_frame_rate"],
        "videoCodec": video["codec_name"],
        "audioCodec": audio["codec_name"],
        "fullDecode": True,
        "meanDb": mean,
        "peakDb": peak,
        "technicalChecksPassed": True,
        "visualAndContentReviewRequired": True,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("--duration", type=float, required=True)
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1080)
    args = parser.parse_args()
    print(json.dumps(check_video(args.video, args.duration, args.width, args.height), indent=2))
