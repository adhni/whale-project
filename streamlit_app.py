from __future__ import annotations

from pathlib import Path
import sys

import altair as alt
import pandas as pd
import pydeck as pdk
import streamlit as st

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from whales.aggregate import run as aggregate_run
from whales.clean import run as clean_run

DATA_DIR = ROOT / "data"
RAW_PATH = DATA_DIR / "raw" / "acartia-export.csv"
CLEAN_PATH = DATA_DIR / "processed" / "acartia-clean.csv"
CLEAN_SUMMARY_PATH = DATA_DIR / "processed" / "acartia-summary.json"
MAP_PATH = DATA_DIR / "processed" / "map-points.csv"
WEB_MAP_PATH = DATA_DIR / "processed" / "map-points-web.json"
MONTHLY_PATH = DATA_DIR / "processed" / "monthly-group-totals.csv"
GROUP_PATH = DATA_DIR / "processed" / "group-summary.csv"
AGG_SUMMARY_PATH = DATA_DIR / "processed" / "aggregate-summary.json"
DASHBOARD_MIN_YEAR = 2000


st.set_page_config(
    page_title="Whale Watch Atlas",
    page_icon="🐋",
    layout="wide",
)


def ensure_processed_data() -> None:
    if all(path.exists() for path in (CLEAN_PATH, CLEAN_SUMMARY_PATH, MAP_PATH, MONTHLY_PATH, GROUP_PATH, AGG_SUMMARY_PATH)):
        return

    clean_run(RAW_PATH, CLEAN_PATH, CLEAN_SUMMARY_PATH)
    aggregate_run(
        input_path=CLEAN_PATH,
        map_output_path=MAP_PATH,
        web_map_output_path=WEB_MAP_PATH,
        monthly_output_path=MONTHLY_PATH,
        group_output_path=GROUP_PATH,
        summary_output_path=AGG_SUMMARY_PATH,
        min_year=2018,
    )


@st.cache_data(show_spinner=False)
def load_data() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    ensure_processed_data()
    map_df = pd.read_csv(MAP_PATH)
    monthly_df = pd.read_csv(MONTHLY_PATH)
    group_df = pd.read_csv(GROUP_PATH)

    map_df = map_df[map_df["created_year"] >= DASHBOARD_MIN_YEAR].copy()
    monthly_df["created_month"] = pd.to_datetime(monthly_df["created_month"] + "-01")
    return map_df, monthly_df, group_df


def format_count(value: float | int) -> str:
    return f"{int(value):,}"


def main() -> None:
    st.title("Whale Watch Atlas")
    st.caption("Streamlit deployment view for the whale sightings pipeline.")

    map_df, monthly_df, group_df = load_data()

    years = sorted(map_df["created_year"].dropna().astype(int).unique().tolist())
    groups = sorted(map_df["whale_group"].dropna().unique().tolist())
    sources = sorted(map_df["source_normalized"].dropna().unique().tolist())
    regions = sorted(map_df["region"].dropna().unique().tolist())

    st.sidebar.header("Filters")
    selected_year = st.sidebar.select_slider(
        "Year window",
        options=["All years", *years],
        value="All years",
    )
    selected_group = st.sidebar.selectbox("Group", ["All groups", *groups], index=0)
    selected_source = st.sidebar.selectbox("Source", ["All sources", *sources], index=0)
    selected_region = st.sidebar.selectbox("Region", ["All regions", *regions], index=0)

    filtered_map = map_df.copy()
    if selected_year != "All years":
        filtered_map = filtered_map[filtered_map["created_year"] == selected_year]
    if selected_group != "All groups":
        filtered_map = filtered_map[filtered_map["whale_group"] == selected_group]
    if selected_source != "All sources":
        filtered_map = filtered_map[filtered_map["source_normalized"] == selected_source]
    if selected_region != "All regions":
        filtered_map = filtered_map[filtered_map["region"] == selected_region]

    filtered_monthly = monthly_df.copy()
    if selected_source != "All sources":
        filtered_monthly = filtered_monthly[filtered_monthly["source_label"] == selected_source]

    monthly_grouped = (
        filtered_monthly.groupby(["created_month", "whale_group"], as_index=False)["total_sighted"].sum()
    )
    source_counts = (
        filtered_map.groupby("source_normalized", as_index=False)
        .size()
        .rename(columns={"size": "rows"})
        .sort_values("rows", ascending=False)
        .head(8)
    )
    recent = filtered_map.sort_values("created_iso", ascending=False).head(12)
    group_snapshot = group_df.sort_values("total_sighted", ascending=False).head(8)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Mapped sightings", format_count(len(filtered_map)))
    c2.metric("Groups", format_count(filtered_map["whale_group"].nunique()))
    c3.metric("Sources", format_count(filtered_map["source_normalized"].nunique()))
    c4.metric("Regions", format_count(filtered_map["region"].nunique()))

    left, right = st.columns([1.45, 0.95])

    with left:
        st.subheader("Monthly sightings by whale group")
        trend = (
            alt.Chart(monthly_grouped)
            .mark_line(point=True)
            .encode(
                x=alt.X("created_month:T", title="Month"),
                y=alt.Y("total_sighted:Q", title="Sightings"),
                color=alt.Color("whale_group:N", title="Whale group"),
                tooltip=[
                    alt.Tooltip("created_month:T", title="Month"),
                    alt.Tooltip("whale_group:N", title="Group"),
                    alt.Tooltip("total_sighted:Q", title="Sightings", format=","),
                ],
            )
            .properties(height=420)
        )
        st.altair_chart(trend, use_container_width=True)

    with right:
        st.subheader("Group snapshot")
        snapshot = group_snapshot[["whale_group", "total_sighted", "top_species"]].copy()
        snapshot["total_sighted"] = snapshot["total_sighted"].map(format_count)
        st.dataframe(snapshot, hide_index=True, use_container_width=True)

    st.subheader("Map")
    if filtered_map.empty:
        st.info("No sightings match the current filters.")
    else:
        deck_df = filtered_map.copy()
        deck_df["radius"] = deck_df["no_sighted"].clip(lower=1).pow(0.5) * 5000
        layer = pdk.Layer(
            "ScatterplotLayer",
            data=deck_df,
            get_position="[longitude, latitude]",
            get_fill_color="[124, 224, 205, 120]",
            get_line_color="[236, 247, 243, 200]",
            get_radius="radius",
            pickable=True,
            stroked=True,
            line_width_min_pixels=1,
        )
        view_state = pdk.ViewState(
            latitude=float(deck_df["latitude"].mean()),
            longitude=float(deck_df["longitude"].mean()),
            zoom=2.8,
            pitch=0,
        )
        tooltip = {
            "html": "<b>{species_normalized}</b><br/>{whale_group}<br/>{source_normalized}<br/>{region}<br/>{no_sighted} sighted",
            "style": {"backgroundColor": "#041c24", "color": "#ecf7f3"},
        }
        st.pydeck_chart(pdk.Deck(layers=[layer], initial_view_state=view_state, tooltip=tooltip))

    lower_left, lower_right = st.columns([1, 1])

    with lower_left:
        st.subheader("Source concentration")
        st.bar_chart(source_counts.set_index("source_normalized"))

    with lower_right:
        st.subheader("Recent sightings")
        recent_view = recent[
            ["created_iso", "species_normalized", "whale_group", "source_normalized", "region", "no_sighted"]
        ].copy()
        recent_view = recent_view.rename(
            columns={
                "created_iso": "timestamp",
                "species_normalized": "species",
                "whale_group": "group",
                "source_normalized": "source",
                "no_sighted": "count",
            }
        )
        st.dataframe(recent_view, hide_index=True, use_container_width=True)


if __name__ == "__main__":
    main()
