-- NHL Playoff Team Stats - SQL Schema & Queries
-- Three tables joined into one wide view for the UI

-- ========== SCHEMA ==========
CREATE TABLE playoff_results (
    season INTEGER NOT NULL,
    team_abbr TEXT NOT NULL,
    elim_order INTEGER,
    elim_rank INTEGER,
    playoff_wins INTEGER,
    PRIMARY KEY (season, team_abbr)
);

CREATE TABLE regular_season (
    season INTEGER NOT NULL,
    team_abbr TEXT NOT NULL,
    gp INTEGER,
    w INTEGER,
    l INTEGER,
    otl INTEGER,
    pts INTEGER,
    pts_pct REAL,
    gf INTEGER,
    ga INTEGER,
    gd INTEGER,
    PRIMARY KEY (season, team_abbr)
);

CREATE TABLE team_advanced (
    season INTEGER NOT NULL,
    team_abbr TEXT NOT NULL,
    xgf_pct REAL,   -- Expected Goals For %
    cf_pct REAL,    -- Corsi For %
    ff_pct REAL,    -- Fenwick For %
    PRIMARY KEY (season, team_abbr)
);  -- Only populated ~2008 onward

-- ========== WIDE VIEW (what the table uses) ==========
-- Note: in sql.js we run the SELECT directly rather than CREATE VIEW
SELECT 
    p.season AS year,
    r.gp AS rs_gp, r.w AS rs_w, r.l AS rs_l, r.otl AS rs_otl,
    r.pts AS rs_pts, r.pts_pct AS rs_pts_pct,
    r.gf AS rs_gf, r.ga AS rs_ga, r.gd AS rs_gd,
    p.elim_rank, p.elim_order, p.playoff_wins,
    a.xgf_pct, a.cf_pct, a.ff_pct
FROM playoff_results p
LEFT JOIN regular_season r 
    ON p.season = r.season AND p.team_abbr = r.team_abbr
LEFT JOIN team_advanced a 
    ON p.season = a.season AND p.team_abbr = a.team_abbr
WHERE p.team_abbr = ?
ORDER BY year DESC;

-- ========== EXAMPLE ANALYTICS ==========
-- Regular season strength vs playoff success
SELECT 
    ROUND(AVG(r.pts_pct), 3) AS avg_pts_pct,
    ROUND(AVG(p.playoff_wins), 2) AS avg_playoff_wins,
    ROUND(AVG(p.elim_rank), 2) AS avg_elim_rank
FROM playoff_results p
JOIN regular_season r ON p.season = r.season AND p.team_abbr = r.team_abbr
WHERE p.team_abbr = ?;

-- Modern era only (with advanced stats)
SELECT 
    p.season, r.pts_pct, a.xgf_pct, a.cf_pct, p.playoff_wins
FROM playoff_results p
JOIN regular_season r ON p.season = r.season AND p.team_abbr = r.team_abbr
JOIN team_advanced a ON p.season = a.season AND p.team_abbr = a.team_abbr
WHERE p.team_abbr = ?
ORDER BY p.season;
