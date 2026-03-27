import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from whales.aggregate import build_group_rows
from whales.aggregate import build_map_rows
from whales.aggregate import build_monthly_rows
from whales.aggregate import build_web_map_rows


class AggregateTests(unittest.TestCase):
    def test_build_map_rows_filters_to_valid_positive_rows(self) -> None:
        rows = [
            {
                "entry_id": "1",
                "created_iso": "2024-01-15T10:00:00",
                "created_month": "2024-01",
                "created_year": "2024",
                "latitude_clean": "10.0",
                "longitude_clean": "20.0",
                "no_sighted_clean": "3",
                "species_normalized": "Orca",
                "canonical_name": "Orca (Killer Whale)",
                "canonical_slug": "orca-killer-whale",
                "canonical_type": "species",
                "profile_slug": "orca-killer-whale",
                "has_public_profile": "true",
                "whale_group": "Orca",
                "source_normalized": "Cascadia",
                "region": "Puget Sound",
                "data_source_witness": "source-a",
                "data_source_name": "api",
                "has_valid_coordinates": "true",
                "is_positive_count": "true",
            },
            {
                "entry_id": "2",
                "has_valid_coordinates": "false",
                "is_positive_count": "true",
            },
            {
                "entry_id": "3",
                "has_valid_coordinates": "true",
                "is_positive_count": "false",
            },
        ]

        result = build_map_rows(rows)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["entry_id"], "1")
        self.assertEqual(result[0]["whale_group"], "Orca")
        self.assertEqual(result[0]["canonical_name"], "Orca (Killer Whale)")
        self.assertEqual(result[0]["profile_slug"], "orca-killer-whale")
        self.assertEqual(result[0]["source_normalized"], "Cascadia")
        self.assertEqual(result[0]["region"], "Puget Sound")

    def test_build_monthly_rows_groups_by_month_and_whale_group(self) -> None:
        rows = [
            {
                "created_month": "2024-01",
                "created_year": "2024",
                "whale_group": "Orca",
                "data_source_witness": "source-a",
                "data_source_name": "",
                "no_sighted_clean": "3",
                "is_positive_count": "true",
            },
            {
                "created_month": "2024-01",
                "created_year": "2024",
                "whale_group": "Orca",
                "data_source_witness": "source-a",
                "data_source_name": "",
                "no_sighted_clean": "2",
                "is_positive_count": "true",
            },
            {
                "created_month": "2024-01",
                "created_year": "2024",
                "whale_group": "Orca",
                "data_source_witness": "source-b",
                "data_source_name": "",
                "no_sighted_clean": "7",
                "is_positive_count": "true",
            },
            {
                "created_month": "2017-12",
                "created_year": "2017",
                "whale_group": "Orca",
                "data_source_witness": "source-a",
                "data_source_name": "",
                "no_sighted_clean": "9",
                "is_positive_count": "true",
            },
        ]

        result = build_monthly_rows(rows, min_year=2018)

        self.assertEqual(
            result,
            [
                {
                    "created_month": "2024-01",
                    "whale_group": "Orca",
                    "source_label": "source-a",
                    "observation_count": "2",
                    "total_sighted": "5",
                },
                {
                    "created_month": "2024-01",
                    "whale_group": "Orca",
                    "source_label": "source-b",
                    "observation_count": "1",
                    "total_sighted": "7",
                }
            ],
        )

    def test_build_web_map_rows_trims_to_dashboard_fields(self) -> None:
        rows = [
            {
                "entry_id": "1",
                "created_iso": "2024-01-15T10:00:00",
                "created_month": "2024-01",
                "created_year": "2024",
                "latitude": "10.123456",
                "longitude": "20.654321",
                "no_sighted": "3",
                "species_normalized": "Killer Whale (Orca)",
                "canonical_name": "Orca (Killer Whale)",
                "canonical_slug": "orca-killer-whale",
                "profile_slug": "orca-killer-whale",
                "whale_group": "Orca",
                "source_normalized": "Cascadia",
                "region": "Puget Sound",
                "canonical_type": "species",
                "has_public_profile": "true",
                "data_source_witness": "source-a",
            }
        ]

        result = build_web_map_rows(rows)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["latitude"], "10.1235")
        self.assertEqual(result[0]["longitude"], "20.6543")
        self.assertNotIn("canonical_type", result[0])
        self.assertNotIn("data_source_witness", result[0])

    def test_build_group_rows_computes_summary_metrics(self) -> None:
        rows = [
            {
                "whale_group": "Orca",
                "species_normalized": "Orca",
                "canonical_name": "Orca (Killer Whale)",
                "canonical_slug": "orca-killer-whale",
                "profile_slug": "orca-killer-whale",
                "has_public_profile": "true",
                "no_sighted_clean": "3",
                "is_positive_count": "true",
                "has_valid_coordinates": "true",
            },
            {
                "whale_group": "Orca",
                "species_normalized": "Orca",
                "canonical_name": "Orca (Killer Whale)",
                "canonical_slug": "orca-killer-whale",
                "profile_slug": "orca-killer-whale",
                "has_public_profile": "true",
                "no_sighted_clean": "2",
                "is_positive_count": "true",
                "has_valid_coordinates": "false",
            },
            {
                "whale_group": "Gray Whale",
                "species_normalized": "Gray Whale",
                "canonical_name": "Gray Whale",
                "canonical_slug": "gray-whale",
                "profile_slug": "gray-whale",
                "has_public_profile": "true",
                "no_sighted_clean": "",
                "is_positive_count": "false",
                "has_valid_coordinates": "true",
            },
        ]

        result = build_group_rows(rows)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[1]["whale_group"], "Orca")
        self.assertEqual(result[1]["row_count"], "2")
        self.assertEqual(result[1]["positive_count_rows"], "2")
        self.assertEqual(result[1]["mapped_rows"], "1")
        self.assertEqual(result[1]["total_sighted"], "5")
        self.assertEqual(result[1]["top_species"], "Orca (Killer Whale)")
        self.assertEqual(result[1]["top_species_profile_slug"], "orca-killer-whale")


if __name__ == "__main__":
    unittest.main()
