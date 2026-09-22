# NHL Playoff Team Stats

**Live Demo:** [https://elevation-edge-sports-data.github.io/nhl-team-history/](https://elevation-edge-sports-data.github.io/nhl-team-history/)

Interactive historical NHL Stanley Cup Playoff statistics for every team, enhanced with regular season and advanced metrics joined via SQL.

Default team: **COL** (Colorado Avalanche).

## Table Structure

One wide table per team with four clear sections:

| Team | Regular Season | Playoffs | Advanced Stats (≈2008+) |
| --- | --- | --- | --- |
| Logo, Year | GP W L OTL PTS PTS% GF GA GD | Rank, Elim Order, Wins | xGF% CF% FF% |

- Regular season columns are fully populated for all seasons.
- Advanced stats show blank (—) before ~2008 (by design).
- Soft color coding separates the groups visually.
- Columns are sortable.

## Visualizations

All charts are powered by the full joined dataset (regular season + advanced + playoffs):

1. **Regular Season Form · Process Metrics · Playoff Results**  
   Multi-axis chart: PTS%, xGF%, CF% over time with Playoff Wins as bars. Tooltips also show Elim Rank and Goal Differential.

2. **Expected Goals Share vs Playoff Success**  
   Bubble chart of xGF% vs Playoff Wins. Bubble size is proportional to Regular Season PTS%. Color intensity indicates era.

3. **Playoff Wins Distribution (Team History)**  
   Frequency of playoff win totals. Hover any bar to see the average xGF% and CF% of the seasons that reached that win total.

4. **Modern Era Competitive Profile**  
   Radar chart of recent seasons (last 5 with advanced data) across PTS%, xGF%, CF%, FF%, scaled Playoff Wins, and scaled Goal Diff.

5. **Insights Strip**  
   Live KPIs: Stanley Cups, average PTS%/xGF% in Cup years, correlation (xGF% ↔ Playoff Wins), deep-run vs early-exit xGF%, and number of seasons with advanced stats.

## How SQL Is Used

Data lives in three normalized tables inside an in-browser SQLite database (sql.js):

```
playoff_results   -- elimination order / rank / wins
regular_season    -- full history 1918–2026
team_advanced     -- xGF%, CF%, FF% (modern era only)
```

## Local Testing

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Notes

- 59 distinct teams (QUE ≠ COL, WIN ≠ WPG, etc.).
- Regular season data and advanced metrics load preferentially from:
  - `data/regular_season.csv`
  - `data/team_advanced.csv`
- If those CSVs are missing, realistic mock data is generated so the table and charts still work.
- Logos remain the high-resolution curated collection.

## Related

[nhl-playoff-elimination-tracker](https://github.com/elevation-edge-sports-data/nhl-playoff-elimination-tracker)

---

Elevation Edge Sports Data
