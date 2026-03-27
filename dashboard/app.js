const DATA_PATHS = {
  cleanSummary: "../data/processed/acartia-summary.json",
  aggregateSummary: "../data/processed/aggregate-summary.json",
  monthly: "../data/processed/monthly-group-totals.csv",
  groups: "../data/processed/group-summary.csv",
  map: "../data/processed/map-points.csv",
  speciesReference: "../data/reference/species-reference.json",
};

const GROUP_COLORS = {
  "Southern Resident Orca": "#e9724c",
  Orca: "#f4a259",
  "Humpback Whale": "#88e0d0",
  "Right Whale": "#f6d365",
  "Gray Whale": "#a7c4ff",
  "Large Baleen Whale": "#8cc084",
  "Dolphins & Porpoises": "#ef88c1",
  "Other Whales": "#d2d68d",
  "Other Marine Mammals": "#8bb2c3",
  Unknown: "#9aa6ac",
};

const state = {
  trendVisibleGroups: new Set(),
  trendData: null,
  trendHoverIndex: null,
  yearOptions: ["all"],
  sourceOptions: ["all"],
  regionOptions: ["all"],
  selectedYear: "all",
  selectedGroup: "all",
  selectedSpecies: "all",
  selectedSource: "all",
  selectedRegion: "all",
  selectedEntryId: null,
  selectedProfileSlug: null,
  mapRows: [],
  monthlyRows: [],
  groupRows: [],
  speciesProfiles: [],
  speciesNotes: [],
  speciesMappings: [],
  profileLookup: new Map(),
  noteByLabel: new Map(),
  map: null,
  pointLayer: null,
  mapRenderer: null,
};

const elements = {
  statusPill: document.getElementById("statusPill"),
  reloadButton: document.getElementById("reloadButton"),
  statCleanRows: document.getElementById("statCleanRows"),
  statMapRows: document.getElementById("statMapRows"),
  statGroups: document.getElementById("statGroups"),
  statTimeSpan: document.getElementById("statTimeSpan"),
  trendLegend: document.getElementById("trendLegend"),
  trendChart: document.getElementById("trendChart"),
  trendTooltip: document.getElementById("trendTooltip"),
  trendNote: document.getElementById("trendNote"),
  groupRankings: document.getElementById("groupRankings"),
  sourceList: document.getElementById("sourceList"),
  recentList: document.getElementById("recentList"),
  yearSlider: document.getElementById("yearSlider"),
  yearSliderValue: document.getElementById("yearSliderValue"),
  yearTicks: document.getElementById("yearTicks"),
  groupSelect: document.getElementById("groupSelect"),
  speciesSelect: document.getElementById("speciesSelect"),
  sourceSelect: document.getElementById("sourceSelect"),
  activeFilters: document.getElementById("activeFilters"),
  resetFiltersButton: document.getElementById("resetFiltersButton"),
  regionPresets: document.getElementById("regionPresets"),
  leafletMap: document.getElementById("leafletMap"),
  mapLegend: document.getElementById("mapLegend"),
  filteredPoints: document.getElementById("filteredPoints"),
  filteredYears: document.getElementById("filteredYears"),
  detailTitle: document.getElementById("detailTitle"),
  detailSubtitle: document.getElementById("detailSubtitle"),
  detailGroupBadge: document.getElementById("detailGroupBadge"),
  detailSourceBadge: document.getElementById("detailSourceBadge"),
  detailCount: document.getElementById("detailCount"),
  detailDate: document.getElementById("detailDate"),
  detailCoords: document.getElementById("detailCoords"),
  detailYear: document.getElementById("detailYear"),
  detailRegion: document.getElementById("detailRegion"),
  profileSelect: document.getElementById("profileSelect"),
  profileKicker: document.getElementById("profileKicker"),
  profileTitle: document.getElementById("profileTitle"),
  profileScientific: document.getElementById("profileScientific"),
  profileType: document.getElementById("profileType"),
  profileStatus: document.getElementById("profileStatus"),
  profileSummary: document.getElementById("profileSummary"),
  profileRange: document.getElementById("profileRange"),
  profileDiet: document.getElementById("profileDiet"),
  profileRole: document.getElementById("profileRole"),
  profileCaution: document.getElementById("profileCaution"),
  profileIdentification: document.getElementById("profileIdentification"),
  profileSize: document.getElementById("profileSize"),
  profileThreats: document.getElementById("profileThreats"),
  profileFacts: document.getElementById("profileFacts"),
  profileSources: document.getElementById("profileSources"),
};

const MAX_MAP_POINTS = 12000;
const DASHBOARD_MIN_YEAR = 2000;
const REGION_ORDER = [
  "all",
  "Puget Sound",
  "Salish Sea",
  "California Coast",
  "US East Coast",
  "Alaska South Coast",
  "Hawaii",
  "Offshore Pacific",
  "Other Region",
  "Unknown Region",
];

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value));
}

function formatMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").trim().split("\n");
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

async function loadCsv(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return parseCsv(await response.text());
}

function getColor(group) {
  return GROUP_COLORS[group] || "#88c6cf";
}

function buildTrendData(monthlyRows, groupRows) {
  const scopedRows = monthlyRows.filter(
    (row) => state.selectedSource === "all" || row.source_label === state.selectedSource,
  );
  const months = [...new Set(scopedRows.map((row) => row.created_month))].sort();
  const series = {};

  scopedRows.forEach((row) => {
      if (!series[row.whale_group]) {
        series[row.whale_group] = {};
      }
      if (!series[row.whale_group][row.created_month]) {
        series[row.whale_group][row.created_month] = 0;
      }
      series[row.whale_group][row.created_month] += Number(row.total_sighted);
    });

  const rankedGroups = [...groupRows]
    .map((row) => ({
      whale_group: row.whale_group,
      total_sighted: months.reduce(
        (sum, month) => sum + (series[row.whale_group]?.[month] || 0),
        0,
      ),
    }))
    .filter((row) => row.total_sighted > 0)
    .sort((a, b) => b.total_sighted - a.total_sighted)
    .map((row) => row.whale_group);

  return { months, series, rankedGroups };
}

function rebuildTrendChart(monthlyRows, groupRows) {
  const trendData = buildTrendData(monthlyRows, groupRows);

  if (state.trendVisibleGroups.size) {
    const available = new Set(trendData.rankedGroups);
    state.trendVisibleGroups = new Set(
      [...state.trendVisibleGroups].filter((group) => available.has(group)),
    );
  }

  state.trendHoverIndex = null;
  renderTrendLegend(trendData);
  renderTrendChart(trendData);
}

function syncYearSlider() {
  const index = state.yearOptions.indexOf(state.selectedYear);
  elements.yearSlider.value = String(index >= 0 ? index : 0);
  elements.yearSliderValue.textContent =
    state.selectedYear === "all" ? "All years" : state.selectedYear;
}

function resetFilters() {
  state.selectedYear = "all";
  state.selectedGroup = "all";
  state.selectedSpecies = "all";
  state.selectedSource = "all";
  state.selectedRegion = "all";
  state.selectedEntryId = null;
  elements.groupSelect.value = "all";
  elements.speciesSelect.value = "all";
  elements.sourceSelect.value = "all";
  syncYearSlider();
  rebuildTrendChart(state.monthlyRows, state.groupRows);
  updateMapViews();
}

function getSourceLabel(row) {
  return row.source_normalized || row.data_source_witness || row.data_source_name || "Unknown";
}

function getFilteredMapRows(mapRows) {
  return mapRows.filter((row) => {
    const yearOk = state.selectedYear === "all" || row.created_year === state.selectedYear;
    const groupOk = state.selectedGroup === "all" || row.whale_group === state.selectedGroup;
    const speciesOk =
      state.selectedSpecies === "all" || row.canonical_name === state.selectedSpecies;
    const sourceOk = state.selectedSource === "all" || getSourceLabel(row) === state.selectedSource;
    const regionOk = state.selectedRegion === "all" || row.region === state.selectedRegion;
    return yearOk && groupOk && speciesOk && sourceOk && regionOk;
  });
}

function renderFilterSummary() {
  const filters = [];
  if (state.selectedYear !== "all") {
    filters.push(["Year", state.selectedYear]);
  }
  if (state.selectedGroup !== "all") {
    filters.push(["Group", state.selectedGroup]);
  }
  if (state.selectedSpecies !== "all") {
    filters.push(["Species", state.selectedSpecies]);
  }
  if (state.selectedSource !== "all") {
    filters.push(["Source", state.selectedSource]);
  }
  if (state.selectedRegion !== "all") {
    filters.push(["Region", state.selectedRegion]);
  }

  if (!filters.length) {
    elements.activeFilters.innerHTML = `<span class="filter-pill"><strong>Scope</strong> Dashboard view uses all records from ${DASHBOARD_MIN_YEAR}+.</span>`;
  } else {
    elements.activeFilters.innerHTML = filters
      .map(
        ([label, value]) =>
          `<span class="filter-pill"><strong>${label}</strong> ${value}</span>`,
      )
      .join("");
  }

  elements.resetFiltersButton.disabled = filters.length === 0;
}

function renderRegionPresets() {
  elements.regionPresets.innerHTML = state.regionOptions
    .map((region) => {
      const label = region === "all" ? "All regions" : region;
      const active = state.selectedRegion === region ? "active" : "";
      return `<button type="button" class="region-chip ${active}" data-region="${region}">${label}</button>`;
    })
    .join("");

  elements.regionPresets.querySelectorAll("[data-region]").forEach((button) => {
    button.onclick = () => {
      state.selectedRegion = button.dataset.region || "all";
      state.selectedEntryId = null;
      renderRegionPresets();
      updateMapViews();
    };
  });
}

function renderStats(cleanSummary, aggregateSummary, monthlyRows, groupRows, mapRows) {
  const months = monthlyRows.map((row) => row.created_month).sort();
  elements.statCleanRows.textContent = formatNumber(cleanSummary.total_rows);
  elements.statMapRows.textContent = formatNumber(mapRows.length);
  elements.statGroups.textContent = formatNumber(groupRows.length);
  elements.statTimeSpan.textContent = months.length
    ? `${formatMonth(months[0])} to ${formatMonth(months[months.length - 1])}`
    : "No data";

  const invalidBits = [
    `${formatNumber(cleanSummary.invalid_counts)} invalid counts`,
    `${formatNumber(cleanSummary.invalid_dates)} invalid dates`,
    `${formatNumber(cleanSummary.invalid_coordinates)} invalid coordinates`,
  ];
  elements.statusPill.textContent = `Dashboard view: ${formatNumber(mapRows.length)} mapped sightings from ${DASHBOARD_MIN_YEAR}+ • ${invalidBits.join(" • ")}`;
}

function renderTrendLegend(trendData) {
  const defaultGroups = trendData.rankedGroups.slice(0, 5);
  if (!state.trendVisibleGroups.size) {
    defaultGroups.forEach((group) => state.trendVisibleGroups.add(group));
  }

  elements.trendLegend.innerHTML = "";
  trendData.rankedGroups.slice(0, 8).forEach((group) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip ${state.trendVisibleGroups.has(group) ? "active" : ""}`;
    chip.textContent = group;
    chip.style.boxShadow = state.trendVisibleGroups.has(group)
      ? `inset 0 0 0 1px ${getColor(group)}`
      : "none";
    chip.addEventListener("click", () => {
      if (state.trendVisibleGroups.has(group)) {
        state.trendVisibleGroups.delete(group);
      } else {
        state.trendVisibleGroups.add(group);
      }

      if (!state.trendVisibleGroups.size) {
        state.trendVisibleGroups.add(group);
      }

      renderTrendLegend(trendData);
      renderTrendChart(trendData);
    });
    elements.trendLegend.appendChild(chip);
  });
}

function renderTrendChart(trendData) {
  state.trendData = trendData;
  const svg = elements.trendChart;
  const width = 960;
  const height = 420;
  const padding = { top: 28, right: 100, bottom: 40, left: 56 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const visibleGroups = [...state.trendVisibleGroups];
  const xStep = trendData.months.length > 1 ? innerWidth / (trendData.months.length - 1) : innerWidth;

  const seriesValues = visibleGroups.flatMap((group) =>
    trendData.months.map((month) => trendData.series[group]?.[month] || 0),
  );
  const maxValue = Math.max(...seriesValues, 1);

  const xForIndex = (index) => padding.left + index * xStep;
  const yForValue = (value) => padding.top + innerHeight - (value / maxValue) * innerHeight;

  const gridLines = Array.from({ length: 4 }, (_, index) => {
    const value = (maxValue / 4) * (index + 1);
    const y = yForValue(value);
    return `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(156,194,188,0.12)" stroke-dasharray="4 8" />
      <text x="${padding.left - 10}" y="${y + 4}" fill="rgba(236,247,243,0.65)" text-anchor="end" font-size="11">${formatNumber(Math.round(value))}</text>
    `;
  }).join("");

  const xLabels = trendData.months
    .filter((_, index) => index % Math.ceil(trendData.months.length / 6) === 0)
    .map((month) => {
      const index = trendData.months.indexOf(month);
      return `<text x="${xForIndex(index)}" y="${height - 10}" fill="rgba(236,247,243,0.65)" text-anchor="middle" font-size="11">${month}</text>`;
    })
    .join("");

  const hoverIndex = state.trendHoverIndex;
  const hoverMonth = hoverIndex === null ? null : trendData.months[hoverIndex];
  const focusLine =
    hoverMonth === null
      ? ""
      : `<line x1="${xForIndex(hoverIndex)}" y1="${padding.top}" x2="${xForIndex(hoverIndex)}" y2="${height - padding.bottom}" stroke="rgba(246,185,107,0.5)" stroke-dasharray="5 7" />`;

  const paths = visibleGroups
    .map((group) => {
      const values = trendData.months.map((month) => trendData.series[group]?.[month] || 0);
      const path = values
        .map((value, index) => `${index === 0 ? "M" : "L"} ${xForIndex(index)} ${yForValue(value)}`)
        .join(" ");
      const lastValue = values[values.length - 1];
      const labelX = width - padding.right + 12;
      const labelY = yForValue(lastValue);
      const focusPoint =
        hoverMonth === null
          ? ""
          : `<circle cx="${xForIndex(hoverIndex)}" cy="${yForValue(values[hoverIndex])}" r="4.5" fill="${getColor(group)}" stroke="#eaf8f4" stroke-width="1.5" />`;
      return `
        <path d="${path}" fill="none" stroke="${getColor(group)}" stroke-width="3" stroke-linecap="round" />
        ${focusPoint}
        <text x="${labelX}" y="${labelY + 4}" fill="${getColor(group)}" font-size="12">${group}</text>
      `;
    })
    .join("");

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    ${gridLines}
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgba(236,247,243,0.16)" />
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="rgba(236,247,243,0.16)" />
    ${focusLine}
    ${paths}
    ${xLabels}
  `;

  const sourceLabel =
    state.selectedSource === "all" ? "all sources" : state.selectedSource;
  elements.trendNote.textContent = `Showing ${visibleGroups.length} group${visibleGroups.length === 1 ? "" : "s"} across ${trendData.months.length} monthly points for ${sourceLabel}. Hover for a monthly breakdown, or click the chart to snap the map to that year.`;
}

function renderTrendTooltip(clientX, clientY) {
  if (!state.trendData || state.trendHoverIndex === null) {
    elements.trendTooltip.classList.add("hidden");
    return;
  }

  const month = state.trendData.months[state.trendHoverIndex];
  const rows = [...state.trendVisibleGroups]
    .map((group) => ({
      group,
      value: state.trendData.series[group]?.[month] || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  elements.trendTooltip.innerHTML = `
    <p class="tooltip-month">${formatMonth(month)}</p>
    ${rows
      .map(
        (row) => `
          <div class="tooltip-row">
            <span class="tooltip-label">
              <span class="swatch" style="background:${getColor(row.group)}"></span>
              ${row.group}
            </span>
            <strong>${formatNumber(row.value)}</strong>
          </div>
        `,
      )
      .join("")}
  `;
  elements.trendTooltip.style.left = `${clientX}px`;
  elements.trendTooltip.style.top = `${clientY}px`;
  elements.trendTooltip.classList.remove("hidden");
}

function attachTrendInteractions() {
  elements.trendChart.onmousemove = (event) => {
    if (!state.trendData) return;
    const rect = elements.trendChart.getBoundingClientRect();
    const width = 960;
    const paddingLeft = 56;
    const paddingRight = 100;
    const innerWidth = width - paddingLeft - paddingRight;
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const relative = Math.max(0, Math.min(innerWidth, x - paddingLeft));
    const ratio = innerWidth === 0 ? 0 : relative / innerWidth;
    const index = Math.round(ratio * Math.max(state.trendData.months.length - 1, 0));
    state.trendHoverIndex = index;
    renderTrendChart(state.trendData);
    renderTrendTooltip(event.clientX - rect.left, event.clientY - rect.top);
  };

  elements.trendChart.onmouseleave = () => {
    state.trendHoverIndex = null;
    elements.trendTooltip.classList.add("hidden");
    if (state.trendData) {
      renderTrendChart(state.trendData);
    }
  };
}

function renderListItems(element, items, className = "") {
  if (!items?.length) {
    element.innerHTML = `<li class="empty-state">No details available.</li>`;
    return;
  }
  element.innerHTML = items
    .map((item) => `<li${className ? ` class="${className}"` : ""}>${escapeHtml(item)}</li>`)
    .join("");
}

function renderSourceItems(element, items) {
  if (!items?.length) {
    element.innerHTML = `<li class="empty-state">No source links available.</li>`;
    return;
  }

  element.innerHTML = items
    .map(
      (item) =>
        `<li><a class="species-source-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a></li>`,
    )
    .join("");
}

function normalizeProfileLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function prepareSpeciesReference(reference) {
  state.speciesProfiles = reference.profiles || [];
  state.speciesNotes = reference.implementation_notes || [];
  state.speciesMappings = reference.mappings || [];
  state.profileLookup = new Map(
    state.speciesProfiles.map((profile) => [profile.slug, profile]),
  );
  state.noteByLabel = new Map();

  state.speciesNotes.forEach((note) => {
    const related = String(note.related_raw_labels || "")
      .split(";")
      .map((label) => label.trim())
      .filter(Boolean);

    related.forEach((label) => {
      state.noteByLabel.set(normalizeProfileLabel(label), note);
    });

    state.noteByLabel.set(normalizeProfileLabel(note.canonical_name), note);
  });
}

function renderProfileSelect() {
  const options = [...state.speciesProfiles]
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map(
      (profile) =>
        `<option value="${escapeHtml(profile.slug)}">${escapeHtml(profile.display_name)}</option>`,
    )
    .join("");

  elements.profileSelect.innerHTML = options;

  if (!state.selectedProfileSlug && state.speciesProfiles.length) {
    state.selectedProfileSlug = state.speciesProfiles[0].slug;
  }

  elements.profileSelect.value = state.selectedProfileSlug || "";
  elements.profileSelect.onchange = () => {
    applyProfileSelection(elements.profileSelect.value, { syncSpeciesFilter: true });
  };
}

function applyProfileSelection(profileSlug, options = {}) {
  const { syncSpeciesFilter = false } = options;
  if (!profileSlug || !state.profileLookup.has(profileSlug)) {
    return;
  }

  const profile = state.profileLookup.get(profileSlug);
  state.selectedProfileSlug = profileSlug;
  elements.profileSelect.value = profileSlug;

  if (syncSpeciesFilter) {
    state.selectedSpecies = profile.display_name;
    state.selectedGroup = "all";
    state.selectedEntryId = null;
    elements.speciesSelect.value = profile.display_name;
    elements.groupSelect.value = "all";
    updateMapViews();
    return;
  }

  renderSelectedProfile(null);
}

function getProfileNoteForRow(row) {
  if (!row) {
    return null;
  }
  if (row.profile_slug && state.profileLookup.has(row.profile_slug)) {
    return state.speciesNotes.find((note) => note.profile_slug === row.profile_slug) || null;
  }
  return (
    state.noteByLabel.get(normalizeProfileLabel(row.canonical_name)) ||
    state.noteByLabel.get(normalizeProfileLabel(row.species_normalized)) ||
    state.noteByLabel.get(normalizeProfileLabel(row.whale_group)) ||
    null
  );
}

function renderFallbackProfile(note) {
  elements.profileKicker.textContent = "Needs review";
  elements.profileTitle.textContent = note?.recommended_card_title || "No public profile";
  elements.profileScientific.textContent = "This observation is kept separate from public species cards.";
  elements.profileType.textContent = "Unresolved label";
  elements.profileStatus.textContent = "No public profile";
  elements.profileSummary.textContent =
    "This category appears in the sightings data, but the research pack recommends not publishing it as a species-level whale profile yet.";
  elements.profileRange.textContent =
    "Range details are intentionally withheld until the identification is specific enough to support a public profile.";
  elements.profileDiet.textContent =
    "Diet and biology depend on which species this record actually refers to.";
  elements.profileRole.textContent =
    "Keep this label as an observation bucket or resolve it manually before presenting species-level facts to the public.";
  elements.profileCaution.textContent =
    note?.caution_for_public_use || "No public-facing species card is recommended for this label.";
  renderListItems(elements.profileIdentification, [`Related labels: ${note?.related_raw_labels || "Unknown"}`]);
  renderListItems(elements.profileSize, ["Species-level size and lifespan are not shown for uncertain labels."]);
  renderListItems(elements.profileThreats, ["Avoid overstating species identity or conservation claims."]);
  renderListItems(elements.profileFacts, ["Use this as a data category rather than a biological profile."]);
  renderSourceItems(elements.profileSources, []);
}

function renderProfileCard(profile, note = null) {
  const statusLabel = String(profile.conservation_status || "Status varies").split(" — ")[0];
  elements.profileKicker.textContent =
    note && note.profile_slug === profile.slug ? "Research-backed profile" : "Whale profile";
  elements.profileTitle.textContent = profile.display_name || "Unknown profile";
  elements.profileScientific.textContent = profile.scientific_name || "-";
  elements.profileType.textContent = profile.profile_type || "-";
  elements.profileStatus.textContent = statusLabel;
  elements.profileSummary.textContent = profile.short_summary || "No summary available.";
  elements.profileRange.textContent = profile.range_and_migration || "No range summary available.";
  elements.profileDiet.textContent = profile.diet || "No diet summary available.";
  elements.profileRole.textContent = profile.ecological_role || "No ecological role summary available.";
  elements.profileCaution.textContent =
    note?.caution_for_public_use || "Public-facing profile is considered safe with the stated caveats.";
  renderListItems(elements.profileIdentification, profile.identification);
  renderListItems(elements.profileSize, profile.size_and_lifespan);
  renderListItems(elements.profileThreats, profile.main_threats);
  renderListItems(elements.profileFacts, profile.public_facts);
  renderSourceItems(elements.profileSources, profile.source_list);
}

function renderSelectedProfile(row) {
  if (row?.profile_slug && state.profileLookup.has(row.profile_slug)) {
    state.selectedProfileSlug = row.profile_slug;
    elements.profileSelect.value = row.profile_slug;
    renderProfileCard(state.profileLookup.get(row.profile_slug), getProfileNoteForRow(row));
    return;
  }

  const note = row ? getProfileNoteForRow(row) : null;

  if (note?.profile_slug && state.profileLookup.has(note.profile_slug)) {
    state.selectedProfileSlug = note.profile_slug;
    elements.profileSelect.value = note.profile_slug;
    renderProfileCard(state.profileLookup.get(note.profile_slug), note);
    return;
  }

  if (note && !note.profile_slug) {
    renderFallbackProfile(note);
    return;
  }

  if (state.selectedProfileSlug && state.profileLookup.has(state.selectedProfileSlug)) {
    elements.profileSelect.value = state.selectedProfileSlug;
    renderProfileCard(state.profileLookup.get(state.selectedProfileSlug));
    return;
  }

  const firstProfile = state.speciesProfiles[0];
  if (firstProfile) {
    state.selectedProfileSlug = firstProfile.slug;
    elements.profileSelect.value = firstProfile.slug;
    renderProfileCard(firstProfile);
  }
}

function renderGroupRankings(groupRows) {
  const maxTotal = Math.max(...groupRows.map((row) => Number(row.total_sighted)), 1);
  const markup = [...groupRows]
    .sort((a, b) => Number(b.total_sighted) - Number(a.total_sighted))
    .slice(0, 6)
    .map((row) => {
      const percent = (Number(row.total_sighted) / maxTotal) * 100;
      return `
        <article class="rank-card" data-top-species="${escapeHtml(row.top_species)}" data-profile-slug="${escapeHtml(row.top_species_profile_slug || "")}">
          <div class="rank-head">
            <span class="rank-title">${row.whale_group}</span>
            <span>${formatNumber(row.total_sighted)}</span>
          </div>
          <div class="rank-bar">
            <span style="width:${percent}%; background:${getColor(row.whale_group)}"></span>
          </div>
          <p class="rank-meta">
            ${formatNumber(row.row_count)} rows • top species: ${row.top_species}
          </p>
        </article>
      `;
    })
    .join("");

  elements.groupRankings.innerHTML = markup;
  elements.groupRankings.querySelectorAll("[data-top-species]").forEach((card) => {
    card.onclick = () => {
      if (card.dataset.profileSlug && state.profileLookup.has(card.dataset.profileSlug)) {
        applyProfileSelection(card.dataset.profileSlug, { syncSpeciesFilter: true });
        return;
      }
      const note = state.noteByLabel.get(normalizeProfileLabel(card.dataset.topSpecies));
      if (note?.profile_slug) {
        applyProfileSelection(note.profile_slug, { syncSpeciesFilter: true });
      }
    };
  });
}

function renderSources(mapRows) {
  const counts = new Map();
  mapRows.forEach((row) => {
    const key = getSourceLabel(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const markup = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count], index) => `
      <article class="source-card">
        <div class="source-head">
          <span class="source-title">${index + 1}. ${name}</span>
          <span>${formatNumber(count)}</span>
        </div>
        <p class="source-meta">Share of mapped observations: ${((count / mapRows.length) * 100).toFixed(1)}%</p>
      </article>
    `)
    .join("");

  elements.sourceList.innerHTML = markup;
}

function renderRecent(mapRows) {
  const recentRows = [...mapRows]
    .sort((a, b) => String(b.created_iso).localeCompare(String(a.created_iso)))
    .slice(0, 8);

  elements.recentList.innerHTML = recentRows
    .map((row) => `
      <article class="recent-card">
        <div class="recent-head">
          <span class="recent-title">${row.canonical_name || row.species_normalized || "Unknown species"}</span>
          <span>${formatMonth(row.created_month)}</span>
        </div>
        <p class="recent-meta">
          ${row.whale_group} • ${formatNumber(row.no_sighted)} sighted • ${getSourceLabel(row)}
        </p>
      </article>
    `)
    .join("");
}

function renderMapSidePanels(filteredRows) {
  renderSources(filteredRows);
  renderRecent(filteredRows);
}

function renderDetailCard(row) {
  if (!row) {
    elements.detailTitle.textContent = "No matching sightings";
    elements.detailSubtitle.textContent =
      "Adjust the filters or click reset to bring more observations back into view.";
    elements.detailGroupBadge.textContent = "No selection";
    elements.detailSourceBadge.textContent = "-";
    elements.detailCount.textContent = "-";
    elements.detailDate.textContent = "-";
    elements.detailCoords.textContent = "-";
    elements.detailYear.textContent = "-";
    elements.detailRegion.textContent = "-";
    return;
  }

  elements.detailTitle.textContent = row.canonical_name || row.species_normalized || "Unknown species";
  elements.detailSubtitle.textContent =
    row.canonical_name && row.canonical_name !== row.species_normalized
      ? `Raw record label: ${row.species_normalized || "Unknown"}`
      : "This card follows the last point you clicked on the map.";
  elements.detailGroupBadge.textContent = row.whale_group;
  elements.detailSourceBadge.textContent = getSourceLabel(row);
  elements.detailCount.textContent = formatNumber(row.no_sighted);
  elements.detailDate.textContent = row.created_iso
    ? row.created_iso.replace("T", " ")
    : "Unknown";
  elements.detailCoords.textContent = `${Number(row.latitude).toFixed(2)}, ${Number(
    row.longitude,
  ).toFixed(2)}`;
  elements.detailYear.textContent = row.created_year || "-";
  elements.detailRegion.textContent = row.region || "-";
}

function getSelectedOrDefaultRow(filteredRows) {
  if (!filteredRows.length) {
    return null;
  }

  const selected =
    state.selectedEntryId === null
      ? null
      : filteredRows.find((row) => row.entry_id === state.selectedEntryId) || null;

  if (selected) {
    return selected;
  }

  const latest = [...filteredRows].sort((a, b) =>
    String(b.created_iso).localeCompare(String(a.created_iso)),
  )[0];
  state.selectedEntryId = latest?.entry_id || null;
  return latest || null;
}

function renderMapControls(groupRows, mapRows) {
  const years = [...new Set(mapRows.map((row) => row.created_year).filter(Boolean))].sort();
  const groups = groupRows.map((row) => row.whale_group);
  const species = [
    ...new Set(
      mapRows
        .map((row) => row.canonical_name)
        .filter((name) => name && name !== "Unknown"),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const sources = [...new Set(mapRows.map((row) => getSourceLabel(row)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  const regions = REGION_ORDER.filter(
    (region) => region === "all" || mapRows.some((row) => row.region === region),
  );

  state.yearOptions = ["all", ...years];
  state.sourceOptions = ["all", ...sources];
  state.regionOptions = regions;
  elements.yearSlider.min = "0";
  elements.yearSlider.max = String(state.yearOptions.length - 1);
  elements.yearSlider.step = "1";
  elements.yearTicks.innerHTML = `
    <span>All</span>
    <span>${years[0] || ""}</span>
    <span>${years[Math.floor(years.length / 2)] || ""}</span>
    <span>${years[years.length - 1] || ""}</span>
  `;
  elements.groupSelect.innerHTML = `<option value="all">All groups</option>${groups.map((group) => `<option value="${group}">${group}</option>`).join("")}`;
  elements.speciesSelect.innerHTML = `<option value="all">All species</option>${species.map((name) => `<option value="${name}">${name}</option>`).join("")}`;
  elements.sourceSelect.innerHTML = `<option value="all">All sources</option>${sources.map((source) => `<option value="${source}">${source}</option>`).join("")}`;

  state.selectedYear = "all";
  state.selectedGroup = "all";
  state.selectedSpecies = "all";
  state.selectedSource = "all";
  state.selectedRegion = "all";
  elements.groupSelect.value = state.selectedGroup;
  elements.speciesSelect.value = state.selectedSpecies;
  elements.sourceSelect.value = state.selectedSource;
  syncYearSlider();
  renderRegionPresets();

  elements.yearSlider.oninput = () => {
    const index = Number(elements.yearSlider.value);
    state.selectedYear = state.yearOptions[index] || "all";
    syncYearSlider();
    updateMapViews();
  };

  elements.groupSelect.onchange = () => {
    state.selectedGroup = elements.groupSelect.value;
    state.selectedEntryId = null;
    updateMapViews();
  };

  elements.speciesSelect.onchange = () => {
    state.selectedSpecies = elements.speciesSelect.value;
    const linkedProfile = state.speciesProfiles.find(
      (profile) => profile.display_name === state.selectedSpecies,
    );
    if (linkedProfile) {
      state.selectedProfileSlug = linkedProfile.slug;
      elements.profileSelect.value = linkedProfile.slug;
    }
    state.selectedEntryId = null;
    updateMapViews();
  };

  elements.sourceSelect.onchange = () => {
    state.selectedSource = elements.sourceSelect.value;
    state.selectedEntryId = null;
    rebuildTrendChart(state.monthlyRows, state.groupRows);
    updateMapViews();
  };

  elements.trendChart.onclick = () => {
    if (!state.trendData || state.trendHoverIndex === null) return;
    const month = state.trendData.months[state.trendHoverIndex];
    const year = month.slice(0, 4);
    if (state.yearOptions.includes(year)) {
      state.selectedYear = year;
      syncYearSlider();
      updateMapViews();
    }
  };

  elements.resetFiltersButton.onclick = () => {
    resetFilters();
  };

  elements.mapLegend.innerHTML = groups
    .slice(0, 10)
    .map((group) => `
      <span class="legend-chip">
        <span class="swatch" style="background:${getColor(group)}"></span>
        ${group}
      </span>
    `)
    .join("");
}

function ensureMap() {
  if (state.map || typeof L === "undefined") {
    return;
  }

  state.map = L.map(elements.leafletMap, {
    zoomControl: true,
    worldCopyJump: false,
    preferCanvas: true,
  }).setView([36, -124], 3);

  state.mapRenderer = L.canvas({ padding: 0.5 });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 9,
    minZoom: 2,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(state.map);
}

function buildPopup(row) {
  return `
    <div class="popup-title">${row.canonical_name || row.species_normalized || "Unknown species"}</div>
    <p class="popup-meta">
      ${row.whale_group}<br>
      ${formatNumber(row.no_sighted)} sighted<br>
      ${row.created_iso ? row.created_iso.replace("T", " ") : "Unknown time"}<br>
      ${getSourceLabel(row)}<br>
      ${row.region || "Unknown Region"}
    </p>
  `;
}

function renderLeafletMap(mapRows) {
  ensureMap();

  const filtered = getFilteredMapRows(mapRows);
  const selectedRow = getSelectedOrDefaultRow(filtered);

  const pointsToDraw = [...filtered]
    .sort((a, b) => String(b.created_iso).localeCompare(String(a.created_iso)))
    .slice(0, MAX_MAP_POINTS);

  if (state.pointLayer) {
    state.pointLayer.remove();
  }

  state.pointLayer = L.layerGroup();

  const bounds = [];
  pointsToDraw.forEach((row) => {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    const count = Number(row.no_sighted);
    const isSelected = row.entry_id === state.selectedEntryId;
    const marker = L.circleMarker([lat, lon], {
      renderer: state.mapRenderer,
      radius: isSelected
        ? Math.min(12, Math.max(4, Math.sqrt(count) * 0.62))
        : Math.min(10, Math.max(3, Math.sqrt(count) * 0.55)),
      color: getColor(row.whale_group),
      weight: isSelected ? 2.4 : 1,
      opacity: 0.9,
      fillColor: getColor(row.whale_group),
      fillOpacity: isSelected ? 0.62 : 0.35,
    });

    marker.bindPopup(buildPopup(row), { className: "whale-popup" });
    marker.on("click", () => {
      state.selectedEntryId = row.entry_id;
      renderDetailCard(row);
      renderLeafletMap(state.mapRows);
    });
    marker.addTo(state.pointLayer);
    bounds.push([lat, lon]);
  });

  state.pointLayer.addTo(state.map);

  if (bounds.length) {
    state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: 6 });
  }

  elements.filteredPoints.textContent =
    filtered.length > MAX_MAP_POINTS
      ? `${formatNumber(pointsToDraw.length)} / ${formatNumber(filtered.length)}`
      : formatNumber(filtered.length);
  const mapWindowParts = [
    state.selectedYear === "all" ? "All years" : state.selectedYear,
    state.selectedGroup !== "all" ? state.selectedGroup : null,
    state.selectedSpecies !== "all" ? state.selectedSpecies : null,
    state.selectedSource !== "all" ? state.selectedSource : null,
    state.selectedRegion !== "all" ? state.selectedRegion : null,
  ].filter(Boolean);
  elements.filteredYears.textContent = mapWindowParts.join(" • ");

  renderDetailCard(selectedRow);
  renderSelectedProfile(selectedRow);
}

function updateMapViews() {
  renderFilterSummary();
  renderLeafletMap(state.mapRows);
  renderMapSidePanels(getFilteredMapRows(state.mapRows));
}

async function renderDashboard() {
  if (window.location.protocol === "file:") {
    throw new Error("This dashboard was opened as a local file");
  }

  elements.statusPill.textContent = "Loading data";

  const [cleanSummary, aggregateSummary, monthlyRows, groupRows, rawMapRows, speciesReference] = await Promise.all([
    loadJson(DATA_PATHS.cleanSummary),
    loadJson(DATA_PATHS.aggregateSummary),
    loadCsv(DATA_PATHS.monthly),
    loadCsv(DATA_PATHS.groups),
    loadCsv(DATA_PATHS.map),
    loadJson(DATA_PATHS.speciesReference),
  ]);

  const mapRows = rawMapRows.filter((row) => Number(row.created_year || 0) >= DASHBOARD_MIN_YEAR);
  state.mapRows = mapRows;
  prepareSpeciesReference(speciesReference);

  renderStats(cleanSummary, aggregateSummary, monthlyRows, groupRows, mapRows);
  state.monthlyRows = monthlyRows;
  state.groupRows = groupRows;
  rebuildTrendChart(monthlyRows, groupRows);
  attachTrendInteractions();
  renderGroupRankings(groupRows);
  renderProfileSelect();
  renderMapControls(groupRows, mapRows);
  updateMapViews();
  elements.statusPill.textContent = `Ready • ${formatNumber(mapRows.length)} mapped sightings from ${DASHBOARD_MIN_YEAR}+`;
}

function renderLoadError(error) {
  const protocolHint =
    window.location.protocol === "file:"
      ? "Open a terminal in /Users/adhni/Desktop/whale-project and run: python3 -m http.server 8000. Then open http://localhost:8000/dashboard/."
      : "Run a local server from the repo root so the dashboard can fetch the processed files.";

  const message = `${error.message}. ${protocolHint}`;
  elements.statusPill.textContent = "Load failed";
  elements.trendNote.textContent = message;
  elements.groupRankings.innerHTML = `<p class="empty-state">${message}</p>`;
  elements.sourceList.innerHTML = `<p class="empty-state">${message}</p>`;
  elements.recentList.innerHTML = `<p class="empty-state">${message}</p>`;
  elements.mapLegend.innerHTML = `<p class="empty-state">${message}</p>`;
  elements.profileSummary.textContent = message;
  elements.filteredPoints.textContent = "-";
  elements.filteredYears.textContent = "-";
  elements.trendTooltip.classList.add("hidden");
  if (state.pointLayer) {
    state.pointLayer.remove();
  }
}

async function boot() {
  try {
    await renderDashboard();
  } catch (error) {
    renderLoadError(error);
  }
}

elements.reloadButton.addEventListener("click", boot);

boot();
