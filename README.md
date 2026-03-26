# Whale Python Project

Starter Python repo for a richer whale sightings pipeline and app.

## Structure

- `data/raw/`: raw source CSV
- `data/processed/`: generated cleaned outputs
- `src/whales/`: package code
- `tests/`: basic test coverage

## Quick Start

```bash
cd /Users/adhni/Desktop/whale-python-project
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
python3 -m whales.clean
```

## Current Pipeline

The first pass cleaner:

- parses mixed timestamp formats from the source CSV
- normalizes species text
- maps rows into whale groups
- validates coordinates
- cleans `no_sighted` into a numeric-friendly field
- writes a cleaned CSV and a JSON summary into `data/processed/`
