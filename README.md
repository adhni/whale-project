# Whale Project

Starter repo for a richer whale sightings pipeline and app.

See [ROADMAP.md](ROADMAP.md) for the next dashboard and pipeline improvements.
See [NEXT_STEPS.md](NEXT_STEPS.md) for the current post-launch product priorities.

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
whales-build
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

- emits full map-ready rows with valid coordinates and positive sightings
- emits a lighter `map-points-web.json` for the dashboard
- emits monthly totals by whale group from 2018 onward
- emits a group summary table for downstream UI or reporting
- writes a lightweight aggregation summary JSON

## Dashboard

The static dashboard lives in `dashboard/` and reads from the generated files in
`data/processed/`, using `map-points-web.json` for the live map.

## Static Deploy

This repo is prepared to deploy the HTML dashboard as a static site.

- root redirect: `index.html`
- app files: `dashboard/`
- committed dashboard data snapshot: `data/processed/`
- Render blueprint: `render.yaml`

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/adhni/whale-project)

## Streamlit Deploy

This repo is prepared for Streamlit Community Cloud with:

- root entrypoint: `streamlit_app.py`
- dependency file: `requirements.txt`
- config file: `.streamlit/config.toml`
