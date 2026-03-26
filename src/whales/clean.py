"""Cleaning pipeline for whale sightings data."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable


INPUT_DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%fZ",
)


@dataclass(frozen=True)
class CleanResult:
    total_rows: int
    valid_dates: int
    invalid_dates: int
    valid_coordinates: int
    invalid_coordinates: int
    valid_counts: int
    invalid_counts: int
    non_positive_counts: int
    group_counts: dict[str, int]


def parse_created(value: str) -> datetime | None:
    """Parse the two timestamp formats seen in the raw dataset."""
    text = (value or "").strip()
    if not text:
        return None

    for fmt in INPUT_DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def parse_float(value: str) -> float | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_count(value: str) -> float | None:
    text = (value or "").strip()
    if not text or text.upper() == "N/A":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def normalize_species(value: str) -> str:
    text = " ".join((value or "").replace(":", " ").split())
    return text


def classify_whale_group(species: str) -> str:
    text = species.lower()
    if not text:
        return "Unknown"
    if "southern resident" in text and ("orca" in text or "killer whale" in text):
        return "Southern Resident Orca"
    if "orca" in text or "killer whale" in text:
        return "Orca"
    if "humpback" in text:
        return "Humpback Whale"
    if "right whale" in text:
        return "Right Whale"
    if "gray whale" in text or "grey" in text:
        return "Gray Whale"
    if any(name in text for name in ("blue", "fin", "minke", "bryde")):
        return "Large Baleen Whale"
    if "dolphin" in text or "porpoise" in text:
        return "Dolphins & Porpoises"
    if "whale" in text:
        return "Other Whales"
    return "Other Marine Mammals"


def format_count(value: float | None) -> str:
    if value is None:
        return ""
    if value.is_integer():
        return str(int(value))
    return str(value)


def clean_rows(rows: Iterable[dict[str, str]]) -> tuple[list[dict[str, str]], CleanResult]:
    cleaned_rows: list[dict[str, str]] = []
    group_counts: Counter[str] = Counter()
    total_rows = 0
    valid_dates = 0
    invalid_dates = 0
    valid_coordinates = 0
    invalid_coordinates = 0
    valid_counts = 0
    invalid_counts = 0
    non_positive_counts = 0

    for row in rows:
        total_rows += 1

        created_dt = parse_created(row.get("created", ""))
        if created_dt is None:
            invalid_dates += 1
        else:
            valid_dates += 1

        latitude = parse_float(row.get("latitude", ""))
        longitude = parse_float(row.get("longitude", ""))
        has_valid_coordinates = (
            latitude is not None
            and longitude is not None
            and -90 <= latitude <= 90
            and -180 <= longitude <= 180
        )
        if has_valid_coordinates:
            valid_coordinates += 1
        else:
            invalid_coordinates += 1

        count = parse_count(row.get("no_sighted", ""))
        if count is None:
            invalid_counts += 1
        else:
            valid_counts += 1
            if count <= 0:
                non_positive_counts += 1

        species = normalize_species(row.get("type", ""))
        whale_group = classify_whale_group(species)
        group_counts[whale_group] += 1

        cleaned_rows.append(
            {
                **row,
                "created_iso": created_dt.isoformat() if created_dt else "",
                "created_month": created_dt.strftime("%Y-%m") if created_dt else "",
                "created_year": str(created_dt.year) if created_dt else "",
                "latitude_clean": "" if latitude is None else str(latitude),
                "longitude_clean": "" if longitude is None else str(longitude),
                "has_valid_coordinates": str(has_valid_coordinates).lower(),
                "no_sighted_clean": format_count(count),
                "has_valid_count": str(count is not None).lower(),
                "is_positive_count": str(bool(count is not None and count > 0)).lower(),
                "species_normalized": species,
                "whale_group": whale_group,
            }
        )

    result = CleanResult(
        total_rows=total_rows,
        valid_dates=valid_dates,
        invalid_dates=invalid_dates,
        valid_coordinates=valid_coordinates,
        invalid_coordinates=invalid_coordinates,
        valid_counts=valid_counts,
        invalid_counts=invalid_counts,
        non_positive_counts=non_positive_counts,
        group_counts=dict(sorted(group_counts.items())),
    )
    return cleaned_rows, result


def write_clean_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        raise ValueError("No rows available to write")

    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_summary_json(path: Path, summary: CleanResult) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "total_rows": summary.total_rows,
        "valid_dates": summary.valid_dates,
        "invalid_dates": summary.invalid_dates,
        "valid_coordinates": summary.valid_coordinates,
        "invalid_coordinates": summary.invalid_coordinates,
        "valid_counts": summary.valid_counts,
        "invalid_counts": summary.invalid_counts,
        "non_positive_counts": summary.non_positive_counts,
        "group_counts": summary.group_counts,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def run(input_path: Path, output_path: Path, summary_path: Path) -> CleanResult:
    with input_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        cleaned_rows, summary = clean_rows(reader)

    write_clean_csv(output_path, cleaned_rows)
    write_summary_json(summary_path, summary)
    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Clean whale sightings CSV data")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/raw/acartia-export.csv"),
        help="Path to the raw CSV input",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/processed/acartia-clean.csv"),
        help="Path to the cleaned CSV output",
    )
    parser.add_argument(
        "--summary",
        type=Path,
        default=Path("data/processed/acartia-summary.json"),
        help="Path to the summary JSON output",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    summary = run(args.input, args.output, args.summary)
    print(
        json.dumps(
            {
                "total_rows": summary.total_rows,
                "invalid_dates": summary.invalid_dates,
                "invalid_coordinates": summary.invalid_coordinates,
                "invalid_counts": summary.invalid_counts,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
