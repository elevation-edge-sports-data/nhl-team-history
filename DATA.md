# Data Sources & How to Load Real Data

## Current Status
- `playoff_results` → loaded from your existing `data.json` (real)
- `regular_season` → currently using a small real sample + mock for missing teams/seasons
- `team_advanced` → small real sample (MoneyPuck style) for recent years

## Expected CSV Formats

### data/regular_season.csv
```csv
season,team_abbr,gp,w,l,otl,pts,pts_pct,gf,ga,gd
2022,COL,82,56,19,7,119,0.726,312,234,78
...
```

### data/team_advanced.csv
```csv
season,team_abbr,xgf_pct,cf_pct,ff_pct
2022,COL,53.8,52.1,52.4
...
```

## Recommended Real Sources

### 1. Regular Season (full history 1918–2026)
Best free source: **Hockey Databank**  
https://github.com/rippinrobr/hockey-databank

File: `Teams.csv`

You will need to:
- Map their team abbreviations to your 59 franchise abbreviations (QUE, COL, WIN, WPG, etc. stay separate)
- Convert season format if needed
- Calculate `pts_pct = pts / (gp * 2)` and `gd = gf - ga`

### 2. Advanced Stats (2008+)
**MoneyPuck** free team data:  
https://moneypuck.com/data.htm

Download the team-level season files and extract `xGF%`, `CF%`, `FF%` (or equivalent columns).

## How the App Loads Data
On page load the app tries:

1. `data/regular_season.csv`
2. `data/team_advanced.csv`

If the CSVs exist → real data is used.  
If missing → falls back to the internal mock generator (so the table still works).

## Next Action for You
1. Download / build the two CSVs with real data (matching the exact column names above).
2. Place them in the `data/` folder.
3. Refresh the local server — the table will automatically switch to real data.

I can also provide a Python script that helps convert Hockey Databank + MoneyPuck files into the exact format if you want.
