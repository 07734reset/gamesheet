'use strict';

/* ============================================================
   Junior ice hockey gamesheet
   All data stays on this device (localStorage).
   ============================================================ */

const STORE_KEY = 'gamesheet.v1';
const ROSTER_ROWS = 22;           // player rows per team on the printed sheet
const BENCH = 'bench';            // player id for bench penalties (No. 0)

const PEN_TYPES = {
  '2':  { label: '2',  name: 'Minor',          pim: 2,  dur: 120 },
  '4':  { label: '4',  name: 'Double minor',   pim: 4,  dur: 240 },
  '5':  { label: '5',  name: 'Major',          pim: 5,  dur: 300 },
  '10': { label: '10', name: 'Misconduct',     pim: 10, dur: 600 },
  'GM': { label: 'GM', name: 'Game misconduct', pim: 15, dur: null },
  'MA': { label: 'MA', name: 'Match penalty',  pim: 25, dur: null },
};
const PERIODS = ['1', '2', '3', 'OT'];

/* ---------- utilities ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');

function mmss(str) { // "15:00" -> 900
  const m = /^(\d+):(\d{2})$/.exec(str || '');
  return m ? (+m[1]) * 60 + (+m[2]) : 0;
}
/** Parse what someone types for a clock reading: "7:22", "7.22", "722", "45" (=0:45). */
function parseClock(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  let m = /^(\d{1,2})[:.,;](\d{1,2})$/.exec(s);
  if (m) { const sec = +m[2]; if (sec > 59) return null; return (+m[1]) * 60 + sec; }
  if (/^\d{1,4}$/.test(s)) {
    const n = s.padStart(3, '0');
    const min = +n.slice(0, -2), sec = +n.slice(-2);
    if (sec > 59) return null;
    return min * 60 + sec;
  }
  return null;
}
const fmt = sec => (sec == null || isNaN(sec)) ? '' : `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
const fmtH = sec => (sec == null || isNaN(sec)) ? '00:00:00' : `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;

/* ---------- state ---------- */
let state = load();
let tab = state.currentId && state.games[state.currentId] ? 'game' : 'games';
const drafts = { goal: null, pen: null, editingGoal: null, editingPen: null, ev: null, editing: null };

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.games) return s;
  } catch (e) { /* storage unavailable */ }
  return { games: {}, currentId: null };
}
function save() {
  const g = game();
  if (g) g.updated = Date.now();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save on this device — storage is full or blocked.'); }
}
const game = () => state.games[state.currentId] || null;

function newGame() {
  const g = {
    id: uid(), created: Date.now(), updated: Date.now(),
    league: '', date: new Date().toISOString().slice(0, 10), time: '', venue: 'Alexandra Palace',
    home: { name: '', players: [] }, away: { name: '', players: [] },
    goals: [], penalties: [],
    netminders: { home: blankNM(), away: blankNM() },
    timeouts: { home: [], away: [] },
    attendance: '',
  };
  state.games[g.id] = g; state.currentId = g.id; save();
  return g;
}
function blankNM() {
  const row = () => ({ playerId: '', toi: '', shots: ['', '', '', ''] });
  return { rows: [row(), row()], empty: { toi: '', shots: ['', '', '', ''] } };
}

/* ---------- league / time maths ---------- */
function leagueOf(g) { return REF.leagues.find(l => l.name === g.league) || null; }
function periodLen(g) { const l = leagueOf(g); return l ? mmss(l.period) : 0; }
function otLen(g) { const l = leagueOf(g); return l ? mmss(l.ot) : 0; }
/** Clock counts down; the sheet wants time since the start of play. */
function elapsed(g, period, clockSec) {
  const L = periodLen(g), OT = otLen(g);
  if (!L || clockSec == null) return null;
  if (period === 'OT') return clockSec > OT ? null : 3 * L + (OT - clockSec);
  const p = +period;
  if (!(p >= 1 && p <= 3) || clockSec > L) return null;
  return (p - 1) * L + (L - clockSec);
}
function clockError(g, period, clockStr) {
  if (!leagueOf(g)) return 'Pick a league on the Pre-game tab first.';
  const c = parseClock(clockStr);
  if (c == null) return 'Type the clock as e.g. 7:22 or 722.';
  const max = period === 'OT' ? otLen(g) : periodLen(g);
  if (c > max) return `The clock can't be more than ${fmt(max)} in ${period === 'OT' ? 'OT' : 'period ' + period}.`;
  return '';
}

/* ---------- players ---------- */
const teamOf = (g, side) => g[side];
const other = side => side === 'home' ? 'away' : 'home';
function player(g, side, id) {
  if (id === BENCH) return { id: BENCH, no: '0', name: 'Bench', nm: false };
  return g[side].players.find(p => p.id === id) || null;
}
const noOf = (g, side, id) => { const p = player(g, side, id); return p ? p.no : ''; };
function sortedPlayers(g, side) {
  return [...g[side].players].sort((a, b) => (parseInt(a.no) || 999) - (parseInt(b.no) || 999) || a.name.localeCompare(b.name));
}
function playerOptions(g, side, selected, { blank = '—', bench = false } = {}) {
  let html = `<option value="">${esc(blank)}</option>`;
  for (const p of sortedPlayers(g, side)) {
    html += `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.no || '?')} · ${esc(p.name)}</option>`;
  }
  if (bench) html += `<option value="${BENCH}" ${selected === BENCH ? 'selected' : ''}>0 · Bench</option>`;
  return html;
}

/* ---------- goals ---------- */
function goalTime(g, goal) { return elapsed(g, goal.period, parseClock(goal.clock)); }
function sortedGoals(g, side) {
  return g.goals.filter(x => !side || x.team === side)
    .map(x => ({ ...x, t: goalTime(g, x) }))
    .sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9));
}

/* ---------- penalties ---------- */
/**
 * Works out Given / Start / End for every penalty.
 *  - Start = Given, unless the same player already has a penalty running, then it starts when that ends.
 *  - End = Start + duration. GM / MA have no end.
 *  - A power-play goal ends the opposing team's running minor (earliest-finishing first).
 *    On a double minor, a goal in the first 2 minutes ends that half; the second half starts at the goal.
 *  - Manual overrides always win.
 */
function computePenalties(g) {
  const pens = g.penalties.map((p, i) => ({ p, i, given: p.givenOverride != null && p.givenOverride !== '' ? parseClock(p.givenOverride) : elapsed(g, p.period, parseClock(p.clock)) }));
  pens.sort((a, b) => (a.given ?? 1e9) - (b.given ?? 1e9) || (a.p.type === '10') - (b.p.type === '10') || a.i - b.i);
  const ppGoals = sortedGoals(g).filter(x => x.type === 'PP' && x.t != null);

  const base = adj => {
    const out = {}, lastEnd = {};
    for (const { p, given } of pens) {
      const key = p.team + ':' + p.playerId;
      const ty = PEN_TYPES[p.type] || PEN_TYPES['2'];
      let start = given == null ? null : Math.max(given, lastEnd[key] ?? -1);
      if (p.startOverride) start = parseClock(p.startOverride);
      let end = null, natural = null;
      if (ty.dur != null && start != null) {
        natural = start + ty.dur;
        end = natural;
        const a = adj[p.id];
        if (a) { if (a.dmHalf != null) end = a.dmHalf + 120; if (a.endAt != null) end = a.endAt; }
      }
      if (p.endOverride) end = parseClock(p.endOverride);
      if (end != null) lastEnd[key] = end;
      out[p.id] = { given, start, end, natural, adj: adj[p.id] || null };
    }
    return out;
  };

  // Apply power-play goals one at a time, in order, each seeing the effect of the ones before it.
  const adj = {};
  let times = base(adj);
  for (const goal of ppGoals) {
    const t = goal.t;
    const cands = pens.filter(({ p }) => p.team === other(goal.team) && (p.type === '2' || p.type === '4') && !p.noPP && !p.endOverride)
      .map(({ p }) => ({ p, s: times[p.id].start, e: times[p.id].end }))
      .filter(c => c.s != null && c.e != null && c.s <= t && t < c.e)
      .sort((a, b) => a.e - b.e || a.s - b.s);
    if (!cands.length) continue;
    const c = cands[0];
    const a = adj[c.p.id] = adj[c.p.id] || {};
    if (c.p.type === '4' && a.dmHalf == null && t < c.s + 120) a.dmHalf = t;
    else a.endAt = t;
    a.goalId = goal.id;
    times = base(adj);
  }
  return times;
}
function sortedPens(g, side, times) {
  times = times || computePenalties(g);
  return g.penalties.filter(p => !side || p.team === side)
    .map(p => ({ ...p, ...times[p.id] }))
    .sort((a, b) => (a.given ?? 1e9) - (b.given ?? 1e9));
}

/* ---------- totals ---------- */
const periodIdx = per => per === 'OT' ? 3 : (+per - 1);
function stats(g) {
  const s = { home: {}, away: {} }, score = { home: [0, 0, 0, 0], away: [0, 0, 0, 0] }, pim = { home: [0, 0, 0, 0], away: [0, 0, 0, 0] };
  const bump = (side, id, k, n = 1) => { if (!id) return; (s[side][id] ||= { g: 0, a: 0, pim: 0 })[k] += n; };
  for (const x of g.goals) {
    bump(x.team, x.scorer, 'g'); bump(x.team, x.a1, 'a'); bump(x.team, x.a2, 'a');
    const pi = periodIdx(x.period); if (pi >= 0) score[x.team][pi]++;
  }
  for (const p of g.penalties) {
    const ty = PEN_TYPES[p.type]; if (!ty) continue;
    bump(p.team, p.playerId, 'pim', ty.pim);
    const pi = periodIdx(p.period); if (pi >= 0) pim[p.team][pi] += ty.pim;
  }
  return { s, score, pim };
}
const sum = a => a.reduce((x, y) => x + (+y || 0), 0);

/* ============================================================
   Rendering
   ============================================================ */
const TABS = [
  ['games', 'Games'], ['pre', 'Pre-game'], ['rosters', 'Rosters'], ['game', 'Game'],
  ['extras', 'Netminders'], ['sheet', 'Sheet'],
];

function render() {
  const g = game();
  $('#tabs').innerHTML = TABS.map(([k, label]) =>
    `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}" ${!g && k !== 'games' ? 'disabled' : ''}>${label}</button>`).join('');
  $('#gameTitle').textContent = g ? `${g.home.name || 'Home'} v ${g.away.name || 'Away'}` : 'Gamesheet';
  if (g) autoNetminders(g);
  const views = { games: viewGames, pre: viewPre, rosters: viewRosters, game: viewGame, extras: viewExtras, sheet: viewSheet };
  $('#main').innerHTML = (g || tab === 'games') ? views[tab](g) : viewGames();
  $('#printArea').innerHTML = g ? sheetHTML(g) : '';
  if (tab === 'sheet') fitSheet();
  updatePreviews();
}

/* ---------- Games list ---------- */
function viewGames() {
  const inc = incoming ? `
  <section class="card incoming">
    <h2>📨 Game sent to you</h2>
    <p><strong>${esc(incoming.home.name || 'Home')} ${sum(stats(incoming).score.home)}–${sum(stats(incoming).score.away)} ${esc(incoming.away.name || 'Away')}</strong><br>
    <span class="muted">${esc(fmtDate(incoming.date))} · ${esc(incoming.league || 'No league')} · ${incoming.goals.length} goals, ${incoming.penalties.length} penalties</span></p>
    ${state.games[incoming.id] ? '<p class="small warn">You already have this game. Loading it replaces your copy.</p>' : ''}
    <div class="btnrow"><button class="btn primary" data-action="accept-incoming">Load and carry on</button><button class="btn" data-action="reject-incoming">Ignore</button></div>
  </section>` : '';
  const list = Object.values(state.games).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updated - a.updated);
  return `${inc}
  <section class="card">
    <button class="btn primary big" data-action="new-game">+ New game</button>
    <label class="btn big gd">📄 New game from Gameday PDF<input type="file" accept="application/pdf,.pdf" hidden data-action="gameday" data-new="1"></label>
  </section>
  <section class="card">
    <h2>Saved games</h2>
    ${list.length ? `<ul class="list">${list.map(x => {
      const st = stats(x);
      return `<li class="${x.id === state.currentId ? 'current' : ''}">
        <div class="grow" data-action="open-game" data-id="${x.id}">
          <strong>${esc(x.home.name || 'Home')} ${sum(st.score.home)}–${sum(st.score.away)} ${esc(x.away.name || 'Away')}</strong>
          <div class="muted">${esc(fmtDate(x.date))} · ${esc(x.league || 'No league')} · ${esc(x.venue)}</div>
        </div>
        <button class="btn small" data-action="share-game" data-id="${x.id}">Send</button>
        <button class="btn small danger" data-action="delete-game" data-id="${x.id}">Delete</button>
      </li>`; }).join('')}</ul>` : '<p class="muted">No games yet.</p>'}
    <p class="muted small">Games are kept on this device only. "Send" shares a game as a link, so someone else with the app can carry on with it.</p>
    <details class="paste"><summary>Got a link but it opened in the wrong place?</summary>
      <p class="muted small">Paste it here to load the game.</p>
      <div class="row3 two"><input id="pasteLink" placeholder="Paste the link" autocomplete="off"><button class="btn small" data-action="paste-link">Load</button></div>
    </details>
  </section>`;
}
function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }

/* ---------- Pre-game ---------- */
function viewPre(g) {
  return `
  <section class="card form">
    <h2>Game details</h2>
    <label class="btn gd">📄 Fill from Gameday PDF<input type="file" accept="application/pdf,.pdf" hidden data-action="gameday"></label>
    <div class="ocr-status" id="gd-status"></div>
    <label>Competition / league
      <select data-bind="league">
        <option value="">Pick a league</option>
        ${REF.leagues.map(l => `<option ${l.name === g.league ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
      </select>
    </label>
    <p class="muted small">${leagueOf(g) ? `Periods ${leagueOf(g).period}, OT ${leagueOf(g).ot}` : 'The league sets the period length used to work out sheet times.'}</p>
    <label>Home team <input data-bind="home.name" value="${esc(g.home.name)}" placeholder="e.g. Haringey Hounds U16A" autocomplete="off"></label>
    <label>Away team <input data-bind="away.name" value="${esc(g.away.name)}" placeholder="e.g. Streatham U16" autocomplete="off"></label>
    <div class="row2">
      <label>Date <input type="date" data-bind="date" value="${esc(g.date)}"></label>
      <label>Time <input type="time" data-bind="time" value="${esc(g.time)}"></label>
    </div>
    <label>Venue <input data-bind="venue" value="${esc(g.venue)}"></label>
  </section>
  <section class="card"><button class="btn primary" data-tab="rosters">Next: rosters →</button></section>`;
}

/* ---------- Rosters ---------- */
function viewRosters(g) {
  return ['home', 'away'].map(side => {
    const t = g[side];
    return `
    <section class="card">
      <h2>${side === 'home' ? 'Home' : 'Away'}: ${esc(t.name || '(name not set)')}</h2>
      <div class="btnrow">
        <button class="btn" data-action="add-player" data-side="${side}">+ Add player</button>
        ${t.players.length ? `<button class="btn danger" data-action="clear-roster" data-side="${side}">Clear</button>` : ''}
      </div>
      ${t.players.length ? `
      <table class="roster">
        <thead><tr><th>No.</th><th>Name</th><th title="Netminder">NM</th><th></th></tr></thead>
        <tbody>${t.players.map(p => `
          <tr>
            <td><input class="no" inputmode="numeric" value="${esc(p.no)}" data-player="${p.id}" data-side="${side}" data-field="no"></td>
            <td><input value="${esc(p.name)}" data-player="${p.id}" data-side="${side}" data-field="name" placeholder="Surname, First"></td>
            <td><input type="checkbox" ${p.nm ? 'checked' : ''} data-player="${p.id}" data-side="${side}" data-field="nm"></td>
            <td><button class="btn small ghost" data-action="del-player" data-side="${side}" data-id="${p.id}" aria-label="Remove">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <p class="muted small">${t.players.length} players${dupWarning(t)}. Tick NM for netminders.</p>` : '<p class="muted">No players yet. Fill them from the Gameday PDF on the Pre-game tab, or add players by hand.</p>'}
    </section>`;
  }).join('');
}
function dupWarning(t) {
  const seen = {}, d = new Set();
  for (const p of t.players) { if (p.no && seen[p.no]) d.add(p.no); seen[p.no] = 1; }
  return d.size ? ` · <span class="warn">duplicate number ${[...d].join(', ')}</span>` : '';
}

/* ---------- Game: one entry flow for every event ---------- */
const blankEvent = (period = '1') => ({ period, clock: '', team: '', kind: '', scorer: '', a1: '', a2: '', gtype: 'E', playerId: '', ptype: '2', offence: '', startOverride: '', endOverride: '' });
function viewGame(g) {
  const d = drafts.ev ||= blankEvent();
  const ed = drafts.editing;
  const st = stats(g), times = computePenalties(g);
  const step = (n, title, body) => `<div class="step"><div class="stepno">${n}</div><div class="stepbody"><div class="steptitle">${title}</div>${body}</div></div>`;
  let details = '';
  if (d.team && d.kind === 'goal') details = `
      <label>Scorer <select data-draft="ev.scorer">${playerOptions(g, d.team, d.scorer, { blank: 'Pick scorer' })}</select></label>
      <div class="row2">
        <label>Assist 1 <select data-draft="ev.a1">${playerOptions(g, d.team, d.a1, { blank: 'None' })}</select></label>
        <label>Assist 2 <select data-draft="ev.a2">${playerOptions(g, d.team, d.a2, { blank: 'None' })}</select></label>
      </div>
      <label>Type <select data-draft="ev.gtype">${REF.goalCodes.map(([c, n]) => `<option value="${c}" ${c === d.gtype ? 'selected' : ''}>${c} · ${esc(n)}</option>`).join('')}</select></label>`;
  else if (d.team && d.kind === 'pen') details = `
      <label>Player <select data-draft="ev.playerId">${playerOptions(g, d.team, d.playerId, { blank: 'Pick player', bench: true })}</select></label>
      <label>Penalty <select data-draft="ev.ptype">${Object.entries(PEN_TYPES).map(([k, v]) => `<option value="${k}" ${k === d.ptype ? 'selected' : ''}>${v.label} · ${v.name}</option>`).join('')}</select></label>
      <label>Offence <select data-draft="ev.offence"><option value="">Pick offence</option>${REF.penaltyCodes.map(([c, n]) => `<option value="${c}" ${c === d.offence ? 'selected' : ''}>${c} · ${esc(n)}</option>`).join('')}</select></label>
      <details ${d.startOverride || d.endOverride ? 'open' : ''}>
        <summary>Override start / end time</summary>
        <p class="muted small">Leave blank to work them out automatically. Use sheet time (since start of play), e.g. 24:38.</p>
        <div class="row2">
          <label>Start <input inputmode="numeric" value="${esc(d.startOverride)}" data-draft="ev.startOverride" placeholder="auto"></label>
          <label>End <input inputmode="numeric" value="${esc(d.endOverride)}" data-draft="ev.endOverride" placeholder="auto"></label>
        </div>
      </details>`;
  const events = [
    ...sortedGoals(g).map(x => ({ kind: 'goal', t: x.t, x })),
    ...sortedPens(g, null, times).map(x => ({ kind: 'pen', t: x.given, x })),
  ].sort((a, b) => (b.t ?? -1) - (a.t ?? -1));
  return `
  ${scoreBar(g, st)}
  <section class="card form entry ${ed ? 'editing' : ''}">
    <h2>${ed ? (ed.kind === 'goal' ? 'Edit goal' : 'Edit penalty') : 'New event'}</h2>
    ${step(1, 'When? Period and time on the clock', `
      ${periodToggle('ev', d.period)}
      <input id="evClock" class="clock" inputmode="numeric" autocomplete="off" placeholder="e.g. 722 for 7:22" value="${esc(d.clock)}" data-draft="ev.clock" aria-label="Time on the clock">
      <div class="preview" id="evPreview"></div>`)}
    ${step(2, 'Which team?', teamToggle('ev', d.team, g))}
    ${d.team ? step(3, 'Goal or penalty?', `<div class="seg kind">
        <button class="${d.kind === 'goal' ? 'on' : ''}" data-set="ev.kind" data-val="goal">🥅 Goal</button>
        <button class="${d.kind === 'pen' ? 'on' : ''}" data-set="ev.kind" data-val="pen">⛔ Penalty</button></div>`) : ''}
    ${details ? step(4, d.kind === 'goal' ? 'Goal details' : 'Penalty details', details + `
      <div class="btnrow">
        <button class="btn primary" data-action="save-event">${ed ? 'Save changes' : d.kind === 'goal' ? 'Add goal' : 'Add penalty'}</button>
        ${ed ? '<button class="btn" data-action="cancel-event">Cancel</button>' : ''}
      </div>`) : ''}
  </section>
  <section class="card">
    <h2>Events <span class="muted small">latest first · tap to edit</span></h2>
    ${events.length ? `<ul class="list">${events.map(e => e.kind === 'goal' ? goalItem(g, e.x) : penItem(g, e.x)).join('')}</ul>` : '<p class="muted">Nothing yet.</p>'}
  </section>`;
}
function goalItem(g, x) {
  return `<li>
    <div class="grow" data-action="edit-goal" data-id="${x.id}">
      <span class="pill ${x.team}">${x.team === 'home' ? 'H' : 'A'}</span>
      <strong>${fmt(x.t) || '??'}</strong> 🥅 Goal ${esc(x.type)} · #${esc(noOf(g, x.team, x.scorer))}${x.a1 ? ` (${esc(noOf(g, x.team, x.a1))}${x.a2 ? ', ' + esc(noOf(g, x.team, x.a2)) : ''})` : ''}
      <div class="muted small">P${x.period} · clock ${esc(fmt(parseClock(x.clock)))}</div>
    </div>
    <button class="btn small ghost" data-action="del-goal" data-id="${x.id}" aria-label="Delete">✕</button>
  </li>`;
}
function penItem(g, x) {
  const ty = PEN_TYPES[x.type];
  let note = '';
  if (x.adj && !x.endOverride) note = `<div class="note">${x.adj.endAt != null ? 'Ended early' : 'Second half restarted'} by PP goal at ${fmt(x.adj.endAt ?? x.adj.dmHalf)} <button class="link" data-action="toggle-pp" data-id="${x.id}">undo</button></div>`;
  else if (x.noPP) note = `<div class="note">Power-play goals ignored for this penalty <button class="link" data-action="toggle-pp" data-id="${x.id}">re-apply</button></div>`;
  return `<li>
    <div class="grow" data-action="edit-pen" data-id="${x.id}">
      <span class="pill ${x.team}">${x.team === 'home' ? 'H' : 'A'}</span>
      <strong>${fmt(x.given) || '??'}</strong> ⛔ #${esc(noOf(g, x.team, x.playerId))} ${ty.label} ${esc(x.offence)}
      <div class="muted small">Start ${fmt(x.start)} · End ${x.end == null ? (ty.dur == null ? '—' : '') : fmt(x.end)}${x.startOverride || x.endOverride ? ' (manual)' : ''}</div>
      ${note}
    </div>
    <button class="btn small ghost" data-action="del-pen" data-id="${x.id}" aria-label="Delete">✕</button>
  </li>`;
}
function saveEvent(g) {
  const d = drafts.ev, ed = drafts.editing;
  if (d.kind === 'goal') {
    drafts.goal = { team: d.team, period: d.period, clock: d.clock, scorer: d.scorer, a1: d.a1, a2: d.a2, type: d.gtype };
    drafts.editingGoal = ed && ed.kind === 'goal' ? ed.id : null;
    if (!saveGoal(g)) return false;
  } else {
    drafts.pen = { team: d.team, period: d.period, clock: d.clock, playerId: d.playerId, type: d.ptype, offence: d.offence, startOverride: d.startOverride, endOverride: d.endOverride };
    drafts.editingPen = ed && ed.kind === 'pen' ? ed.id : null;
    if (!savePen(g)) return false;
  }
  drafts.ev = blankEvent(d.period); drafts.editing = null;
  return true;
}

function scoreBar(g, st) {
  return `<section class="scorebar">
    <div><span>${esc(g.home.name || 'Home')}</span><b>${sum(st.score.home)}</b></div>
    <div><b>${sum(st.score.away)}</b><span>${esc(g.away.name || 'Away')}</span></div>
  </section>`;
}
function teamToggle(form, val, g) {
  return `<div class="seg">${['home', 'away'].map(s =>
    `<button class="${val === s ? 'on ' + s : ''}" data-set="${form}.team" data-val="${s}">${esc(g[s].name || (s === 'home' ? 'Home' : 'Away'))}</button>`).join('')}</div>`;
}
function periodToggle(form, val) {
  return `<div class="seg">${PERIODS.map(p => `<button class="${val === p ? 'on' : ''}" data-set="${form}.period" data-val="${p}">${p === 'OT' ? 'OT' : 'P' + p}</button>`).join('')}</div>`;
}

/* ---------- Netminders, time outs ---------- */
/** Netminder dropdowns list only players ticked NM; empty rows fill themselves in. */
function autoNetminders(g) {
  let changed = false;
  for (const side of ['home', 'away']) {
    const nms = sortedPlayers(g, side).filter(p => p.nm);
    const rows = g.netminders[side].rows;
    for (const r of rows) {
      const p = r.playerId && g[side].players.find(p => p.id === r.playerId);
      const blank = !r.toi && r.shots.every(v => !v);
      if (r.playerId && (!p || !p.nm) && blank) { r.playerId = ''; changed = true; }
    }
    for (const r of rows) {
      if (r.playerId) continue;
      const next = nms.find(p => !rows.some(x => x.playerId === p.id));
      if (next) { r.playerId = next.id; changed = true; }
    }
  }
  if (changed) save();
}
function nmOptions(g, side, selected, blank) {
  const list = sortedPlayers(g, side).filter(p => p.nm || p.id === selected);
  return `<option value="">${list.length ? '—' : 'Tick NM on Rosters'}</option>` + list.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.no || '?')} · ${esc(p.name)}</option>`).join('');
}
function viewExtras(g) {
  const L = periodLen(g);
  return ['home', 'away'].map(side => {
    const nm = g.netminders[side];
    const shotInputs = (path, shots) => shots.map((v, i) =>
      `<label class="shot">${PERIODS[i]}<input inputmode="numeric" value="${esc(v)}" data-nm="${side}.${path}.shots.${i}"></label>`).join('');
    return `
    <section class="card form">
      <h2>${side === 'home' ? 'Home' : 'Away'} netminders · ${esc(g[side].name || '')}</h2>
      <p class="muted small">${g[side].players.some(p => p.nm) ? 'Shots on goal faced, per period. Time on ice as mm:ss.' : '<span class="warn">No netminders ticked yet.</span> Tick NM next to them on the Rosters tab and they will appear here.'}</p>
      ${nm.rows.map((r, i) => `
        <div class="nmrow">
          <select data-nm="${side}.rows.${i}.playerId">${nmOptions(g, side, r.playerId, 'Netminder ' + (i + 1))}</select>
          <div class="row2">
            <label>Time on <input inputmode="numeric" value="${esc(r.toi)}" data-nm="${side}.rows.${i}.toi" placeholder="mm:ss"></label>
            <button class="btn small" data-action="full-game" data-side="${side}" data-row="${i}" ${L ? '' : 'disabled'}>Full game</button>
          </div>
          <div class="shots">${shotInputs('rows.' + i, r.shots)}</div>
        </div>`).join('')}
      <div class="nmrow">
        <strong>Empty net</strong>
        <label>Time on <input inputmode="numeric" value="${esc(nm.empty.toi)}" data-nm="${side}.empty.toi" placeholder="mm:ss"></label>
        <div class="shots">${shotInputs('empty', nm.empty.shots)}</div>
      </div>
    </section>`;
  }).join('') + `
  <section class="card form">
    <h2>Time outs</h2>
    ${['home', 'away'].map(side => `
      <div class="to">
        <span class="grow">${esc(g[side].name || (side === 'home' ? 'Home' : 'Away'))}</span>
        <button class="btn small" data-action="del-to" data-side="${side}" ${g.timeouts[side].length ? '' : 'disabled'} aria-label="One fewer">−</button>
        <b class="count">${g.timeouts[side].length}</b>
        <button class="btn small" data-action="add-to" data-side="${side}" aria-label="One more">+</button>
      </div>`).join('')}
  </section>`;
}

/* ---------- Sheet (screen preview + print) ---------- */
function viewSheet(g) {
  const missing = [];
  if (!g.league) missing.push('league');
  if (!g.home.name || !g.away.name) missing.push('team names');
  return `
  <section class="card">
    <div class="btnrow">
      <button class="btn primary big" data-action="print">🖨 Print / save PDF</button>
      <button class="btn big" data-action="share-game" data-id="${g.id}">📤 Send to someone to carry on</button>
    </div>
    ${missing.length ? `<p class="warn">Missing: ${missing.join(', ')}.</p>` : ''}
    <p class="muted small">Prints one A4 landscape page. On iPhone/iPad: Share → Print, or pinch out on the print preview to save a PDF.</p>
  </section>
  <div class="sheet-wrap" id="sheetWrap"><div class="sheet-scale" id="sheetScale">${sheetHTML(g)}</div></div>`;
}
function fitSheet() {
  const wrap = $('#sheetWrap'), sc = $('#sheetScale');
  if (!wrap || !sc) return;
  const w = wrap.clientWidth, sheetW = 1123; // 297mm at 96dpi
  const k = Math.min(1, w / sheetW);
  sc.style.transform = `scale(${k})`;
  wrap.style.height = (794 * k) + 'px';
}

function sheetHTML(g) {
  const { s, score, pim } = stats(g);
  const times = computePenalties(g);
  const discipline = g.penalties.some(p => ['10', 'GM', 'MA'].includes(p.type));
  const teamBlock = side => {
    const players = sortedPlayers(g, side);
    const goals = sortedGoals(g, side);
    const pens = sortedPens(g, side, times);
    const rows = [];
    for (let i = 0; i < ROSTER_ROWS; i++) {
      const p = players[i], st = p ? (s[side][p.id] || {}) : {};
      const go = goals[i], pe = pens[i];
      rows.push(`<tr>
        <td class="nm">${p && p.nm ? 'NM' : ''}</td><td class="c">${p ? esc(p.no) : ''}</td><td class="name">${p ? esc(p.name) : ''}</td>
        <td class="c">${st.g || ''}</td><td class="c">${st.a || ''}</td><td class="c">${st.pim || ''}</td>
        <td class="gap"></td>
        ${goalCells(g, side, go)}
        <td class="gap"></td>
        ${penCells(g, side, pe)}
      </tr>`);
    }
    const bench = s[side][BENCH] || {};
    const extraPens = pens.slice(ROSTER_ROWS), extraGoals = goals.slice(ROSTER_ROWS);
    rows.push(`<tr class="bench">
      <td></td><td class="c">0</td><td class="name c">Bench</td><td></td><td></td><td class="c">${bench.pim || ''}</td>
      <td class="gap"></td>${goalCells(g, side, extraGoals[0])}<td class="gap"></td>${penCells(g, side, extraPens[0])}</tr>`);
    return `
    <table class="team">
      <colgroup><col style="width:4.5%"><col style="width:4.5%"><col style="width:23%"><col style="width:3.5%"><col style="width:3.5%"><col style="width:4.5%">
      <col style="width:1.2%"><col style="width:6%"><col style="width:5%"><col style="width:4%"><col style="width:4%"><col style="width:4%">
      <col style="width:1.2%"><col style="width:4%"><col style="width:4%"><col style="width:7%"><col style="width:5.6%"><col style="width:5.6%"><col style="width:5.6%"></colgroup>
      <thead>
        <tr class="hdr1"><th colspan="2" class="l">${side === 'home' ? 'HOME' : 'AWAY'}<br>TEAM</th><th colspan="4" class="l teamname">${esc(g[side].name)}</th>
          <th class="gap"></th><th colspan="5" class="cap">${side === 'home' ? 'Home' : 'Away'} Scoring</th><th class="gap"></th>
          <th colspan="3" class="cap">${side === 'home' ? 'Home' : 'Away'} Penalties</th><th colspan="3" class="cap">Penalty Times</th></tr>
        <tr class="hdr2"><th></th><th>No.</th><th>Name</th><th>G</th><th>A</th><th>PIM</th><th class="gap"></th>
          <th>TIME</th><th>TYPE</th><th>G</th><th>A</th><th>A</th><th class="gap"></th>
          <th>No.</th><th>PIM</th><th>OFFENCE</th><th>GIVEN</th><th>START</th><th>END</th></tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;
  };
  const scoreRow = (side, arr) => `<tr><td class="l">${esc(g[side].name)}</td>${arr.map(v => `<td class="c">${v}</td>`).join('')}<td class="c">${sum(arr)}</td></tr>`;
  const nmBlock = side => {
    const nm = g.netminders[side];
    const row = (name, r) => {
      const tot = sum(r.shots);
      return `<tr><td class="l">${esc(name)}</td><td class="c">${fmtH(parseClock(r.toi) ?? 0)}</td>${r.shots.map(v => `<td class="c">${esc(v)}</td>`).join('')}<td class="c">${tot}</td></tr>`;
    };
    return nm.rows.map(r => row(r.playerId ? (player(g, side, r.playerId)?.name || '') : '', r)).join('') + row('Empty Net', nm.empty);
  };
  const toCalled = '';
  return `
  <div class="sheet">
    <div class="left">
      ${teamBlock('home')}
      ${teamBlock('away')}
    </div>
    <div class="right">
      <div class="box headbox">
        <div class="logo-space"></div>
        <div class="official">OFFICIAL GAME SHEET</div>
      </div>
      <div class="box details">
        <div class="bold c">Game Details</div>
        <div class="kv"><span>Home Team:</span><b>${esc(g.home.name)}</b></div>
        <div class="kv"><span>Away Team:</span><b>${esc(g.away.name)}</b></div>
        <div class="kv two"><span>Date:</span><b>${esc(fmtDate(g.date))}</b><span>Time:</span><b>${esc(g.time)}</b></div>
        <div class="kv"><span>Venue:</span><b>${esc(g.venue)}</b></div>
        <div class="kv"><span>Competition:</span><b>${esc(g.league)}</b></div>
      </div>
      <table class="box grid"><colgroup><col style="width:40%"><col><col><col><col><col></colgroup>
        <tr class="hd"><th class="l">Period Scores</th><th>1</th><th>2</th><th>3</th><th>OT</th><th>TOT</th></tr>
        ${scoreRow('home', score.home)}${scoreRow('away', score.away)}
      </table>
      <table class="box grid"><colgroup><col style="width:40%"><col><col><col><col><col></colgroup>
        <tr class="hd"><th class="l">Penalty Minutes</th><th>1</th><th>2</th><th>3</th><th>OT</th><th>TOT</th></tr>
        ${scoreRow('home', pim.home)}${scoreRow('away', pim.away)}
      </table>
      <table class="box grid nmt"><colgroup><col style="width:33%"><col style="width:17%"><col><col><col><col><col></colgroup>
        <tr><th colspan="7">NetMinders (Shots on goal)</th></tr>
        <tr class="hd"><th class="l">Home - Name</th><th>Time-on</th><th>1</th><th>2</th><th>3</th><th>OT</th><th>TOT</th></tr>
        ${nmBlock('home')}
        <tr class="hd"><th class="l">Away - Name</th><th>Time-on</th><th>1</th><th>2</th><th>3</th><th>OT</th><th>TOT</th></tr>
        ${nmBlock('away')}
      </table>
      <div class="box timeouts">
        <div><b>Time Outs</b><br><b>Called:</b> ${esc(toCalled)}</div>
        <div><b>Home:</b> ${g.timeouts.home.length}</div>
        <div><b>Away:</b> ${g.timeouts.away.length}</div>
      </div>
      <div class="box officials">
        <div class="ref"><b>Referee:</b></div>
        <div class="fao ${discipline ? 'flag' : ''}"><b>FAO Discipline</b><br><b>(10/20 pens issued)</b>${discipline ? '<div class="tick">✔ YES</div>' : ''}</div>
        <div class="sig"><b>Signature</b><span>/</span></div>
        ${['Linesman:', 'Linesman:', 'Supervisor:', 'Scorer:', 'Timekeeper:', 'Goal Judge:', 'Goal Judge:'].map(x => `<div class="line"><b>${x}</b></div>`).join('')}
        <div class="line"><b>ATTENDANCE:</b> ${esc(g.attendance)}</div>
      </div>
    </div>
  </div>`;
}
function goalCells(g, side, go) {
  if (!go) return '<td></td><td></td><td></td><td></td><td></td>';
  return `<td class="c">${fmt(go.t)}</td><td class="c">${esc(go.type)}</td><td class="c">${esc(noOf(g, side, go.scorer))}</td><td class="c">${esc(noOf(g, side, go.a1))}</td><td class="c">${esc(noOf(g, side, go.a2))}</td>`;
}
function penCells(g, side, pe) {
  if (!pe) return '<td></td><td></td><td></td><td></td><td></td><td></td>';
  const ty = PEN_TYPES[pe.type];
  return `<td class="c">${esc(noOf(g, side, pe.playerId))}</td><td class="c">${ty.label}</td><td class="c">${esc(pe.offence)}</td><td class="c">${fmt(pe.given)}</td><td class="c">${fmt(pe.start)}</td><td class="c">${pe.end == null ? '' : fmt(pe.end)}</td>`;
}

/* ---------- live previews ---------- */
function updatePreviews() {
  const g = game(); if (!g) return;
  for (const [form, el] of [['ev', '#evPreview']]) {
    const box = $(el); const d = drafts[form]; if (!box || !d) continue;
    if (!d.clock) { box.textContent = ''; box.className = 'preview'; continue; }
    const err = clockError(g, d.period, d.clock);
    if (err) { box.textContent = err; box.className = 'preview bad'; continue; }
    const t = elapsed(g, d.period, parseClock(d.clock));
    box.innerHTML = `Clock ${fmt(parseClock(d.clock))} in ${d.period === 'OT' ? 'OT' : 'P' + d.period} → sheet time <b>${fmt(t)}</b>`;
    box.className = 'preview ok';
  }
}

/* ============================================================
   Events
   ============================================================ */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab],[data-action],[data-set]');
  if (!t || t.disabled) return;
  if (t.dataset.tab) { tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.set) {
    const [form, key] = t.dataset.set.split('.');
    drafts[form][key] = t.dataset.val;
    if (key === 'team') Object.assign(drafts[form], { scorer: '', a1: '', a2: '', playerId: '' }); // players belong to a team
    render(); return;
  }
  const a = t.dataset.action, g = game(), id = t.dataset.id, side = t.dataset.side;
  if (t.tagName === 'INPUT' && t.type === 'file') return;
  switch (a) {
    case 'new-game': newGame(); drafts.goal = drafts.pen = drafts.ev = drafts.editing = null; tab = 'pre'; break;
    case 'open-game': state.currentId = id; drafts.goal = drafts.pen = drafts.editingGoal = drafts.editingPen = drafts.ev = drafts.editing = null; save(); tab = 'game'; break;
    case 'delete-game':
      if (!confirmInline(t, 'Delete game?')) return;
      delete state.games[id]; if (state.currentId === id) state.currentId = null; save(); break;
    case 'add-player': g[side].players.push({ id: uid(), no: '', name: '', nm: false }); save(); render();
      setTimeout(() => { const ins = document.querySelectorAll(`input[data-side="${side}"][data-field="no"]`); ins[ins.length - 1]?.focus(); }, 0); return;
    case 'del-player':
      if (isReferenced(g, side, id) && !confirmInline(t, 'In use — remove?')) return;
      g[side].players = g[side].players.filter(p => p.id !== id); save(); break;
    case 'clear-roster': if (!confirmInline(t, 'Clear all?')) return; g[side].players = []; save(); break;
    case 'save-event': if (!saveEvent(g)) return; break;
    case 'cancel-event': drafts.ev = blankEvent(drafts.ev?.period); drafts.editing = null; break;
    case 'edit-goal': { const x = g.goals.find(x => x.id === id);
      drafts.ev = { ...blankEvent(x.period), clock: x.clock, team: x.team, kind: 'goal', scorer: x.scorer, a1: x.a1, a2: x.a2, gtype: x.type };
      drafts.editing = { kind: 'goal', id }; window.scrollTo(0, 0); break; }
    case 'edit-pen': { const x = g.penalties.find(x => x.id === id);
      drafts.ev = { ...blankEvent(x.period), clock: x.clock, team: x.team, kind: 'pen', playerId: x.playerId, ptype: x.type, offence: x.offence, startOverride: x.startOverride || '', endOverride: x.endOverride || '' };
      drafts.editing = { kind: 'pen', id }; window.scrollTo(0, 0); break; }
    case 'del-goal': if (!confirmInline(t, 'Delete?')) return; g.goals = g.goals.filter(x => x.id !== id); if (drafts.editing?.id === id) { drafts.ev = null; drafts.editing = null; } save(); break;
    case 'del-pen': if (!confirmInline(t, 'Delete?')) return; g.penalties = g.penalties.filter(x => x.id !== id); if (drafts.editing?.id === id) { drafts.ev = null; drafts.editing = null; } save(); break;
    case 'toggle-pp': { const x = g.penalties.find(x => x.id === id); x.noPP = !x.noPP; save(); break; }
    case 'full-game': {
      const L = periodLen(g), otPlayed = g.goals.some(x => x.period === 'OT') || g.penalties.some(x => x.period === 'OT');
      g.netminders[side].rows[+t.dataset.row].toi = fmt(3 * L + (otPlayed ? otLen(g) : 0)); save(); break;
    }
    case 'add-to': g.timeouts[side].push({}); save(); break;
    case 'del-to': g.timeouts[side].pop(); save(); break;
    case 'print': doPrint(g); return;
    case 'share-game': shareGame(state.games[id]); return;
    case 'accept-incoming': state.games[incoming.id] = incoming; state.currentId = incoming.id; incoming = null; save();
      drafts.ev = drafts.editing = null; tab = 'game'; toast('Game loaded'); break;
    case 'reject-incoming': incoming = null; break;
    case 'paste-link': { const v = $('#pasteLink').value; const i = v.indexOf('#g='); if (i < 0) { toast("That doesn't look like a game link."); return; }
      readShared(v.slice(i + 3)); return; }
    default: return;
  }
  render();
});

/** Two-tap confirm without browser dialogs. */
function confirmInline(btn, msg) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1'; const old = btn.textContent; btn.textContent = msg; btn.classList.add('armed');
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; btn.classList.remove('armed'); } }, 3000);
  return false;
}
function isReferenced(g, side, id) {
  return g.goals.some(x => x.team === side && [x.scorer, x.a1, x.a2].includes(id)) || g.penalties.some(x => x.team === side && x.playerId === id);
}

document.addEventListener('input', e => {
  const el = e.target, g = game(); if (!g) return;
  if (el.dataset.bind) {
    const path = el.dataset.bind.split('.'); let o = g;
    while (path.length > 1) o = o[path.shift()];
    o[path[0]] = el.value; save();
    if (el.dataset.bind === 'league') render();
    else $('#gameTitle').textContent = `${g.home.name || 'Home'} v ${g.away.name || 'Away'}`;
  } else if (el.dataset.draft) {
    const [form, key] = el.dataset.draft.split('.');
    drafts[form][key] = el.value; updatePreviews();
  } else if (el.dataset.player) {
    const p = g[el.dataset.side].players.find(p => p.id === el.dataset.player);
    p[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value; save();
  } else if (el.dataset.nm) {
    const path = el.dataset.nm.split('.'); let o = g.netminders;
    while (path.length > 1) o = o[path.shift()];
    o[path[0]] = el.value; save();
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.action === 'gameday' && el.files && el.files[0]) { importGameday(el.files[0], !!el.dataset.new); el.value = ''; }
  else if (el.dataset.player && el.dataset.field === 'no') render(); // re-sort/flag duplicates
});
window.addEventListener('resize', () => tab === 'sheet' && fitSheet());

function saveGoal(g) {
  const d = drafts.goal;
  const err = clockError(g, d.period, d.clock);
  if (err) { toast(err); return false; }
  if (!d.scorer) { toast('Pick the scorer.'); return false; }
  if (d.a1 && d.a1 === d.scorer || d.a2 && (d.a2 === d.scorer || d.a2 === d.a1)) { toast('Scorer and assists must be different players.'); return false; }
  if (!d.a1 && d.a2) { d.a1 = d.a2; d.a2 = ''; }
  const rec = { id: drafts.editingGoal || uid(), team: d.team, period: d.period, clock: fmt(parseClock(d.clock)), scorer: d.scorer, a1: d.a1, a2: d.a2, type: d.type };
  if (drafts.editingGoal) g.goals = g.goals.map(x => x.id === rec.id ? rec : x); else g.goals.push(rec);
  toast(`Goal saved at ${fmt(goalTime(g, rec))}`);
  drafts.goal = { team: d.team, period: d.period, clock: '', scorer: '', a1: '', a2: '', type: 'E' };
  drafts.editingGoal = null; save(); return true;
}
function savePen(g) {
  const d = drafts.pen;
  const err = clockError(g, d.period, d.clock);
  if (err) { toast(err); return false; }
  if (!d.playerId) { toast('Pick the player (or Bench).'); return false; }
  if (!d.offence) { toast('Pick the offence.'); return false; }
  for (const k of ['startOverride', 'endOverride']) if (d[k] && parseClock(d[k]) == null) { toast('Override times look like 24:38.'); return false; }
  const old = drafts.editingPen ? g.penalties.find(x => x.id === drafts.editingPen) : {};
  const rec = { ...old, id: drafts.editingPen || uid(), team: d.team, period: d.period, clock: fmt(parseClock(d.clock)), playerId: d.playerId, type: d.type, offence: d.offence,
    startOverride: d.startOverride ? fmt(parseClock(d.startOverride)) : '', endOverride: d.endOverride ? fmt(parseClock(d.endOverride)) : '' };
  if (drafts.editingPen) g.penalties = g.penalties.map(x => x.id === rec.id ? rec : x); else g.penalties.push(rec);
  toast('Penalty saved');
  drafts.pen = { team: d.team, period: d.period, clock: '', playerId: '', type: '2', offence: '', startOverride: '', endOverride: '' };
  drafts.editingPen = null; save(); return true;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function doPrint(g) {
  const abbr = s => (s || '').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase();
  const old = document.title;
  document.title = `${(g.date || '').replace(/-/g, '')} ${abbr(g.home.name)} v ${abbr(g.away.name)} ${(g.league || '').replace(/\s+/g, '')} Game Sheet`;
  $('#printArea').innerHTML = sheetHTML(g);
  window.print();
  setTimeout(() => { document.title = old; }, 1000);
}

/* ---------- script loader ---------- */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s); });
}

/* ============================================================
   Gameday team sheet PDF → game details + both rosters
   ============================================================ */
const PDF_DIR = 'vendor/pdfjs/';  // pdf.js 3.11.174 (Apache-2.0)

/** Map Gameday's grade ("U16 South 1", "U19 National") to a league in the list. */
function matchLeague(grade) {
  const g = (grade || '').trim();
  const exact = REF.leagues.find(l => l.name.toLowerCase() === g.toLowerCase());
  if (exact) return exact.name;
  const age = /U\s?(\d{2})/i.exec(g);
  if (!age) return '';
  if (/national/i.test(g)) return REF.leagues.find(l => l.name === `U${age[1]} National`)?.name || '';
  const div = /(?:south|s|div(?:ision)?)\s*(\d)/i.exec(g.replace(age[0], ''));
  return div ? (REF.leagues.find(l => l.name === `U${age[1]} S${div[1]}`)?.name || '') : '';
}

/** Read each page's text into rows of cells (top to bottom, left to right). */
async function pdfRows(file) {
  if (!window.pdfjsLib) await loadScript(PDF_DIR + 'pdf.min.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_DIR + 'pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  const rows = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const items = (await page.getTextContent()).items.filter(i => i.str && i.str.trim())
      .map(i => ({ s: i.str.trim(), x: i.transform[4], y: -i.transform[5] + n * 10000, h: Math.abs(i.transform[3]) || 8 }));
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    const pageRows = [];
    for (const it of items) {
      const r = pageRows.find(r => Math.abs(r.y - it.y) <= Math.max(2, it.h * 0.4));
      if (r) r.c.push(it); else pageRows.push({ y: it.y, c: [it] });
    }
    pageRows.forEach(r => r.c.sort((a, b) => a.x - b.x));
    rows.push(...pageRows.sort((a, b) => a.y - b.y).map(r => r.c));
  }
  return rows;
}

function parseGameday(rows) {
  const out = { home: { name: '', players: [] }, away: { name: '', players: [] }, date: '', time: '', venue: '', grade: '' };
  let side = null;
  for (const cells of rows) {
    const line = cells.map(c => c.s).join(' ').replace(/\s+/g, ' ');
    const team = /(?:^|\s)TEAM:\s*(.+?)(?:\s+SCORING\b|$)/.exec(line);
    if (team && !/HOME TEAM|AWAY TEAM/i.test(line.slice(0, team.index + 12))) {
      side = side ? 'away' : 'home';
      out[side].name = team[1].trim();
      continue;
    }
    if (!out.date) { const m = /Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i.exec(line); if (m) out.date = `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`; }
    if (!out.time) { const m = /Time:\s*(\d{1,2}:\d{2})/i.exec(line); if (m) out.time = m[1].padStart(5, '0'); }
    if (!out.venue) { const m = /Venue:\s*(.+?)\s*$/i.exec(line); if (m) out.venue = m[1].replace(/\s+(Grade|ICE HOCKEY).*$/i, '').trim(); }
    if (!out.grade) { const m = /(?:Grade|Competition):\s*(.+?)\s*$/i.exec(line); if (m) out.grade = m[1].trim(); }
    if (!side) continue;
    // A roster row: row count, shirt number, "Surname, First"
    let p = null;
    const i = cells.findIndex(c => /,/.test(c.s) && /[A-Za-z]/.test(c.s));
    if (i >= 1 && /^\d{1,3}$/.test(cells[i - 1].s)) p = { no: String(+cells[i - 1].s), name: cells[i].s };
    else {
      const m = /^\d{1,2}\s+(\d{1,3})\s+([^,\d]+,\s*[A-Za-zÀ-ÿ'’\- ]+?)(?:\s+[A-Z]{2,5}(?:-[A-Z])?\b.*)?$/.exec(line);
      if (m) p = { no: String(+m[1]), name: m[2].trim() };
    }
    if (p && !out[side].players.some(x => x.name === p.name)) out[side].players.push(p);
  }
  return out;
}

async function importGameday(file, asNew) {
  if (asNew) { newGame(); drafts.goal = drafts.pen = drafts.editingGoal = drafts.editingPen = null; tab = 'pre'; render(); }
  const status = () => $('#gd-status');
  const say = (m, cls = '') => { const s = status(); if (s) { s.textContent = m; s.className = 'ocr-status ' + cls; } else toast(m); };
  try {
    say('Reading the Gameday PDF…');
    const d = parseGameday(await pdfRows(file));
    if (!d.home.players.length && !d.away.players.length && !d.home.name) { say("That PDF doesn't look like a Gameday team sheet.", 'bad'); return; }
    const g = game();
    for (const side of ['home', 'away']) {
      if (d[side].name) g[side].name = d[side].name;
      if (d[side].players.length) g[side].players = d[side].players.map(p => {
        const old = g[side].players.find(o => o.name.toLowerCase() === p.name.toLowerCase());
        return old ? { ...old, no: p.no } : { id: uid(), no: p.no, name: p.name, nm: false };
      }).concat(g[side].players.filter(o => isReferenced(g, side, o.id) && !d[side].players.some(p => p.name.toLowerCase() === o.name.toLowerCase())));
    }
    if (d.date) g.date = d.date;
    if (d.time) g.time = d.time;
    if (d.venue) g.venue = d.venue;
    const lg = matchLeague(d.grade);
    if (lg) g.league = lg;
    save(); render();
    const msg = `Filled from Gameday: ${d.home.players.length} home and ${d.away.players.length} away players.` +
      (d.grade && !lg ? ` Couldn't match the grade "${d.grade}" to a league, so please pick it.` : '') +
      ' Tick NM for the netminders on the Rosters tab.';
    say(msg, d.grade && !lg ? 'bad' : 'ok');
  } catch (err) {
    console.error(err);
    say(navigator.onLine === false ? 'The PDF reader has not finished downloading yet. Open the app once with a signal.' : 'Could not read that PDF.', 'bad');
  }
}

/* ============================================================
   Send a game to someone else, as a link.
   The game travels in the part of the link after "#", which browsers never send to a server.
   ============================================================ */
let incoming = null;
const b64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
async function encodeGame(g) {
  const raw = new TextEncoder().encode(JSON.stringify(g));
  if (window.CompressionStream) return 'z' + b64u(await pipe(raw, new CompressionStream('deflate-raw')));
  return 'j' + b64u(raw);
}
async function decodeGame(code) {
  const kind = code[0], bytes = unb64u(decodeURIComponent(code.slice(1)));
  const raw = kind === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  const g = JSON.parse(new TextDecoder().decode(raw));
  if (!g || !g.id || !g.home || !g.away || !Array.isArray(g.goals) || !Array.isArray(g.penalties)) throw new Error('not a game');
  g.netminders ||= { home: blankNM(), away: blankNM() }; g.timeouts ||= { home: [], away: [] };
  return g;
}
async function shareGame(g) {
  if (!g) return;
  try {
    const url = location.origin + location.pathname + '#g=' + await encodeGame(g);
    const title = `${g.home.name || 'Home'} v ${g.away.name || 'Away'}`;
    const text = `Gamesheet: ${title} (${fmtDate(g.date)}). Open the link to load it and carry on.`;
    if (navigator.share) { await navigator.share({ title, text, url }); return; }
    await navigator.clipboard.writeText(url);
    toast('Link copied. Paste it into a message to send it.');
  } catch (e) { if (e && e.name !== 'AbortError') toast('Could not share from this browser.'); }
}
async function readShared(code) {
  try { incoming = await decodeGame(code); tab = 'games'; render(); window.scrollTo(0, 0); }
  catch (e) { toast('That game link is incomplete or damaged.'); }
}
function checkHash() {
  const h = location.hash;
  if (h.startsWith('#g=')) { history.replaceState(null, '', location.pathname); readShared(h.slice(3)); }
}
window.addEventListener('hashchange', checkHash);

/* ---------- boot ---------- */
render();
checkHash();
(function splash() {
  const el = document.getElementById('splash'); if (!el) return;
  const hide = () => { if (el.classList.contains('out')) return; el.classList.add('out'); setTimeout(() => el.remove(), 600); };
  el.addEventListener('click', hide);
  setTimeout(hide, matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 2600);
})();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
