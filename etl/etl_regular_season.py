#!/usr/bin/env python3
"""
Final Regular Season ETL
------------------------
Combines:
  - data/raw/regular_season_1918_2018_raw.csv   (historical)
  - data/raw/regular_season_20XX_raw.csv        (2019-2026 Excel exports)

Produces:
  data/regular_season.csv
"""

import pandas as pd
from pathlib import Path
import re
import sys

RAW_DIR = Path("data/raw")
OUTPUT_CSV = Path("data/regular_season.csv")

TEAM_ABBR_MAP = {
    # Modern / current teams
    "Anaheim Ducks": "ANA",
    "Arizona Coyotes": "ARI",
    "Boston Bruins": "BOS",
    "Buffalo Sabres": "BUF",
    "Calgary Flames": "CGY",
    "Carolina Hurricanes": "CAR",
    "Chicago Blackhawks": "CHI",
    "Colorado Avalanche": "COL",
    "Columbus Blue Jackets": "CBJ",
    "Dallas Stars": "DAL",
    "Detroit Red Wings": "DET",
    "Edmonton Oilers": "EDM",
    "Florida Panthers": "FLA",
    "Los Angeles Kings": "LAK",
    "Minnesota Wild": "MIN",
    "Montreal Canadiens": "MTL",
    "Nashville Predators": "NSH",
    "New Jersey Devils": "NJD",
    "New York Islanders": "NYI",
    "New York Rangers": "NYR",
    "Ottawa Senators": "OTT",
    "Philadelphia Flyers": "PHI",
    "Pittsburgh Penguins": "PIT",
    "San Jose Sharks": "SJS",
    "Seattle Kraken": "SEA",
    "St. Louis Blues": "STL",
    "Tampa Bay Lightning": "TBL",
    "Toronto Maple Leafs": "TOR",
    "Utah Hockey Club": "UTA",
    "Utah Mammoth": "UTA",
    "Vancouver Canucks": "VAN",
    "Vegas Golden Knights": "VGK",
    "Washington Capitals": "WSH",
    "Winnipeg Jets": "WPG",

    # Historical / defunct / renamed teams
    "Atlanta Flames": "AFM",
    "Atlanta Thrashers": "ATL",
    "Brooklyn Americans": "BRK",
    "California Golden Seals": "CGS",
    "Chicago Black Hawks": "CHI",
    "Cleveland Barons": "CLE",
    "Colorado Rockies": "CLR",
    "Detroit Cougars": "DCG",
    "Detroit Falcons": "DFL",
    "Hamilton Tigers": "HAM",
    "Hartford Whalers": "HFD",
    "Kansas City Scouts": "KCS",
    "Mighty Ducks of Anaheim": "ANA",
    "Minnesota North Stars": "MNS",
    "Montreal Maroons": "MMR",
    "Montreal Wanderers": "MWN",
    "New York Americans": "NYA",
    "Oakland Seals": "OAK",
    "Philadelphia Quakers": "QUA",
    "Phoenix Coyotes": "PHX",
    "Pittsburgh Pirates": "PIR",
    "Quebec Bulldogs": "QBD",
    "Quebec Nordiques": "QUE",
    "St. Louis Eagles": "SLE",
    "Toronto Arenas": "TAN",
    "Toronto St. Patricks": "TSP",
    "Winnipeg Jets (1979-1996)": "WIN",
}

def map_team(name: str) -> str | None:
    if pd.isna(name):
        return None
    name = str(name).strip().replace("*", "").strip()
    if name in TEAM_ABBR_MAP:
        return TEAM_ABBR_MAP[name]
    if len(name) <= 3 and name.isupper():
        return name
    print(f"  WARNING: unknown team '{name}' – skipped")
    return None

def load_historical() -> pd.DataFrame:
    path = RAW_DIR / "regular_season_1918_2018_raw.csv"
    if not path.exists():
        print("WARNING: historical file not found")
        return pd.DataFrame()

    df = pd.read_csv(path)
    if "lgID" in df.columns:
        df = df[df["lgID"] == "NHL"].copy()

    df = df.rename(columns={
        "year": "season",
        "name": "team_raw",
        "G": "gp",
        "W": "w",
        "L": "l",
        "OTL": "otl",
        "Pts": "pts",
        "GF": "gf",
        "GA": "ga",
    })

    # historical file stores the starting year; project uses ending year
    df["season"] = df["season"] + 1

    df["otl"] = df["otl"].fillna(0).astype(int)
    print(f"  Historical NHL: {len(df)} rows")
    return df[["season", "team_raw", "gp", "w", "l", "otl", "pts", "gf", "ga"]]

def load_recent_file(path: Path) -> pd.DataFrame:
    """Parse one Excel-exported Hockey-Reference standings CSV."""
    raw = pd.read_csv(path, header=None, dtype=str)

    rows = []
    for _, row in raw.iterrows():
        if len(row) < 9:
            continue
        gp_val = str(row[1]).strip()
        if not gp_val.replace(".0", "").isdigit():
            continue

        team = str(row[0]).strip()
        if not team or team.lower() in ("gp", "nan", ""):
            continue

        try:
            rows.append({
                "team_raw": team,
                "gp": int(float(row[1])),
                "w": int(float(row[2])),
                "l": int(float(row[3])),
                "otl": int(float(row[4])),
                "pts": int(float(row[5])),
                "gf": int(float(row[7])),
                "ga": int(float(row[8])),
            })
        except (ValueError, IndexError):
            continue

    return pd.DataFrame(rows)

def load_all_recent() -> pd.DataFrame:
    frames = []
    for path in sorted(RAW_DIR.glob("regular_season_20*_raw.csv")):
        m = re.search(r"regular_season_(\d{4})_raw", path.name)
        if not m:
            continue
        season = int(m.group(1))
        df = load_recent_file(path)
        if df.empty:
            print(f"  WARNING: no valid teams found in {path.name}")
            continue
        df.insert(0, "season", season)
        frames.append(df)
        print(f"  {path.name} → season {season} ({len(df)} teams)")
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)

def main():
    print("Loading historical...")
    hist = load_historical()

    print("\nLoading 2019-2026 Excel exports...")
    recent = load_all_recent()

    if hist.empty and recent.empty:
        sys.exit("No data found.")

    combined = pd.concat([hist, recent], ignore_index=True)
    print(f"\nTotal raw rows: {len(combined)}")

    combined["team_abbr"] = combined["team_raw"].apply(map_team)
    combined = combined[combined["team_abbr"].notna()].copy()

    combined["pts_pct"] = (combined["pts"] / (combined["gp"] * 2)).round(3)
    combined["gd"] = combined["gf"] - combined["ga"]

    final = combined[[
        "season", "team_abbr", "gp", "w", "l", "otl",
        "pts", "pts_pct", "gf", "ga", "gd"
    ]].sort_values(["season", "team_abbr"]).reset_index(drop=True)

    final.to_csv(OUTPUT_CSV, index=False)
    print(f"\nDone → {OUTPUT_CSV}  ({len(final)} rows)")

if __name__ == "__main__":
    main()