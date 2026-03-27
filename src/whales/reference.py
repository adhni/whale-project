"""Canonical whale reference mapping used by the pipeline."""

from __future__ import annotations

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class CanonicalSpecies:
    canonical_name: str
    canonical_slug: str
    canonical_type: str
    canonical_confidence: str
    profile_slug: str
    include_profile: bool


def _entry(
    canonical_name: str,
    canonical_slug: str,
    canonical_type: str,
    canonical_confidence: str,
    profile_slug: str,
    include_profile: bool,
) -> CanonicalSpecies:
    return CanonicalSpecies(
        canonical_name=canonical_name,
        canonical_slug=canonical_slug,
        canonical_type=canonical_type,
        canonical_confidence=canonical_confidence,
        profile_slug=profile_slug,
        include_profile=include_profile,
    )


CANONICAL_SPECIES_BY_LABEL: dict[str, CanonicalSpecies] = {
    "orca": _entry("Orca (Killer Whale)", "orca-killer-whale", "species", "high", "orca-killer-whale", True),
    "killer whale (orca)": _entry(
        "Orca (Killer Whale)", "orca-killer-whale", "species", "high", "orca-killer-whale", True
    ),
    "killer whale": _entry(
        "Orca (Killer Whale)", "orca-killer-whale", "species", "high", "orca-killer-whale", True
    ),
    "southern resident killer whale": _entry(
        "Southern Resident Orca", "southern-resident-orca", "population", "high", "southern-resident-orca", True
    ),
    "southern resident orca": _entry(
        "Southern Resident Orca", "southern-resident-orca", "population", "high", "southern-resident-orca", True
    ),
    "humpback": _entry("Humpback Whale", "humpback-whale", "species", "high", "humpback-whale", True),
    "humpback whale": _entry("Humpback Whale", "humpback-whale", "species", "high", "humpback-whale", True),
    "gray whale": _entry("Gray Whale", "gray-whale", "species", "high", "gray-whale", True),
    "grey": _entry("Gray Whale", "gray-whale", "species", "medium", "gray-whale", True),
    "grey whale": _entry("Gray Whale", "gray-whale", "species", "medium", "gray-whale", True),
    "right whale": _entry("Right Whale (species uncertain)", "", "ambiguous", "low", "", False),
    "minke whale": _entry(
        "Common Minke Whale", "common-minke-whale", "species", "medium", "common-minke-whale", True
    ),
    "blue whale": _entry("Blue Whale", "blue-whale", "species", "high", "blue-whale", True),
    "fin whale": _entry("Fin Whale", "fin-whale", "species", "high", "fin-whale", True),
    "finback whale": _entry("Fin Whale", "fin-whale", "species", "high", "fin-whale", True),
    "sperm whale": _entry("Sperm Whale", "sperm-whale", "species", "high", "sperm-whale", True),
    "sei whale": _entry("Sei Whale", "sei-whale", "species", "high", "sei-whale", True),
    "bottlenose whale": _entry(
        "Bottlenose Whale (species uncertain)", "", "ambiguous", "low", "", False
    ),
    "baird's beaked whale": _entry(
        "Baird’s Beaked Whale", "bairds-beaked-whale", "species", "high", "bairds-beaked-whale", True
    ),
    "sowerby's beaked whale": _entry(
        "Sowerby’s Beaked Whale", "sowerbys-beaked-whale", "species", "high", "sowerbys-beaked-whale", True
    ),
    "beluga": _entry("Beluga Whale", "beluga-whale", "species", "high", "beluga-whale", True),
    "beluga whale": _entry("Beluga Whale", "beluga-whale", "species", "high", "beluga-whale", True),
    "whale - unidentified": _entry("Unidentified Whale", "", "ambiguous", "medium", "", False),
    "other": _entry("Other / Unspecified Cetacean", "", "placeholder", "high", "", False),
    "other species": _entry("Other / Unspecified Cetacean", "", "placeholder", "high", "", False),
    "other sighting": _entry("Other / Unspecified Cetacean", "", "placeholder", "high", "", False),
    "unspecified": _entry("Other / Unspecified Cetacean", "", "placeholder", "high", "", False),
    "unspecified sighting": _entry("Other / Unspecified Cetacean", "", "placeholder", "high", "", False),
    "other (specify in comments)": _entry(
        "Other / Unspecified Cetacean", "", "placeholder", "high", "", False
    ),
    "other (specify in comments) sighting": _entry(
        "Other / Unspecified Cetacean", "", "placeholder", "high", "", False
    ),
    "northern right whale dolphin": _entry(
        "Northern Right Whale Dolphin", "", "non-whale cetacean", "high", "", False
    ),
    "short finned pilot whale": _entry(
        "Short-finned Pilot Whale", "short-finned-pilot-whale", "species", "high", "short-finned-pilot-whale", True
    ),
    "short-finned pilot whale": _entry(
        "Short-finned Pilot Whale", "short-finned-pilot-whale", "species", "high", "short-finned-pilot-whale", True
    ),
}


def normalize_reference_label(value: str) -> str:
    text = " ".join((value or "").replace(":", " ").split())
    return text.strip()


def canonicalize_species(value: str) -> CanonicalSpecies:
    species = normalize_reference_label(value)
    if not species:
        return _entry("Unknown", "", "unknown", "low", "", False)

    lookup_keys = [species.lower()]
    stripped = re.sub(r"\s+sighting$", "", species, flags=re.IGNORECASE).strip()
    if stripped and stripped.lower() not in lookup_keys:
        lookup_keys.append(stripped.lower())

    for key in lookup_keys:
        if key in CANONICAL_SPECIES_BY_LABEL:
            return CANONICAL_SPECIES_BY_LABEL[key]

    return _entry(species, "", "unmapped", "low", "", False)
