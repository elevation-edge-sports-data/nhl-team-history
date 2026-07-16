document.addEventListener('DOMContentLoaded', () => {
    console.log('SQL-powered NHL Playoff Team Stats initialized');

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

    // Simple CSV parser
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

        // 1. Playoff data (always from data.json)
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

        // 2. Try to load real regular_season.csv
        let rsLoaded = false;
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
                rsLoaded = true;
                console.log(`Loaded ${rows.length} real regular_season rows from CSV`);
            } catch (e) {
                console.warn('Failed to parse regular_season.csv', e);
            }
        }

        // 3. Try to load real team_advanced.csv
        let advLoaded = false;
        const advFetch = await tryFetch('data/team_advanced.csv');
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
                advLoaded = true;
                console.log(`Loaded ${rows.length} real advanced rows from CSV`);
            } catch (e) {
                console.warn('Failed to parse team_advanced.csv', e);
            }
        }

        // 4. Fallback mock only for missing data
        if (!rsLoaded || !advLoaded) {
            console.log('Generating mock data for missing regular_season / advanced rows...');
            const insertRS = db.prepare(
                `INSERT OR IGNORE INTO regular_season 
                 (season, team_abbr, gp, w, l, otl, pts, pts_pct, gf, ga, gd) 
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`
            );
            const insertAdv = db.prepare(
                `INSERT OR IGNORE INTO team_advanced (season, team_abbr, xgf_pct, cf_pct, ff_pct) VALUES (?,?,?,?,?)`
            );

            const allPlayoff = db.exec(`SELECT season, team_abbr, playoff_wins FROM playoff_results`);
            if (allPlayoff.length > 0) {
                allPlayoff[0].values.forEach(([season, team, pWins]) => {
                    if (!rsLoaded) {
                        const gp = season >= 1996 ? 82 : (season >= 1968 ? 76 : 70);
                        const strength = 0.45 + (pWins / 40) + (Math.random() * 0.1 - 0.05);
                        const w = Math.round(gp * Math.min(0.70, Math.max(0.30, strength)));
                        const otl = Math.round((gp - w) * 0.22);
                        const l = gp - w - otl;
                        const pts = w * 2 + otl;
                        const pts_pct = +(pts / (gp * 2)).toFixed(3);
                        const gf = Math.round(gp * (2.55 + strength * 1.0));
                        const ga = Math.round(gp * (3.35 - strength * 1.0));
                        insertRS.run([season, team, gp, w, l, otl, pts, pts_pct, gf, ga, gf - ga]);
                    }
                    if (!advLoaded && season >= 2008) {
                        const xgf = +(48.5 + (pWins / 20) + (Math.random() * 3 - 1.5)).toFixed(1);
                        const cf  = +(49.0 + (pWins / 25) + (Math.random() * 2.5 - 1.2)).toFixed(1);
                        const ff  = +(49.0 + (pWins / 25) + (Math.random() * 2.5 - 1.2)).toFixed(1);
                        insertAdv.run([season, team, xgf, cf, ff]);
                    }
                });
            }
            insertRS.free();
            insertAdv.free();
        }

        const counts = db.exec(`
            SELECT 
                (SELECT COUNT(*) FROM playoff_results),
                (SELECT COUNT(*) FROM regular_season),
                (SELECT COUNT(*) FROM team_advanced)
        `)[0].values[0];
        console.log(`SQL ready → playoffs: ${counts[0]} | regular_season: ${counts[1]} | advanced: ${counts[2]}`);
        console.log(`Sources: regular_season=${rsLoaded ? 'CSV' : 'mock'} | advanced=${advLoaded ? 'CSV' : 'mock'}`);
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

    // ========== LOAD ==========
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
            ['combinedHistogram', 'combinedLine', 'playoffWinsHistogram'].forEach(id => {
                const c = Chart.getChart(id); if (c) c.destroy();
            });
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

        const primary   = (teamColors[team] && /^#[0-9A-F]{6}$/i.test(teamColors[team])) ? teamColors[team] : defaultColors.c1;
        const secondary = (teamSecondaryColors[team] && /^#[0-9A-F]{6}$/i.test(teamSecondaryColors[team])) ? teamSecondaryColors[team] : defaultColors.c2;
        const quaternary = (teamQuaternaryColors[team] && /^#[0-9A-F]{6}$/i.test(teamQuaternaryColors[team])) ? teamQuaternaryColors[team] : defaultColors.c4;
        const quinary    = (teamQuinaryColors[team] && /^#[0-9A-F]{6}$/i.test(teamQuinaryColors[team])) ? teamQuinaryColors[team] : defaultColors.c5;

        document.body.style.backgroundColor = primary;
        document.querySelector('h1.header').style.color = secondary;
        document.querySelector('.team-header').style.color = secondary;
        logosEl.style.backgroundColor = primary;

        const orderMap = {
            year: 'year', rs_gp: 'rs_gp', rs_w: 'rs_w', rs_l: 'rs_l', rs_otl: 'rs_otl',
            rs_pts: 'rs_pts', rs_pts_pct: 'rs_pts_pct', rs_gf: 'rs_gf', rs_ga: 'rs_ga', rs_gd: 'rs_gd',
            elim_rank: 'elim_rank', elim_order: 'elim_order', playoff_wins: 'playoff_wins',
            xgf_pct: 'xgf_pct', cf_pct: 'cf_pct', ff_pct: 'ff_pct'
        };
        const sqlCol = orderMap[sortColumn] || 'year';
        const dir = sortDirection === 'asc' ? 'ASC' : 'DESC';

        const rows = runQuery(`
            SELECT 
                p.season AS year,
                r.gp AS rs_gp, r.w AS rs_w, r.l AS rs_l, r.otl AS rs_otl,
                r.pts AS rs_pts, r.pts_pct AS rs_pts_pct,
                r.gf AS rs_gf, r.ga AS rs_ga, r.gd AS rs_gd,
                p.elim_rank, p.elim_order, p.playoff_wins,
                a.xgf_pct, a.cf_pct, a.ff_pct
            FROM playoff_results p
            LEFT JOIN regular_season r ON p.season = r.season AND p.team_abbr = r.team_abbr
            LEFT JOIN team_advanced a ON p.season = a.season AND p.team_abbr = a.team_abbr
            WHERE p.team_abbr = ?
            ORDER BY ${sqlCol} ${dir}
        `, [team]);

        const tbody = document.querySelector('#teamDataTable tbody');
        tbody.innerHTML = '';
        rows.forEach(r => {
            const tr = document.createElement('tr');
            const fmt = (v) => (v === null || v === undefined) ? '<span class="null-value">—</span>' : v;
            const fmtPct = (v) => (v === null || v === undefined) ? '<span class="null-value">—</span>' : (v * 100).toFixed(1) + '%';
            const fmtAdv = (v) => (v === null || v === undefined) ? '<span class="null-value">—</span>' : Number(v).toFixed(1);

            tr.innerHTML = `
                <td class="sticky-col"><img src="${window.basePath || ''}logos/NHL${r.year}/${team}.png" class="logo-img" onerror="this.style.display='none'"></td>
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
            const arrow = th.querySelector('.sort-arrow');
            const col = th.getAttribute('data-column');
            th.classList.remove('sorted');
            if (arrow) arrow.textContent = '';
            if (col === sortColumn) {
                th.classList.add('sorted');
                if (arrow) arrow.textContent = sortDirection === 'asc' ? '↑' : '↓';
            }
        });

        // Charts (playoff only for now)
        const valid = rows.filter(r => r.elim_rank != null && r.elim_order != null);
        const years = valid.map(r => r.year);
        const ranks = valid.map(r => r.elim_rank);
        const orders = valid.map(r => r.elim_order);
        const winsArr = valid.map(r => r.playoff_wins);

        const maxV = 32, maxW = 16;
        const rankFreq = Array(maxV+1).fill(0);
        const orderFreq = Array(maxV+1).fill(0);
        const winsFreq = Array(maxW+1).fill(0);
        ranks.forEach(v => { if (v >= 0 && v <= maxV) rankFreq[v]++; });
        orders.forEach(v => { if (v >= 0 && v <= maxV) orderFreq[v]++; });
        winsArr.forEach(v => { if (v >= 0 && v <= maxW) winsFreq[v]++; });

        ['combinedHistogram', 'combinedLine', 'playoffWinsHistogram'].forEach(id => {
            const c = Chart.getChart(id); if (c) c.destroy();
        });

        new Chart(document.getElementById('combinedHistogram'), {
            type: 'bar',
            data: {
                labels: Array.from({length: maxV+1}, (_,i)=>i),
                datasets: [
                    { label: 'Playoff Rank Freq', data: rankFreq, backgroundColor: quaternary+'90', borderColor: quaternary, borderWidth: 1 },
                    { label: 'Elim Order Freq', data: orderFreq, backgroundColor: quinary+'90', borderColor: quinary, borderWidth: 1 }
                ]
            },
            options: {
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { title: { display: true, text: 'Value' } } },
                plugins: { legend: { position: 'top' } }
            }
        });

        new Chart(document.getElementById('combinedLine'), {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    { label: 'Playoff Rank', data: ranks, borderColor: quaternary, backgroundColor: quaternary+'40', fill: true, tension: 0.1 },
                    { label: 'Elim Order', data: orders, borderColor: quinary, backgroundColor: quinary+'40', fill: true, tension: 0.1 }
                ]
            },
            options: {
                scales: { y: { min: 0, max: 32 }, x: { title: { display: true, text: 'Year' } } },
                plugins: { legend: { position: 'top' } }
            }
        });

        new Chart(document.getElementById('playoffWinsHistogram'), {
            type: 'bar',
            data: {
                labels: Array.from({length: maxW+1}, (_,i)=>i),
                datasets: [{ label: 'Playoff Wins Freq', data: winsFreq, backgroundColor: quaternary+'90', borderColor: quaternary, borderWidth: 1 }]
            },
            options: {
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { title: { display: true, text: 'Playoff Wins' } } },
                plugins: { legend: { display: false } }
            }
        });
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
