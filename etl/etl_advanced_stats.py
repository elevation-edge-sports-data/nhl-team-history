import pandas as pd
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================

SOURCE_CSV = "data/raw/advanced_stats_raw.csv"
OUTPUT_PATH = Path("data/advanced_stats.csv")

ABBR_MAP = {
    # Current teams (32)
    "ANA": "ANA",
    "ARI": "ARI",
    "BOS": "BOS",
    "BUF": "BUF",
    "CAR": "CAR",
    "CHI": "CHI",
    "COL": "COL",
    "DAL": "DAL",
    "DET": "DET",
    "EDM": "EDM",
    "FLO": "FLA",
    "LAK": "LAK",
    "MIN": "MIN",
    "MTL": "MTL",
    "NJD": "NJD",
    "NYI": "NYI",
    "NYR": "NYR",
    "OTT": "OTT",
    "PHI": "PHI",
    "PIT": "PIT",
    "SEA": "SEA",
    "SJS": "SJS",
    "STL": "STL",
    "TBL": "TBL",
    "TOR": "TOR",
    "VAN": "VAN",
    "VEG": "VGK",
    "WAS": "WSH",
    "WPG": "WPG",
    "CBS": "CBJ",
    "UTA": "UTA",

    # Historical teams (27)
    "ATL": "ATL",
    "QUE": "QUE",
    "HAR": "HFD",
    "WIN": "WIN",
    "PHO": "PHX",
    "ATF": "AFM",
    "DTC": "DCG",
    "DTF": "DFL",
    "MTM": "MMR",
    "NYA": "NYA",
    "BKN": "BRK",
    "HAM": "HAM",
    "OAK": "OAK",
    "KCS": "KCS",
    "CLE": "CLE",
    "MNS": "MNS",
    "CLR": "CLR",
    "CGS": "CGS",
    "SEN": "SEN",
    "PIR": "PIR",
    "QBD": "QBD",
    "QUA": "QUA",
    "SLE": "SLE",
    "TAN": "TAN",
    "TSP": "TSP",
    "WIN": "WIN",
    "AFM": "AFM",
}

# ============================================================
# BUILD
# ============================================================

print("Loading advanced stats raw data...")
df = pd.read_csv(SOURCE_CSV)

# Keep only overall team stats
df = df[df["situation"] == "all"].copy()

df = df.rename(columns={
    "season": "season_raw",
    "team": "source_abbr",
    "xGoalsPercentage": "xgf_pct",
    "corsiPercentage": "cf_pct",
    "fenwickPercentage": "ff_pct",
})

# Convert from decimal (0.51) to percentage (51.2)
df["xgf_pct"] = (df["xgf_pct"] * 100).round(1)
df["cf_pct"]  = (df["cf_pct"]  * 100).round(1)
df["ff_pct"]  = (df["ff_pct"]  * 100).round(1)

# Convert MoneyPuck starting-year → your ending-year convention
df["season"] = df["season_raw"] + 1

df["team_abbr"] = df["source_abbr"].map(ABBR_MAP)
df = df.dropna(subset=["team_abbr"])

final_cols = ["season", "team_abbr", "xgf_pct", "cf_pct", "ff_pct"]
df_out = df[final_cols].sort_values(["season", "team_abbr"])

df_out.to_csv(OUTPUT_PATH, index=False)
print(f"✅ Created {OUTPUT_PATH} with {len(df_out)} rows")