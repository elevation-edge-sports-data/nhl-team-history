# NHL Playoff Team Stats

**Live Demo:** https://elevation-edge-sports-data.github.io/nhl-playoff-team-stats/

Interactive historical NHL Stanley Cup Playoff statistics for every franchise, now with **regular season** and **advanced metrics** joined via SQL.

Default team: **COL**.

## Table Structure

One wide table per franchise with three clear sections:

| Identity     | Regular Season                  | Playoffs                  | Advanced Stats (2008+) |
|--------------|---------------------------------|---------------------------|------------------------|
| Logo, Year   | GP W L OTL PTS PTS% GF GA GD   | Rank, Elim Order, Wins    | xGF%  CF%  FF%         |

- Regular season columns are fully populated for all seasons.
- Advanced stats show blank (—) before ~2008 (by design).
- Soft color coding separates the three groups visually.

## How SQL Is Used

Data lives in three normalized tables inside an in-browser SQLite database (sql.js):

```sql
playoff_results   -- original elim order / rank / wins
regular_season    -- full history 1918–2026
team_advanced     -- xGF%, CF%, FF% (modern era only)
```

All table rendering and future analytics are driven by `LEFT JOIN` queries.

## Local Testing

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Notes

- 59 distinct franchises (QUE ≠ COL, WIN ≠ WPG, etc.).
- Regular season data is currently generated with realistic mock values so the table structure and joins work.  
  Real historical regular-season + MoneyPuck advanced data will replace the mock layer next.
- Logos remain the high-resolution curated collection.

## Related
[nhl-playoff-elimination-tracker](https://github.com/elevation-edge-sports-data/nhl-playoff-elimination-tracker)

---
Elevation Edge Sports Data

## Real Data Loading

See **[DATA.md](DATA.md)** for how to replace the mock regular-season and advanced stats with real historical data.

The app automatically prefers:
- `data/regular_season.csv`
- `data/team_advanced.csv`

If those files exist, real data is used. Otherwise it falls back to realistic mock data so the table still works.
