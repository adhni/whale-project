# Whale Project Roadmap

Short-term improvement plan for the deployed dashboard at
`https://whale-watch-atlas.onrender.com/dashboard/`.

## Priority 1: Web Performance

Goal: reduce first-load cost without changing the dashboard design.

- add a web-specific export like `data/processed/map-points-web.csv`
- keep analysis outputs intact, but ship a lighter map dataset to the browser
- drop fields the dashboard does not use
- round coordinate precision slightly to reduce file size
- cap or normalize extreme point sizes for more stable rendering
- consider an `All years` sampled view if the full map remains heavy

## Priority 2: Single Build Command

Goal: make data refresh and deploy prep one step.

- add `whales-build` as a CLI entrypoint
- run clean + aggregate + web export in sequence
- document the command in the README

Target workflow:

```bash
whales-build
```

## Priority 3: Smarter Region Navigation

Goal: make the map easier to use without manual zooming.

- define explicit region bounds for:
  - Puget Sound
  - Salish Sea
  - California Coast
  - US East Coast
  - Alaska South Coast
  - Hawaii
  - Offshore Pacific
- make region presets fit the map to those bounds immediately
- preserve a sensible all-region default view

## Priority 4: Better Auto-Zoom Behavior

Goal: make map movement feel intentional.

- if a region preset is selected, fit to region bounds
- if filters narrow the data heavily, fit to the filtered points
- if a single point is selected, zoom tighter to that point
- if the result set is very large, prefer stable coast-level extents over noisy fit-bounds behavior

## Priority 5: UI Polish

Goal: improve clarity after the data and map behavior are stabilized.

- show a clearer loading state while large files are fetched
- show `displaying N of M points` on the map
- add a small deploy note in the README that Render is the main publishing path
- optionally remove or demote the Streamlit path if it is no longer part of the plan

## Recommended Order

1. web dataset optimization
2. `whales-build`
3. region presets with explicit bounds
4. smarter auto-zoom behavior
5. final UI polish

## Notes

- current deployed dashboard is working, so this is improvement work, not a rescue task
- the largest web payload issue is the committed map snapshot
- the best next combined milestone is: lighter web export + `whales-build`
