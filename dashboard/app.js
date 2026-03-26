const DATA_PATHS = {
  cleanSummary: "../data/processed/acartia-summary.json",
  aggregateSummary: "../data/processed/aggregate-summary.json",
  monthly: "../data/processed/monthly-group-totals.csv",
  groups: "../data/processed/group-summary.csv",
  map: "../data/processed/map-points.csv",
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
  selectedYear: "all",
  selectedGroup: "all",
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
  trendNote: document.getElementById("trendNote"),
  groupRankings: document.getElementById("groupRankings"),
  sourceList: document.getElementById("sourceList"),
  recentList: document.getElementById("recentList"),
  yearSelect: document.getElementById("yearSelect"),
  groupSelect: document.getElementById("groupSelect"),
  mapCanvas: document.getElementById("mapCanvas"),
  mapLegend: document.getElementById("mapLegend"),
  filteredPoints: document.getElementById("filteredPoints"),
  filteredYears: document.getElementById("filteredYears"),
};

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
  const months = [...new Set(monthlyRows.map((row) => row.created_month))].sort();
  const series = {};

  monthlyRows.forEach((row) => {
    if (!series[row.whale_group]) {
      series[row.whale_group] = {};
    }
    series[row.whale_group][row.created_month] = Number(row.total_sighted);
  });

  const rankedGroups = [...groupRows]
    .sort((a, b) => Number(b.total_sighted) - Number(a.total_sighted))
    .map((row) => row.whale_group);

  return { months, series, rankedGroups };
}

function renderStats(cleanSummary, aggregateSummary, monthlyRows, groupRows, mapRows) {
  const months = monthlyRows.map((row) => row.created_month).sort();
  elements.statCleanRows.textContent = formatNumber(cleanSummary.total_rows);
  elements.statMapRows.textContent = formatNumber(aggregateSummary.map_rows);
  elements.statGroups.textContent = formatNumber(groupRows.length);
  elements.statTimeSpan.textContent = months.length
    ? `${formatMonth(months[0])} to ${formatMonth(months[months.length - 1])}`
    : "No data";

  const invalidBits = [
    `${formatNumber(cleanSummary.invalid_counts)} invalid counts`,
    `${formatNumber(cleanSummary.invalid_dates)} invalid dates`,
    `${formatNumber(cleanSummary.invalid_coordinates)} invalid coordinates`,
  ];
  elements.statusPill.textContent = `Derived from ${formatNumber(mapRows.length)} mapped sightings • ${invalidBits.join(" • ")}`;
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
  const svg = elements.trendChart;
  const width = 960;
  const height = 360;
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

  const paths = visibleGroups
    .map((group) => {
      const values = trendData.months.map((month) => trendData.series[group]?.[month] || 0);
      const path = values
        .map((value, index) => `${index === 0 ? "M" : "L"} ${xForIndex(index)} ${yForValue(value)}`)
        .join(" ");
      const lastValue = values[values.length - 1];
      const labelX = width - padding.right + 12;
      const labelY = yForValue(lastValue);
      return `
        <path d="${path}" fill="none" stroke="${getColor(group)}" stroke-width="3" stroke-linecap="round" />
        <text x="${labelX}" y="${labelY + 4}" fill="${getColor(group)}" font-size="12">${group}</text>
      `;
    })
    .join("");

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    ${gridLines}
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgba(236,247,243,0.16)" />
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="rgba(236,247,243,0.16)" />
    ${paths}
    ${xLabels}
  `;

  elements.trendNote.textContent = `Showing ${visibleGroups.length} group${visibleGroups.length === 1 ? "" : "s"} across ${trendData.months.length} monthly points. Totals reflect positive sightings from 2018 onward.`;
}

function renderGroupRankings(groupRows) {
  const maxTotal = Math.max(...groupRows.map((row) => Number(row.total_sighted)), 1);
  const markup = [...groupRows]
    .sort((a, b) => Number(b.total_sighted) - Number(a.total_sighted))
    .map((row) => {
      const percent = (Number(row.total_sighted) / maxTotal) * 100;
      return `
        <article class="rank-card">
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
}

function renderSources(mapRows) {
  const counts = new Map();
  mapRows.forEach((row) => {
    const key = row.data_source_witness || row.data_source_name || "Unknown";
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
          <span class="recent-title">${row.species_normalized || "Unknown species"}</span>
          <span>${formatMonth(row.created_month)}</span>
        </div>
        <p class="recent-meta">
          ${row.whale_group} • ${formatNumber(row.no_sighted)} sighted • ${row.data_source_witness || row.data_source_name || "Unknown source"}
        </p>
      </article>
    `)
    .join("");
}

function renderMapControls(groupRows, mapRows) {
  const years = [...new Set(mapRows.map((row) => row.created_year).filter(Boolean))].sort();
  const groups = groupRows.map((row) => row.whale_group);

  elements.yearSelect.innerHTML = `<option value="all">All years</option>${years.map((year) => `<option value="${year}">${year}</option>`).join("")}`;
  elements.groupSelect.innerHTML = `<option value="all">All groups</option>${groups.map((group) => `<option value="${group}">${group}</option>`).join("")}`;

  state.selectedYear = years[years.length - 1] || "all";
  state.selectedGroup = "all";
  elements.yearSelect.value = state.selectedYear;
  elements.groupSelect.value = state.selectedGroup;

  elements.yearSelect.addEventListener("change", () => {
    state.selectedYear = elements.yearSelect.value;
    drawMap(mapRows);
  });

  elements.groupSelect.addEventListener("change", () => {
    state.selectedGroup = elements.groupSelect.value;
    drawMap(mapRows);
  });

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

function drawMap(mapRows) {
  const canvas = elements.mapCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 36;

  const filtered = mapRows.filter((row) => {
    const yearOk = state.selectedYear === "all" || row.created_year === state.selectedYear;
    const groupOk = state.selectedGroup === "all" || row.whale_group === state.selectedGroup;
    return yearOk && groupOk;
  });

  const allLats = mapRows.map((row) => Number(row.latitude));
  const allLons = mapRows.map((row) => Number(row.longitude));
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLon = Math.min(...allLons);
  const maxLon = Math.max(...allLons);

  const xForLon = (lon) => padding + ((lon - minLon) / (maxLon - minLon || 1)) * (width - padding * 2);
  const yForLat = (lat) => height - padding - ((lat - minLat) / (maxLat - minLat || 1)) * (height - padding * 2);

  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#113d4b");
  gradient.addColorStop(1, "#04161c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(171, 231, 226, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i += 1) {
    const y = padding + (i / 5) * (height - padding * 2);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }
  for (let i = 0; i < 7; i += 1) {
    const x = padding + (i / 6) * (width - padding * 2);
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height - padding);
    ctx.stroke();
  }

  filtered.forEach((row) => {
    const x = xForLon(Number(row.longitude));
    const y = yForLat(Number(row.latitude));
    const count = Number(row.no_sighted);
    const radius = Math.min(6, Math.max(1.4, Math.sqrt(count) * 0.45));
    const color = getColor(row.whale_group);

    ctx.beginPath();
    ctx.fillStyle = `${color}66`;
    ctx.arc(x, y, radius + 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "rgba(236,247,243,0.88)";
  ctx.font = '600 13px "Trebuchet MS", sans-serif';
  ctx.fillText("Longitude", width / 2 - 28, height - 12);
  ctx.save();
  ctx.translate(12, height / 2 + 30);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Latitude", 0, 0);
  ctx.restore();

  elements.filteredPoints.textContent = formatNumber(filtered.length);
  const yearLabel = state.selectedYear === "all" ? "All" : state.selectedYear;
  elements.filteredYears.textContent = yearLabel;
}

async function renderDashboard() {
  elements.statusPill.textContent = "Loading data";

  const [cleanSummary, aggregateSummary, monthlyRows, groupRows, mapRows] = await Promise.all([
    loadJson(DATA_PATHS.cleanSummary),
    loadJson(DATA_PATHS.aggregateSummary),
    loadCsv(DATA_PATHS.monthly),
    loadCsv(DATA_PATHS.groups),
    loadCsv(DATA_PATHS.map),
  ]);

  renderStats(cleanSummary, aggregateSummary, monthlyRows, groupRows, mapRows);
  const trendData = buildTrendData(monthlyRows, groupRows);
  renderTrendLegend(trendData);
  renderTrendChart(trendData);
  renderGroupRankings(groupRows);
  renderSources(mapRows);
  renderRecent(mapRows);
  renderMapControls(groupRows, mapRows);
  drawMap(mapRows);
  elements.statusPill.textContent = "Dashboard ready";
}

async function boot() {
  try {
    await renderDashboard();
  } catch (error) {
    elements.statusPill.textContent = "Load failed";
    elements.groupRankings.innerHTML = `<p class="empty-state">${error.message}. Run a local server from the repo root so the dashboard can fetch the processed files.</p>`;
  }
}

elements.reloadButton.addEventListener("click", boot);

boot();
