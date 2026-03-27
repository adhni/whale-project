"""Aggregation pipeline for cleaned whale sightings data."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AggregateResult:
    total_clean_rows: int
    map_rows: int
    web_map_rows: int
    monthly_rows: int
    group_rows: int


def parse_bool(value: str) -> bool:
    return (value or "").strip().lower() == "true"


def parse_float(value: str) -> float | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def format_number(value: float) -> str:
    if value.is_integer():
        return str(int(value))
    return str(value)


def get_source_label(row: dict[str, str]) -> str:
    return (
        row.get("source_normalized", "").strip()
        or row.get("data_source_witness", "").strip()
        or row.get("data_source_name", "").strip()
        or "Unknown"
    )


def build_map_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    map_rows: list[dict[str, str]] = []
    for row in rows:
        if not parse_bool(row.get("has_valid_coordinates", "")):
            continue
        if not parse_bool(row.get("is_positive_count", "")):
            continue

        map_rows.append(
            {
                "entry_id": row.get("entry_id", ""),
                "created_iso": row.get("created_iso", ""),
                "created_month": row.get("created_month", ""),
                "created_year": row.get("created_year", ""),
                "latitude": row.get("latitude_clean", ""),
                "longitude": row.get("longitude_clean", ""),
                "no_sighted": row.get("no_sighted_clean", ""),
                "species_normalized": row.get("species_normalized", ""),
                "canonical_name": row.get("canonical_name", ""),
                "canonical_slug": row.get("canonical_slug", ""),
                "canonical_type": row.get("canonical_type", ""),
                "profile_slug": row.get("profile_slug", ""),
                "has_public_profile": row.get("has_public_profile", ""),
                "whale_group": row.get("whale_group", ""),
                "source_normalized": get_source_label(row),
                "region": row.get("region", ""),
                "data_source_witness": row.get("data_source_witness", ""),
                "data_source_name": row.get("data_source_name", ""),
            }
        )
    return map_rows


def format_coordinate(value: str) -> str:
    parsed = parse_float(value)
    if parsed is None:
        return ""
    return f"{parsed:.4f}"


def build_web_map_rows(map_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    web_rows: list[dict[str, str]] = []
    for row in map_rows:
        web_rows.append(
            {
                "entry_id": row.get("entry_id", ""),
                "created_iso": row.get("created_iso", ""),
                "created_month": row.get("created_month", ""),
                "created_year": row.get("created_year", ""),
                "latitude": format_coordinate(row.get("latitude", "")),
                "longitude": format_coordinate(row.get("longitude", "")),
                "no_sighted": row.get("no_sighted", ""),
                "species_normalized": row.get("species_normalized", ""),
                "canonical_name": row.get("canonical_name", ""),
                "canonical_slug": row.get("canonical_slug", ""),
                "profile_slug": row.get("profile_slug", ""),
                "whale_group": row.get("whale_group", ""),
                "source_normalized": row.get("source_normalized", ""),
                "region": row.get("region", ""),
            }
        )
    return web_rows


def build_monthly_rows(rows: list[dict[str, str]], min_year: int) -> list[dict[str, str]]:
    monthly: dict[tuple[str, str, str], dict[str, float | int]] = defaultdict(
        lambda: {"observation_count": 0, "total_sighted": 0.0}
    )

    for row in rows:
        month = row.get("created_month", "")
        year = row.get("created_year", "")
        whale_group = row.get("whale_group", "")
        source_label = get_source_label(row)
        count = parse_float(row.get("no_sighted_clean", ""))

        if not month or not year or not whale_group:
            continue
        if not parse_bool(row.get("is_positive_count", "")):
            continue
        if int(year) < min_year:
            continue
        if count is None:
            continue

        key = (month, whale_group, source_label)
        monthly[key]["observation_count"] += 1
        monthly[key]["total_sighted"] += count

    monthly_rows: list[dict[str, str]] = []
    for (month, whale_group, source_label), metrics in sorted(monthly.items()):
        monthly_rows.append(
            {
                "created_month": month,
                "whale_group": whale_group,
                "source_label": source_label,
                "observation_count": str(metrics["observation_count"]),
                "total_sighted": format_number(float(metrics["total_sighted"])),
            }
        )
    return monthly_rows


def build_group_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    group_totals: dict[str, dict[str, float | int]] = defaultdict(
        lambda: {
            "row_count": 0,
            "positive_count_rows": 0,
            "mapped_rows": 0,
            "total_sighted": 0.0,
        }
    )
    species_per_group: dict[str, Counter[str]] = defaultdict(Counter)

    for row in rows:
        whale_group = row.get("whale_group", "") or "Unknown"
        species = row.get("canonical_name", "") or row.get("species_normalized", "") or "Unknown"
        count = parse_float(row.get("no_sighted_clean", ""))

        group_totals[whale_group]["row_count"] += 1
        species_per_group[whale_group][species] += 1

        if parse_bool(row.get("is_positive_count", "")):
            group_totals[whale_group]["positive_count_rows"] += 1
        if parse_bool(row.get("has_valid_coordinates", "")):
            group_totals[whale_group]["mapped_rows"] += 1
        if count is not None and count > 0:
            group_totals[whale_group]["total_sighted"] += count

    group_rows: list[dict[str, str]] = []
    for whale_group in sorted(group_totals):
        top_species, top_species_rows = species_per_group[whale_group].most_common(1)[0]
        exemplar_row = next(
            (
                row
                for row in rows
                if (row.get("whale_group", "") or "Unknown") == whale_group
                if (row.get("canonical_name", "") or row.get("species_normalized", "") or "Unknown")
                == top_species
            ),
            {},
        )
        metrics = group_totals[whale_group]
        group_rows.append(
            {
                "whale_group": whale_group,
                "row_count": str(metrics["row_count"]),
                "positive_count_rows": str(metrics["positive_count_rows"]),
                "mapped_rows": str(metrics["mapped_rows"]),
                "total_sighted": format_number(float(metrics["total_sighted"])),
                "top_species": top_species,
                "top_species_slug": exemplar_row.get("canonical_slug", ""),
                "top_species_profile_slug": exemplar_row.get("profile_slug", ""),
                "top_species_has_profile": exemplar_row.get("has_public_profile", ""),
                "top_species_rows": str(top_species_rows),
            }
        )
    return group_rows


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        raise ValueError(f"No rows available for {path}")

    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_summary(path: Path, summary: AggregateResult) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "total_clean_rows": summary.total_clean_rows,
        "map_rows": summary.map_rows,
        "web_map_rows": summary.web_map_rows,
        "monthly_rows": summary.monthly_rows,
        "group_rows": summary.group_rows,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def run(
    input_path: Path,
    map_output_path: Path,
    web_map_output_path: Path,
    monthly_output_path: Path,
    group_output_path: Path,
    summary_output_path: Path,
    min_year: int,
) -> AggregateResult:
    with input_path.open(newline="", encoding="utf-8") as handle:
        clean_rows = list(csv.DictReader(handle))

    map_rows = build_map_rows(clean_rows)
    web_map_rows = build_web_map_rows(map_rows)
    monthly_rows = build_monthly_rows(clean_rows, min_year=min_year)
    group_rows = build_group_rows(clean_rows)

    write_csv(map_output_path, map_rows)
    write_csv(web_map_output_path, web_map_rows)
    write_csv(monthly_output_path, monthly_rows)
    write_csv(group_output_path, group_rows)

    summary = AggregateResult(
        total_clean_rows=len(clean_rows),
        map_rows=len(map_rows),
        web_map_rows=len(web_map_rows),
        monthly_rows=len(monthly_rows),
        group_rows=len(group_rows),
    )
    write_summary(summary_output_path, summary)
    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Aggregate cleaned whale sightings data")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/processed/acartia-clean.csv"),
        help="Path to the cleaned CSV input",
    )
    parser.add_argument(
        "--map-output",
        type=Path,
        default=Path("data/processed/map-points.csv"),
        help="Path to the map-ready points CSV",
    )
    parser.add_argument(
        "--web-map-output",
        type=Path,
        default=Path("data/processed/map-points-web.csv"),
        help="Path to the lightweight map CSV used by the dashboard",
    )
    parser.add_argument(
        "--monthly-output",
        type=Path,
        default=Path("data/processed/monthly-group-totals.csv"),
        help="Path to the monthly totals CSV",
    )
    parser.add_argument(
        "--group-output",
        type=Path,
        default=Path("data/processed/group-summary.csv"),
        help="Path to the group summary CSV",
    )
    parser.add_argument(
        "--summary-output",
        type=Path,
        default=Path("data/processed/aggregate-summary.json"),
        help="Path to the aggregation summary JSON",
    )
    parser.add_argument(
        "--min-year",
        type=int,
        default=2018,
        help="Minimum year to include in monthly outputs",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    summary = run(
        input_path=args.input,
        map_output_path=args.map_output,
        web_map_output_path=args.web_map_output,
        monthly_output_path=args.monthly_output,
        group_output_path=args.group_output,
        summary_output_path=args.summary_output,
        min_year=args.min_year,
    )
    print(
        json.dumps(
            {
                "total_clean_rows": summary.total_clean_rows,
                "map_rows": summary.map_rows,
                "web_map_rows": summary.web_map_rows,
                "monthly_rows": summary.monthly_rows,
                "group_rows": summary.group_rows,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
