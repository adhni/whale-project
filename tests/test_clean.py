import unittest
from datetime import datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from whales.clean import classify_whale_group
from whales.clean import clean_rows
from whales.clean import normalize_species
from whales.clean import parse_count
from whales.clean import parse_created


class CleanTests(unittest.TestCase):
    def test_parse_created_supports_both_source_formats(self) -> None:
        self.assertEqual(
            parse_created("2024-12-01 20:19:29"),
            datetime(2024, 12, 1, 20, 19, 29),
        )
        self.assertEqual(
            parse_created("2020-01-23T17:05:50.501Z"),
            datetime(2020, 1, 23, 17, 5, 50, 501000),
        )

    def test_parse_count_handles_missing_and_na(self) -> None:
        self.assertIsNone(parse_count(""))
        self.assertIsNone(parse_count("N/A"))
        self.assertEqual(parse_count("25"), 25.0)

    def test_grouping_preserves_major_species(self) -> None:
        self.assertEqual(
            classify_whale_group("Southern Resident Killer Whale"),
            "Southern Resident Orca",
        )
        self.assertEqual(classify_whale_group("Right Whale"), "Right Whale")
        self.assertEqual(classify_whale_group("Gray Whale"), "Gray Whale")
        self.assertEqual(
            classify_whale_group("Common Long-Beaked Dolphin"),
            "Dolphins & Porpoises",
        )

    def test_clean_rows_adds_expected_fields(self) -> None:
        rows = [
            {
                "created": "2024-12-01 20:19:29",
                "latitude": "37.6699",
                "longitude": "-123.096",
                "no_sighted": "1",
                "type": "Humpback Sighting:",
            },
            {
                "created": "2020-01-23T17:05:50.501Z",
                "latitude": "",
                "longitude": "",
                "no_sighted": "N/A",
                "type": "",
            },
        ]

        cleaned, summary = clean_rows(rows)

        self.assertEqual(len(cleaned), 2)
        self.assertEqual(
            cleaned[0]["species_normalized"],
            normalize_species("Humpback Sighting:"),
        )
        self.assertEqual(cleaned[0]["whale_group"], "Humpback Whale")
        self.assertEqual(cleaned[0]["has_valid_coordinates"], "true")
        self.assertEqual(cleaned[1]["has_valid_count"], "false")
        self.assertEqual(cleaned[1]["whale_group"], "Unknown")
        self.assertEqual(summary.total_rows, 2)
        self.assertEqual(summary.invalid_coordinates, 1)
        self.assertEqual(summary.invalid_counts, 1)


if __name__ == "__main__":
    unittest.main()
