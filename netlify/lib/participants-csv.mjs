// Shared participant list for the committee review site (Concept v2.2, charity-led model).
// One CSV file holds two kinds of rows:
//   type=charity — a participating ALS charity's campaign (the legal recipient of its gifts)
//   type=team    — a supporter, family, community or company team fundraising for one charity
// Pure helpers (no Netlify APIs) so they can be tested on their own.

export const DIVISIONS = ['Discovery', 'Care & Support', 'Reach', 'Grassroots'];
export const PROPOSED_FEE = { Reach: 3500, Discovery: 2000, 'Care & Support': 2000, Grassroots: 500 };
export const DIVISION_MINIMUM = { Reach: 25000, Discovery: 25000, 'Care & Support': 25000, Grassroots: 10000 };

export const COLUMNS = [
  'id', 'type', 'registered', 'updated', 'status',
  'name', 'division', 'location', 'website', 'ein', 'legalRecipient',
  'missionFocus', 'revenueOver2m',
  'leadFirst', 'leadLast', 'leadEmail', 'leadRole',
  'dancer', 'dancerTitle', 'dancerRole', 'dancerSelection', 'dancerBio',
  'goal', 'story', 'corporatePartners', 'proposedFee',
  'charityId', 'teamType', 'company',
];

const TEXT_FIELDS = {
  charity: ['name', 'division', 'location', 'website', 'ein', 'legalRecipient', 'missionFocus', 'revenueOver2m',
    'leadFirst', 'leadLast', 'leadEmail', 'leadRole', 'dancer', 'dancerTitle', 'dancerRole', 'dancerSelection',
    'dancerBio', 'story', 'corporatePartners'],
  team: ['name', 'location', 'story', 'charityId', 'teamType', 'company', 'leadFirst', 'leadLast', 'leadEmail'],
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

const blank = () => Object.fromEntries(COLUMNS.map(c => [c, '']));

export function rowsFromSeed(seed) {
  const rows = [];
  for (const c of seed.charities || []) {
    rows.push({ ...blank(), ...c, type: 'charity', goal: String(c.goal ?? ''), proposedFee: String(PROPOSED_FEE[c.division] ?? '') });
  }
  for (const t of seed.teams || []) rows.push({ ...blank(), ...t, type: 'team', goal: String(t.goal ?? '') });
  return rows;
}

// Public shape for the site. Team rows carry their charity's name and division.
export function toPublic(rows) {
  const charities = rows.filter(r => r.type === 'charity');
  const byId = new Map(charities.map(c => [c.id, c]));
  const num = v => Number(v) || 0;
  return {
    charities: charities.map(c => ({ ...c, goal: num(c.goal), proposedFee: num(c.proposedFee),
      teamCount: rows.filter(r => r.type === 'team' && r.charityId === c.id).length })),
    teams: rows.filter(r => r.type === 'team').map(t => {
      const c = byId.get(t.charityId);
      return { ...t, goal: num(t.goal), charityName: c ? c.name : '', division: c ? c.division : '' };
    }),
  };
}

const MAX = 2000;
const clean = v => String(v == null ? '' : v).replace(/\u0000/g, '').slice(0, MAX).trim();

// Insert or replace one participant from a POST body: { id, type, data }.
export function upsert(rows, body, now = new Date().toISOString()) {
  const id = clean(body && body.id);
  const type = body && body.type;
  const d = (body && body.data) || {};
  if (!/^[A-Za-z0-9-]{3,80}$/.test(id)) throw new Error('Missing or invalid id.');
  if (type !== 'charity' && type !== 'team') throw new Error('Unknown participant type.');
  if (!clean(d.name)) throw new Error(type === 'charity' ? 'Charity name is required.' : 'Team name is required.');
  const existing = rows.find(r => r.id === id);
  if (existing && existing.type !== type) throw new Error('That id belongs to a different kind of entry.');
  if (type === 'charity' && !DIVISIONS.includes(clean(d.division))) throw new Error('Choose a division.');
  if (type === 'team') {
    const charity = rows.find(r => r.type === 'charity' && r.id === clean(d.charityId));
    if (!charity) throw new Error('Choose a participating charity.');
  }
  const row = existing ? { ...existing } : blank();
  for (const f of TEXT_FIELDS[type]) if (f in d) row[f] = clean(d[f]);
  row.id = id;
  row.type = type;
  row.goal = String(Math.max(0, Math.round(Number(d.goal) || 0)));
  if (type === 'charity') row.proposedFee = String(PROPOSED_FEE[row.division] ?? '');
  if (!existing) {
    row.registered = now;
    row.status = type === 'charity' ? 'Application received — pending organizer review' : 'Active';
  }
  row.updated = existing ? now : '';
  const next = existing ? rows.map(r => (r.id === id ? row : r)) : [...rows, row];
  return { rows: next, row, created: !existing };
}
