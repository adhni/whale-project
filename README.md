# Whale Project

Starter repo for a richer whale sightings pipeline and app.

## Structure

- `data/raw/`: raw source CSV
- `data/processed/`: generated cleaned outputs
- `src/whales/`: package code
- `tests/`: basic test coverage

## Quick Start

```bash
cd /Users/adhni/Desktop/whale-project
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
python3 -m whales.clean
python3 -m whales.aggregate
python3 -m http.server 8000
```

Then open `http://localhost:8000/dashboard/`.

To run the Streamlit app locally:

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

## Current Pipeline

The first pass cleaner:

- parses mixed timestamp formats from the source CSV
- normalizes species text
- maps rows into whale groups
- validates coordinates
- cleans `no_sighted` into a numeric-friendly field
- writes a cleaned CSV and a JSON summary into `data/processed/`

The aggregation step:

- emits map-ready rows with valid coordinates and positive sightings
- emits monthly totals by whale group from 2018 onward
- emits a group summary table for downstream UI or reporting
- writes a lightweight aggregation summary JSON

## Dashboard

The static dashboard lives in `dashboard/` and reads from the generated files in
`data/processed/`.

## Streamlit Deploy

This repo is prepared for Streamlit Community Cloud with:

- root entrypoint: `streamlit_app.py`
- dependency file: `requirements.txt`
- config file: `.streamlit/config.toml`
