# Whale Project Next Steps

Focused follow-up plan after the current dashboard and public whale profile work.

This is the practical next layer, not the original build roadmap. The dashboard is already live and usable. The main question now is how to make it more trustworthy, easier for the public to understand, and easier to share.

## Quick Wins

### 1. Add an `About the data` panel

Why:
- the dashboard is now rich enough that users need more help understanding what a sighting row actually means
- this is the highest-value trust improvement without changing the core design

What to include:
- what one row represents
- what `no_sighted` means
- what gets filtered out in cleaning
- why some whale labels stay uncertain
- how source labels should be interpreted

Success looks like:
- public users can understand the dashboard without outside explanation
- fewer places where users can confuse sightings with abundance

### 2. Add shareable state in the URL

Why:
- the dashboard is now detailed enough that people will want to send specific views
- this is one of the most practical product improvements

Scope:
- species
- region
- year
- source
- optionally selected whale profile

Success looks like:
- opening a shared link restores the same dashboard view
- species pages and map states become linkable

### 3. Add guided story presets

Why:
- the map is strong for exploration, but weaker for first-time visitors who do not know where to begin

Suggested presets:
- Southern Residents
- California migration
- East Coast right whales
- Offshore giants
- Recent activity

Success looks like:
- new visitors can start with one click instead of building a filter set from scratch

## Medium Lifts

### 4. Strengthen uncertainty treatment

Why:
- the biggest credibility risk now is not styling, it is implied certainty

Improve:
- unresolved whale labels
- species-vs-population distinctions
- non-whale cetaceans mixed into whale reporting
- UI warnings when a public profile is intentionally withheld

Success looks like:
- the dashboard feels careful, not overconfident

### 5. Add better source provenance

Why:
- source filtering exists, but source meaning is still too opaque for public readers

Improve:
- short source descriptions
- witness/app/feed distinctions
- source quality caveats where needed

Success looks like:
- users understand where observations come from and why sources differ

### 6. Add stronger data contracts

Why:
- the frontend now depends on specific processed shapes and reference files

Improve:
- schema checks for processed outputs
- reference-file validation
- stronger failure behavior in `whales-build`

Success looks like:
- pipeline changes break loudly instead of silently damaging the dashboard

## Bigger Upgrades

### 7. Create species-specific URLs or pages

Why:
- the dashboard now has enough whale content to support direct public entry by species

Possible approach:
- modal + URL state first
- dedicated species pages later if needed

Success looks like:
- each whale profile can be shared or discovered directly

### 8. Add visual editorial content

Why:
- the project is now informative, but still mostly data-first

Possible additions:
- photos or illustrations
- species hero visuals
- small migration or habitat diagrams

Success looks like:
- the public experience feels more like a finished atlas and less like a technical dashboard

### 9. Add guided comparisons

Why:
- a lot of public value sits in comparing whales, coasts, or seasons rather than looking at one slice alone

Examples:
- compare two species
- compare regions
- compare recent period vs historical period

Success looks like:
- the dashboard supports interpretation, not just filtering

## Recommended Order

1. add `About the data`
2. add shareable URL state
3. add guided story presets
4. strengthen uncertainty treatment
5. improve source provenance

## Notes

- do not default to more visual complexity before trust and clarity improve
- the current dashboard is already strong enough visually for now
- the best next gains are in explanation, truthfulness, and usability
