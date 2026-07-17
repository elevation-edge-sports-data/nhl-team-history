document.addEventListener('DOMContentLoaded', () => {
    console.log('SQL-powered NHL Playoff Team Stats initialized');

    // ===== PLAYOFF FIELD SIZE LOOKUP (confirmed 1918–present) =====
    function getPlayoffFieldSize(year) {
        if (year >= 1980) return 16;
        if (year >= 1975) return 12;
        if (year >= 1968) return 8;
        if (year >= 1943) return 4;
        if (year >= 1927) return 6;
        if (year === 1926) return 3;
        if (year >= 1918) return 2;
        return 16;
    }

    const teamNames = {
        'AFM': 'Atlanta Flames', 'ANA': 'Anaheim Ducks', 'ARI': 'Arizona Coyotes',
        'ATL': 'Atlanta Thrashers', 'BOS': 'Boston Bruins', 'BRK': 'Brooklyn Americans',
        'BUF': 'Buffalo Sabres', 'CAR': 'Carolina Hurricanes', 'CBJ': 'Columbus Blue Jackets',
        'CGS': 'California Golden Seals', 'CGY': 'Calgary Flames', 'CHI': 'Chicago Blackhawks',
        'CLE': 'Cleveland Barons', 'CLR': 'Colorado Rockies', 'COL': 'Colorado Avalanche',
        'DAL': 'Dallas Stars', 'DCG': 'Detroit Cougars', 'DET': 'Detroit Red Wings',
        'DFL': 'Detroit Falcons', 'EDM': 'Edmonton Oilers', 'FLA': 'Florida Panthers',
        'HAM': 'Hamilton Tigers', 'HFD': 'Hartford Whalers', 'KCS': 'Kansas City Scouts',
        'LAK': 'Los Angeles Kings', 'MIN': 'Minnesota Wild', 'MMR': 'Montreal Maroons',
        'MNS': 'Minnesota North Stars', 'MTL': 'Montreal Canadiens', 'MWN': 'Montreal Wanderers',
        'NJD': 'New Jersey Devils', 'NSH': 'Nashville Predators', 'NYA': 'New York Americans',
        'NYI': 'New York Islanders', 'NYR': 'New York Rangers', 'OAK': 'Oakland Seals',
        'OTT': 'Ottawa Senators', 'PHI': 'Philadelphia Flyers', 'PHX': 'Phoenix Coyotes',
        'PIR': 'Pittsburgh Pirates', 'PIT': 'Pittsburgh Penguins', 'QBD': 'Quebec Bulldogs',
        'QUA': 'Philadelphia Quakers', 'QUE': 'Quebec Nordiques', 'SEA': 'Seattle Kraken',
        'SEN': 'Ottawa Senators (Original)', 'SJS': 'San Jose Sharks', 'SLE': 'St. Louis Eagles',
        'STL': 'St. Louis Blues', 'TAN': 'Toronto Arenas', 'TBL': 'Tampa Bay Lightning',
        'TOR': 'Toronto Maple Leafs', 'TSP': 'Toronto St. Patricks', 'UTA': 'Utah Hockey Club',
        'VAN': 'Vancouver Canucks', 'VGK': 'Vegas Golden Knights', 'WIN': 'Winnipeg Jets (Original)',
        'WPG': 'Winnipeg Jets', 'WSH': 'Washington Capitals'
    };

    let data = {};
    let teamColors = {}, teamSecondaryColors = {}, teamTertiaryColors = {};
    let teamQuaternaryColors = {}, teamQuinaryColors = {};
    let uniqueLogos = {};
    let sortColumn = 'year';
    let sortDirection = 'desc';
    let db = null;

    const defaultColors = { c1: '#111111', c2: '#A4A9AD', c3: '#A4A9AD', c4: '#111111', c5: '#A4A9AD' };
    const isGitHubPages = window.location.hostname.includes('github.io');
    const basePaths = isGitHubPages ? ['/nhl-playoff-team-stats/', '/', '/elevation-edge-sports-data/', '/docs/'] : [''];

    async function tryFetch(filePath, paths = basePaths) {
        for (const base of paths) {
            const url = `${base}${filePath}`;
            try {
                const response = await fetch(url);
                if (response.ok) {
                    if (!window.basePath) window.basePath = base;
                    return { response, base };
                }
            } catch (e) {}
        }
        return null;
    }

    function getProperty(obj, prop) {
        if (!obj || typeof obj !== 'object') return undefined;
        const key = Object.keys(obj).find(k => k.toLowerCase() === prop.toLowerCase());
        return key ? obj[key] : undefined;
    }

    function parseCSV(text) {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const vals = line.split(',');
            const obj = {};
            headers.forEach((h, i) => obj[h] = vals[i] !== undefined ? vals[i].trim() : '');
            return obj;
        });
    }

    async function initSQL(jsonData) {
        if (typeof initSqlJs === 'undefined') {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
        });
        db = new SQL.Database();

        db.run(`
            CREATE TABLE playoff_results (
                season INTEGER NOT NULL, team_abbr TEXT NOT NULL,
                elim_order INTEGER, elim_rank INTEGER, playoff_wins INTEGER,
                PRIMARY KEY (season, team_abbr)
            );
            CREATE TABLE regular_season (
                season INTEGER NOT NULL, team_abbr TEXT NOT NULL,
                gp INTEGER, w INTEGER, l INTEGER, otl INTEGER,
                pts INTEGER, pts_pct REAL, gf INTEGER, ga INTEGER, gd INTEGER,
                PRIMARY KEY (season, team_abbr)
            );
            CREATE TABLE team_advanced (
                season INTEGER NOT NULL, team_abbr TEXT NOT NULL,
                xgf_pct REAL, cf_pct REAL, ff_pct REAL,
                PRIMARY KEY (season, team_abbr)
            );
            CREATE INDEX idx_pr_team ON playoff_results(team_abbr);
            CREATE INDEX idx_rs_team ON regular_season(team_abbr);
            CREATE INDEX idx_adv_team ON team_advanced(team_abbr);
        `);

        // 1. Playoff data from data.json
        const insertPlayoff = db.prepare(
            `INSERT OR REPLACE INTO playoff_results (season, team_abbr, elim_order, elim_rank, playoff_wins) VALUES (?,?,?,?,?)`
        );
        Object.entries(jsonData).forEach(([year, yearData]) => {
            if (!Array.isArray(yearData)) return;
            yearData.forEach(entry => {
                if (!entry || !entry.team) return;
                insertPlayoff.run([
                    parseInt(year),
                    entry.team,
                    getProperty(entry, 'elim order') ?? null,
                    getProperty(entry, 'elim rank') ?? null,
                    getProperty(entry, 'playoff wins') ?? 0
                ]);
            });
        });
        insertPlayoff.free();

        // 2. Regular season CSV (real data only)
        const rsFetch = await tryFetch('data/regular_season.csv');
        if (rsFetch) {
            try {
                const text = await rsFetch.response.text();
                const rows = parseCSV(text);
                const insertRS = db.prepare(
                    `INSERT OR REPLACE INTO regular_season 
                     (season, team_abbr, gp, w, l, otl, pts, pts_pct, gf, ga, gd) 
                     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
                );
                rows.forEach(r => {
                    if (!r.season || !r.team_abbr) return;
                    insertRS.run([
                        parseInt(r.season), r.team_abbr,
                        parseInt(r.gp) || null, parseInt(r.w) || null, parseInt(r.l) || null, parseInt(r.otl) || null,
                        parseInt(r.pts) || null, parseFloat(r.pts_pct) || null,
                        parseInt(r.gf) || null, parseInt(r.ga) || null, parseInt(r.gd) || null
                    ]);
                });
                insertRS.free();
            } catch (e) { console.warn('regular_season.csv parse error', e); }
        }

        // 3. Advanced stats CSV (real data only)
        let advFetch = await tryFetch('data/team_advanced.csv');
        if (!advFetch) advFetch = await tryFetch('data/advanced_stats.csv');
        if (advFetch) {
            try {
                const text = await advFetch.response.text();
                const rows = parseCSV(text);
                const insertAdv = db.prepare(
                    `INSERT OR REPLACE INTO team_advanced (season, team_abbr, xgf_pct, cf_pct, ff_pct) VALUES (?,?,?,?,?)`
                );
                rows.forEach(r => {
                    if (!r.season || !r.team_abbr) return;
                    insertAdv.run([
                        parseInt(r.season), r.team_abbr,
                        parseFloat(r.xgf_pct) || null,
                        parseFloat(r.cf_pct) || null,
                        parseFloat(r.ff_pct) || null
                    ]);
                });
                insertAdv.free();
            } catch (e) { console.warn('advanced CSV parse error', e); }
        }

        // No mock / synthetic data generation of any kind

        const counts = db.exec(`SELECT (SELECT COUNT(*) FROM playoff_results), (SELECT COUNT(*) FROM regular_season), (SELECT COUNT(*) FROM team_advanced)`)[0].values[0];
        console.log(`SQL ready → playoffs: ${counts[0]} | regular_season: ${counts[1]} | advanced: ${counts[2]}`);
    }

    function runQuery(sql, params = []) {
        if (!db) return [];
        try {
            const stmt = db.prepare(sql);
            if (params.length) stmt.bind(params);
            const results = [];
            while (stmt.step()) results.push(stmt.getAsObject());
            stmt.free();
            return results;
        } catch (e) {
            console.error('SQL error:', e.message);
            return [];
        }
    }

    // ===== LOAD =====
    tryFetch('NHLteamcolors.json')
        .then(r => r ? r.response.json() : [])
        .then(colorData => {
            if (Array.isArray(colorData)) {
                colorData.forEach(entry => {
                    if (entry.team) {
                        teamColors[entry.team] = entry.c1 || defaultColors.c1;
                        teamSecondaryColors[entry.team] = entry.c2 || defaultColors.c2;
                        teamTertiaryColors[entry.team] = entry.c3 || defaultColors.c3;
                        teamQuaternaryColors[entry.team] = entry.c4 || defaultColors.c4;
                        teamQuinaryColors[entry.team] = entry.c5 || defaultColors.c5;
                    }
                });
            }
            return tryFetch('uniquelogos.json');
        })
        .then(r => r ? r.response.json() : [])
        .then(logoData => {
            if (Array.isArray(logoData)) {
                logoData.forEach(entry => {
                    if (entry.team) {
                        uniqueLogos[entry.team] = [];
                        for (let key in entry) {
                            if (key.startsWith('Column') && entry[key]) uniqueLogos[entry.team].push(entry[key]);
                        }
                    }
                });
            }
            return tryFetch('data.json');
        })
        .then(r => r ? r.response.json() : {})
        .then(async jsonData => {
            data = jsonData || {};
            await initSQL(data);
            populateTeamSelector();
            const sel = document.getElementById('teamSelector');
            if (sel) {
                sel.value = 'COL';
                updateVisualization();
            }
        })
        .catch(err => {
            console.error(err);
            alert('Failed to load core data files.');
        });

    function populateTeamSelector() {
        const teams = new Set();
        Object.values(data).forEach(yearData => {
            if (Array.isArray(yearData)) yearData.forEach(e => { if (e && e.team) teams.add(e.team); });
        });
        if (teams.size === 0) Object.keys(teamNames).forEach(t => teams.add(t));

        const selector = document.getElementById('teamSelector');
        if (!selector) return;
        selector.innerHTML = '<option value="">Select a team</option>';
        Array.from(teams).sort().forEach(team => {
            const opt = document.createElement('option');
            opt.value = team;
            opt.textContent = team;
            selector.appendChild(opt);
        });
    }

    window.updateVisualization = function () {
        const team = document.getElementById('teamSelector').value;
        const teamNameEl = document.getElementById('teamName');
        const teamAbbrEl = document.getElementById('teamAbbreviation');
        const logosEl = document.getElementById('teamLogos');

        document.body.style.backgroundColor = defaultColors.c1;
        document.querySelector('h1.header').style.color = defaultColors.c2;
        document.querySelector('.team-header').style.color = defaultColors.c2;

        if (!team) {
            teamNameEl.textContent = '';
            teamAbbrEl.textContent = '';
            logosEl.innerHTML = '';
            document.querySelector('#teamDataTable tbody').innerHTML = '';
            ['trendChart', 'scatterChart', 'playoffWinsHistogram', 'radarChart'].forEach(id => {
                const c = Chart.getChart(id); if (c) c.destroy();
            });
            document.getElementById('insightsPanel').innerHTML = '';
            return;
        }

        teamNameEl.textContent = teamNames[team] || team;
        teamAbbrEl.textContent = team;
        logosEl.innerHTML = '';
        (uniqueLogos[team] || []).map(y => parseInt(y)).sort((a,b)=>a-b).forEach(year => {
            const img = document.createElement('img');
            img.src = `${window.basePath || ''}logos/NHL${year}/${team}.png`;
            img.className = 'team-logo';
            img.style.borderColor = teamTertiaryColors[team] || '#fff';
            img.onerror = () => img.style.display = 'none';
            logosEl.appendChild(img);
        });

        const primary    = (teamColors[team] && /^#[0-9A-F]{6}$/i.test(teamColors[team])) ? teamColors[team] : defaultColors.c1;
        const secondary  = (teamSecondaryColors[team] && /^#[0-9A-F]{6}$/i.test(teamSecondaryColors[team])) ? teamSecondaryColors[team] : defaultColors.c2;
        const quaternary = (teamQuaternaryColors[team] && /^#[0-9A-F]{6}$/i.test(teamQuaternaryColors[team])) ? teamQuaternaryColors[team] : defaultColors.c4;

        document.body.style.backgroundColor = primary;
        document.querySelector('h1.header').style.color = secondary;
        document.querySelector('.team-header').style.color = secondary;

        const orderMap = {
            year: 'year', rs_gp: 'rs_gp', rs_w: 'rs_w', rs_l: 'rs_l', rs_otl: 'rs_otl',
            rs_pts: 'rs_pts', rs_pts_pct: 'rs_pts_pct', rs_gf: 'rs_gf', rs_ga: 'rs_ga', rs_gd: 'rs_gd',
            elim_rank: 'elim_rank', elim_order: 'elim_order', playoff_wins: 'playoff_wins',
            xgf_pct: 'xgf_pct', cf_pct: 'cf_pct', ff_pct: 'ff_pct'
        };
        const col = orderMap[sortColumn] || 'year';
        const dir = sortDirection === 'asc' ? 'ASC' : 'DESC';

        const sql = `
            SELECT 
                p.season AS year, p.team_abbr,
                r.gp AS rs_gp, r.w AS rs_w, r.l AS rs_l, r.otl AS rs_otl,
                r.pts AS rs_pts, r.pts_pct AS rs_pts_pct,
                r.gf AS rs_gf, r.ga AS rs_ga, r.gd AS rs_gd,
                p.elim_rank, p.elim_order, p.playoff_wins,
                a.xgf_pct, a.cf_pct, a.ff_pct
            FROM playoff_results p
            LEFT JOIN regular_season r ON p.season = r.season AND p.team_abbr = r.team_abbr
            LEFT JOIN team_advanced a ON p.season = a.season AND p.team_abbr = a.team_abbr
            WHERE p.team_abbr = ?
            ORDER BY ${col} ${dir}
        `;
        const rows = runQuery(sql, [team]);

        // ===== TABLE =====
        const tbody = document.querySelector('#teamDataTable tbody');
        tbody.innerHTML = '';
        const fmt = (v) => (v == null || v === '') ? '<span class="null-value">—</span>' : v;
        const fmtPct = (v) => (v == null) ? '<span class="null-value">—</span>' : (Number(v) * 100).toFixed(1) + '%';
        const fmtAdv = (v) => (v == null) ? '<span class="null-value">—</span>' : Number(v).toFixed(1);

        rows.forEach(r => {
            const tr = document.createElement('tr');
            const logoSrc = `${window.basePath || ''}logos/NHL${r.year}/${team}.png`;
            tr.innerHTML = `
                <td class="sticky-col"><img class="logo-img" src="${logoSrc}" onerror="this.style.display='none'"></td>
                <td class="sticky-col">${r.year}</td>
                <td class="group-regular">${fmt(r.rs_gp)}</td>
                <td class="group-regular">${fmt(r.rs_w)}</td>
                <td class="group-regular">${fmt(r.rs_l)}</td>
                <td class="group-regular">${fmt(r.rs_otl)}</td>
                <td class="group-regular">${fmt(r.rs_pts)}</td>
                <td class="group-regular">${fmtPct(r.rs_pts_pct)}</td>
                <td class="group-regular">${fmt(r.rs_gf)}</td>
                <td class="group-regular">${fmt(r.rs_ga)}</td>
                <td class="group-regular">${fmt(r.rs_gd)}</td>
                <td class="group-playoffs">${fmt(r.elim_rank)}</td>
                <td class="group-playoffs">${fmt(r.elim_order)}</td>
                <td class="group-playoffs">${fmt(r.playoff_wins)}</td>
                <td class="group-advanced">${fmtAdv(r.xgf_pct)}</td>
                <td class="group-advanced">${fmtAdv(r.cf_pct)}</td>
                <td class="group-advanced">${fmtAdv(r.ff_pct)}</td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.column-header .sortable').forEach(th => {
            th.classList.toggle('sorted', th.getAttribute('data-column') === sortColumn);
            const arrow = th.querySelector('.sort-arrow');
            if (arrow) arrow.textContent = th.getAttribute('data-column') === sortColumn ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : '';
        });

        // ===== CHARTS =====
        ['trendChart', 'scatterChart', 'playoffWinsHistogram', 'radarChart'].forEach(id => {
            const c = Chart.getChart(id); if (c) c.destroy();
        });

        const chron = [...rows].filter(r => r.year != null).sort((a,b) => a.year - b.year);
        const years = chron.map(r => r.year);
        const ptsPct = chron.map(r => r.rs_pts_pct != null ? +(r.rs_pts_pct * 100).toFixed(1) : null);
        const xgf = chron.map(r => r.xgf_pct != null ? +Number(r.xgf_pct).toFixed(1) : null);
        const cf = chron.map(r => r.cf_pct != null ? +Number(r.cf_pct).toFixed(1) : null);
        const pWins = chron.map(r => r.playoff_wins != null ? r.playoff_wins : null);

        // Trend
        new Chart(document.getElementById('trendChart'), {
            type: 'bar',
            data: {
                labels: years,
                datasets: [
                    { type: 'line', label: 'PTS%', data: ptsPct, borderColor: quaternary, backgroundColor: quaternary, yAxisID: 'y', tension: 0.2, pointRadius: 2 },
                    { type: 'line', label: 'xGF%', data: xgf, borderColor: secondary, backgroundColor: secondary, yAxisID: 'y', tension: 0.2, pointRadius: 2 },
                    { type: 'line', label: 'CF%', data: cf, borderColor: '#888', backgroundColor: '#888', yAxisID: 'y', tension: 0.2, pointRadius: 2, borderDash: [4,2] },
                    { type: 'bar', label: 'Playoff Wins', data: pWins, backgroundColor: primary + '99', yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Regular Season Form · Process Metrics · Playoff Results', font: { size: 14 } }, legend: { position: 'top' } },
                scales: {
                    y: { type: 'linear', position: 'left', title: { display: true, text: 'PTS% / xGF% / CF%' }, min: 30, max: 75 },
                    y1: { type: 'linear', position: 'right', title: { display: true, text: 'Playoff Wins' }, min: 0, max: 16, grid: { drawOnChartArea: false } }
                }
            }
        });

        // Scatter
        const scatterData = chron.filter(r => r.xgf_pct != null).map(r => ({
            x: +Number(r.xgf_pct).toFixed(1),
            y: r.playoff_wins || 0,
            r: r.rs_pts_pct != null ? Math.max(4, r.rs_pts_pct * 40) : 6
        }));
        new Chart(document.getElementById('scatterChart'), {
            type: 'bubble',
            data: { datasets: [{ label: 'Season', data: scatterData, backgroundColor: quaternary + '88', borderColor: quaternary }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'xGF% vs Playoff Wins (bubble = PTS%)', font: { size: 14 } }, legend: { display: false } },
                scales: {
                    x: { title: { display: true, text: 'xGF%' }, min: 40, max: 60 },
                    y: { title: { display: true, text: 'Playoff Wins' }, min: 0, max: 16 }
                }
            }
        });

        // Histogram
        const winCounts = {};
        chron.forEach(r => {
            const w = r.playoff_wins;
            if (w != null) winCounts[w] = (winCounts[w] || 0) + 1;
        });
        const histLabels = Object.keys(winCounts).map(Number).sort((a,b)=>a-b);
        new Chart(document.getElementById('playoffWinsHistogram'), {
            type: 'bar',
            data: {
                labels: histLabels,
                datasets: [{ label: 'Seasons', data: histLabels.map(w => winCounts[w]), backgroundColor: primary + 'aa', borderColor: primary, borderWidth: 1 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Playoff Wins Distribution (Team History)', font: { size: 14 } }, legend: { display: false } },
                scales: { x: { title: { display: true, text: 'Playoff Wins' } }, y: { title: { display: true, text: 'Seasons' }, beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });

        // ===== RADAR (real advanced data only) =====
        const modern = chron.filter(r => r.xgf_pct != null && r.year >= 2008);
        const lastN = modern.slice(-5);

        const radarCanvas = document.getElementById('radarChart');
        const radarParent = radarCanvas ? radarCanvas.parentElement : null;

        if (lastN.length === 0) {
            if (radarParent) radarParent.style.display = 'none';
        } else {
            if (radarParent) radarParent.style.display = '';

            const avg = (arr, key) => {
                const vals = arr.map(r => r[key]).filter(v => v != null && !isNaN(v));
                return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            };

            const avgPts = avg(lastN, 'rs_pts_pct');
            const avgX   = avg(lastN, 'xgf_pct');
            const avgC   = avg(lastN, 'cf_pct');
            const avgF   = avg(lastN, 'ff_pct');
            const avgW   = avg(lastN, 'playoff_wins');
            const avgGD  = avg(lastN, 'rs_gd');

            const scaledW  = avgW  != null ? +(avgW * 100 / 16).toFixed(1) : null;
            const scaledGD = avgGD != null ? Math.max(0, Math.min(100, 50 + avgGD / 2)) : null;

            const radarLabels = ['PTS%', 'xGF%', 'CF%', 'FF%', 'Playoff Wins (scaled)', 'Goal Diff (scaled)'];
            const radarValues = [
                avgPts != null ? +(avgPts * 100).toFixed(1) : null,
                avgX   != null ? +avgX.toFixed(1)           : null,
                avgC   != null ? +avgC.toFixed(1)           : null,
                avgF   != null ? +avgF.toFixed(1)           : null,
                scaledW,
                scaledGD
            ];

            const validIndices = radarValues
                .map((v, i) => (v != null ? i : -1))
                .filter(i => i >= 0);

            const cleanLabels = validIndices.map(i => radarLabels[i]);
            const cleanValues = validIndices.map(i => radarValues[i]);

            const realTooltipValues = validIndices.map(i => {
                if (i === 4) return avgW;
                if (i === 5) return avgGD;
                return radarValues[i];
            });

            new Chart(radarCanvas, {
                type: 'radar',
                data: {
                    labels: cleanLabels,
                    datasets: [{
                        label: `Last ${lastN.length} Seasons Avg`,
                        data: cleanValues,
                        backgroundColor: quaternary + '44',
                        borderColor: quaternary,
                        pointBackgroundColor: quaternary,
                        borderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Modern Era Competitive Profile (scaled metrics)',
                            font: { size: 14 }
                        },
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const idx = context.dataIndex;
                                    const real = realTooltipValues[idx];
                                    const label = cleanLabels[idx];

                                    if (label.includes('Playoff Wins')) {
                                        return `Playoff Wins: ${real != null ? real.toFixed(1) : '—'}`;
                                    }
                                    if (label.includes('Goal Diff')) {
                                        return `Goal Diff: ${real != null ? real.toFixed(1) : '—'}`;
                                    }
                                    return `${label}: ${context.parsed.r}`;
                                }
                            }
                        }
                    },
                    scales: {
                        r: {
                            min: 0,
                            max: 100,
                            ticks: { stepSize: 20, backdropColor: 'transparent' },
                            pointLabels: { font: { size: 11 } },
                            grid: { color: 'rgba(0,0,0,0.08)' },
                            angleLines: { color: 'rgba(0,0,0,0.08)' }
                        }
                    }
                }
            });
        }

        // ===== GROUPED INSIGHTS =====
        const insightsEl = document.getElementById('insightsPanel');
        if (insightsEl) {
            let championsCount = rows.filter(r => r.elim_rank === 1).length;
            if (team === 'MTL') championsCount = 23;   // hard-coded official NHL-era total

            const realChampions = rows.filter(r => r.elim_rank === 1);
            const finalists     = rows.filter(r => r.elim_rank != null && r.elim_rank <= 2);
            const deepRuns      = rows.filter(r => r.elim_rank != null && r.elim_rank <= 4);

            const appearances = rows.filter(r => {
                if (r.elim_rank == null) return false;
                return r.elim_rank <= getPlayoffFieldSize(r.year);
            });

            const modernRows = rows.filter(r => r.xgf_pct != null);

            const avg = (arr, key, scale = 1) => {
                if (!Array.isArray(arr)) return '—';
                const vals = arr.map(r => r[key]).filter(v => v != null && !isNaN(v));
                return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length * scale).toFixed(1) : '—';
            };

            let corrXGF = 'n/a';
            if (modernRows.length >= 5) {
                const xs = modernRows.map(r => r.xgf_pct);
                const ys = modernRows.map(r => r.playoff_wins || 0);
                const n = xs.length;
                const meanX = xs.reduce((a,b)=>a+b,0)/n;
                const meanY = ys.reduce((a,b)=>a+b,0)/n;
                let num=0, denX=0, denY=0;
                for (let i=0;i<n;i++) {
                    const dx = xs[i]-meanX, dy = ys[i]-meanY;
                    num += dx*dy; denX += dx*dx; denY += dy*dy;
                }
                const r = (denX && denY) ? num / Math.sqrt(denX*denY) : 0;
                corrXGF = r.toFixed(2);
            }

            const careerWins = rows.reduce((s, r) => s + (r.playoff_wins || 0), 0);

            insightsEl.innerHTML = `
                <div class="insight-group champions">
                    <div class="insight-group-title">Stanley Cup Champions (elim_rank = 1)</div>
                    <div class="insight-group-cards">
                        <div class="insight-card">
                            <div class="insight-value">${championsCount}</div>
                            <div class="insight-label">Stanley Cups</div>
                        </div>
                        <div class="insight-card">
                            <div class="insight-value">${avg(realChampions, 'rs_pts_pct', 100)}%</div>
                            <div class="insight-label">Avg PTS%</div>
                        </div>
                        <div class="insight-card">
                            <div class="insight-value">${avg(realChampions.filter(r=>r.xgf_pct!=null), 'xgf_pct')}%</div>
                            <div class="insight-label">Avg xGF%</div>
                        </div>
                    </div>
                </div>

                <div class="insight-group finalists">
                    <div class="insight-group-title">Cup Finalists (elim_rank ≤ 2)</div>
                    <div class="insight-group-cards">
                        <div class="insight-card">
                            <div class="insight-value">${finalists.length}</div>
                            <div class="insight-label">Finals Appearances</div>
                        </div>
                        <div class="insight-card">
                            <div class="insight-value">${avg(finalists, 'rs_pts_pct', 100)}%</div>
                            <div class="insight-label">Avg PTS%</div>
                        </div>
                        <div class="insight-card">
                            <div class="insight-value">${avg(finalists.filter(r=>r.xgf_pct!=null), 'xgf_pct')}%</div>
                            <div class="insight-label">Avg xGF%</div>
                        </div>
                    </div>
                </div>

                <div class="insight-group deepruns">
                    <div class="insight-group-title">Deep Runs (elim_rank ≤ 4)</div>
                    <div class="insight-group-cards">
                        <div class="insight-card">
                            <div class="insight-value">${deepRuns.length}</div>
                            <div class="insight-label">Deep-Run Seasons</div>
                        </div>
                        <div class="insight-card">
                            <div class="insight-value">${avg(deepRuns, 'rs_pts_pct', 100)}%</div>
                            <div class="insight-label">Avg PTS%</div>
                        </div>
                        <div class="insight-card">
                            <div class="insight-value">${avg(deepRuns.filter(r=>r.xgf_pct!=null), 'xgf_pct')}%</div>
                            <div class="insight-label">Avg xGF%</div>
                        </div>
                    </div>
                </div>

                <div class="insight-group context">
                    <div class="insight-group-title">Overall</div>
                    <div class="insight-group-cards">
                        <div class="insight-card">
                            <div class="insight-value">${appearances.length}</div>
                            <div class="insight-label">Playoff Appearances</div>
                        </div>
                        <div class="insight-card">
                            <div class="insight-value">${careerWins}</div>
                            <div class="insight-label">Playoff Wins</div>
                        </div>
                        <div class="insight-card">
                            <div class="insight-value">${corrXGF}</div>
                            <div class="insight-label">xGF%–Wins Correlation</div>
                        </div>
                    </div>
                </div>
            `;
        }
    };

    document.querySelectorAll('.column-header .sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-column');
            sortDirection = (col === sortColumn) ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc';
            sortColumn = col;
            updateVisualization();
        });
    });
});