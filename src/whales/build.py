"""Combined build command for whale dashboard outputs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from whales.aggregate import run as aggregate_run
from whales.clean import run as clean_run


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the whale clean and aggregate pipeline")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/raw/acartia-export.csv"),
        help="Path to the raw CSV input",
    )
    parser.add_argument(
        "--clean-output",
        type=Path,
        default=Path("data/processed/acartia-clean.csv"),
        help="Path to the cleaned CSV output",
    )
    parser.add_argument(
        "--clean-summary",
        type=Path,
        default=Path("data/processed/acartia-summary.json"),
        help="Path to the clean summary JSON",
    )
    parser.add_argument(
        "--map-output",
        type=Path,
        default=Path("data/processed/map-points.csv"),
        help="Path to the full map-ready points CSV",
    )
    parser.add_argument(
        "--web-map-output",
        type=Path,
        default=Path("data/processed/map-points-web.json"),
        help="Path to the lightweight dashboard map JSON",
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
        "--aggregate-summary",
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
    clean_summary = clean_run(args.input, args.clean_output, args.clean_summary)
    aggregate_summary = aggregate_run(
        input_path=args.clean_output,
        map_output_path=args.map_output,
        web_map_output_path=args.web_map_output,
        monthly_output_path=args.monthly_output,
        group_output_path=args.group_output,
        summary_output_path=args.aggregate_summary,
        min_year=args.min_year,
    )
    print(
        json.dumps(
            {
                "clean_rows": clean_summary.total_rows,
                "map_rows": aggregate_summary.map_rows,
                "web_map_rows": aggregate_summary.web_map_rows,
                "monthly_rows": aggregate_summary.monthly_rows,
                "group_rows": aggregate_summary.group_rows,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
