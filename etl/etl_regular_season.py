import pandas as pd
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================

SOURCE_CSV = "data/raw/regular_season_raw.csv"
OUTPUT_PATH = Path("data/regular_season.csv")

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

print("Loading regular season raw data...")
df = pd.read_csv(SOURCE_CSV)

df = df[df["lgID"] == "NHL"].copy()

df = df.rename(columns={
    "year": "season_raw",
    "tmID": "source_abbr",
    "G": "gp",
    "W": "w",
    "L": "l",
    "T": "t",
    "OTL": "otl_raw",
    "Pts": "pts",
    "GF": "gf",
    "GA": "ga",
})

# Convert starting-year → ending-year (to match your project)
df["season"] = df["season_raw"] + 1

df["team_abbr"] = df["source_abbr"].map(ABBR_MAP)
df = df.dropna(subset=["team_abbr"])

df["otl"] = df["otl_raw"].fillna(0).astype(int)
df["gd"] = df["gf"] - df["ga"]
df["pts_pct"] = (df["pts"] / (df["gp"] * 2.0)).round(3)

final_cols = ["season", "team_abbr", "gp", "w", "l", "otl", "pts", "pts_pct", "gf", "ga", "gd"]
df_out = df[final_cols].sort_values(["season", "team_abbr"])

df_out.to_csv(OUTPUT_PATH, index=False)
print(f"✅ Created {OUTPUT_PATH} with {len(df_out)} rows")