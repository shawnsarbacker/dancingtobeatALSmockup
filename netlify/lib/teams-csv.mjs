// Shared team list for the committee review site, kept as one CSV file.
// Pure helpers (no Netlify APIs) so they can be tested on their own.

export const COLUMNS = [
  'id', 'registered', 'updated', 'status',
  'team', 'location', 'sponsor', 'division', 'goal', 'story',
  'beneficiary', 'beneficiaryId',
  'dancer', 'title', 'candidateRole', 'candidateBio', 'candidateExperience',
  'captainFirst', 'captainLast', 'captainEmail', 'captainConnection', 'captainUpdates',
  'cardVersion', 'cardRate', 'tableTier',
];

// Form field ids on registration.html -> CSV columns
const FORM_TO_COLUMN = {
  team: 'team', homeLocation: 'location', teamSponsor: 'sponsor', division: 'division',
  goal: 'goal', story: 'story', candidateName: 'dancer', candidateTitle: 'title',
  candidateRole: 'candidateRole', candidateBio: 'candidateBio', candidateExperience: 'candidateExperience',
  first: 'captainFirst', last: 'captainLast', email: 'captainEmail',
  connection: 'captainConnection', updates: 'captainUpdates',
};

// Cells that a spreadsheet would treat as a formula get a leading apostrophe.
const RISKY = /^[=+@\t\r]/;
const guard = v => (RISKY.test(v) ? "'" + v : v);
const unguard = v => (v.length > 1 && v[0] === "'" && RISKY.test(v.slice(1)) ? v.slice(1) : v);

function cell(value) {
  const v = guard(value == null ? '' : String(value));
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

export function toCsv(rows) {
  const lines = [COLUMNS.join(',')];
  for (const row of rows) lines.push(COLUMNS.map(c => cell(row[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function parseCsv(text) {
  const records = [];
  let row = [], field = '', quoted = false, i = 0;
  const src = String(text || '').replace(/^﻿/, '');
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { quoted = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(field); field = '';
      if (row.some(v => v !== '')) records.push(row);
      row = [];
      if (ch === '\r' && src[i + 1] === '\n') i++;
      i++; continue;
    }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(v => v !== '')) records.push(row); }
  if (!records.length) return [];
  const header = records[0];
  return records.slice(1).map(r => {
    const o = {};
    header.forEach((h, idx) => { o[h] = unguard(r[idx] ?? ''); });
    for (const c of COLUMNS) if (!(c in o)) o[c] = '';
    return o;
  });
}

export function rowsFromSeed(seed) {
  return (seed.teams || []).map(t => ({
    id: t.id, registered: t.registered || '', updated: '', status: t.status || '',
    team: t.team || '', location: t.location || '', sponsor: t.sponsor || '', division: t.division || '',
    goal: t.goal ?? '', story: t.story || '', beneficiary: t.beneficiary || '', beneficiaryId: '',
    dancer: t.dancer || '', title: t.title || '',
  }));
}

// Row for the site: directory fields plus `form`, which refills team setup for editing.
export function rowToTeam(r) {
  const form = { beneficiaryId: r.beneficiaryId, cardVersion: r.cardVersion, cardRate: r.cardRate, tableTier: r.tableTier };
  for (const [formId, col] of Object.entries(FORM_TO_COLUMN)) form[formId] = r[col];
  form.updates = r.captainUpdates === 'true';
  return {
    id: r.id, registered: r.registered, updated: r.updated, status: r.status,
    team: r.team, location: r.location, sponsor: r.sponsor, division: r.division,
    goal: Number(r.goal) || 0, story: r.story, beneficiary: r.beneficiary,
    dancer: r.dancer, title: r.title, form,
  };
}

const MAX = 2000;
const clean = v => String(v == null ? '' : v).replace(/\u0000/g, '').slice(0, MAX);

// Insert or replace one team from a registration POST body.
export function upsert(rows, body, now = new Date().toISOString()) {
  const id = clean(body && body.id).trim();
  const d = (body && body.draft) || {};
  if (!/^[A-Za-z0-9-]{3,80}$/.test(id)) throw new Error('Missing or invalid team id.');
  if (!clean(d.team).trim()) throw new Error('Team name is required.');
  const existing = rows.find(r => r.id === id);
  const row = existing ? { ...existing } : Object.fromEntries(COLUMNS.map(c => [c, '']));
  for (const [formId, col] of Object.entries(FORM_TO_COLUMN)) {
    if (formId in d) row[col] = formId === 'updates' ? String(!!d[formId]) : clean(d[formId]).trim();
  }
  row.id = id;
  row.goal = String(Number(d.goal) || 0);
  row.beneficiary = clean(body.beneficiary).trim();
  row.beneficiaryId = clean(body.beneficiaryId).trim();
  row.cardVersion = clean(body.cardVersion);
  row.cardRate = clean(body.cardRate);
  row.tableTier = clean(body.tableTier);
  if (!existing) { row.registered = now; row.status = 'Pending organizer acceptance'; }
  row.updated = existing ? now : '';
  const next = existing ? rows.map(r => (r.id === id ? row : r)) : [...rows, row];
  return { rows: next, row, created: !existing };
}
