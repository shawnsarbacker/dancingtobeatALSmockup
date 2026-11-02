// Shared team storage for the committee review site.
// The team list is one CSV file ("teams.csv") kept in Netlify Blobs, so every
// reviewer sees the same teams. The first read seeds it from teams-data.json.
import { getStore } from '@netlify/blobs';
import seed from '../../teams-data.json';
import { toCsv, parseCsv, rowsFromSeed, rowToTeam, upsert } from '../lib/teams-csv.mjs';

const KEY = 'teams.csv';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function load(store) {
  const found = await store.getWithMetadata(KEY, { type: 'text', consistency: 'strong' });
  if (found && found.data != null) return { rows: parseCsv(found.data), etag: found.etag };
  const rows = rowsFromSeed(seed);
  const res = await store.set(KEY, toCsv(rows), { onlyIfNew: true });
  if (res && res.modified === false) return load(store);
  const again = await store.getWithMetadata(KEY, { type: 'text', consistency: 'strong' });
  return { rows: parseCsv(again.data), etag: again.etag };
}

export default async (req) => {
  const store = getStore({ name: 'committee-review', consistency: 'strong' });
  const path = new URL(req.url).pathname;
  try {
    if (req.method === 'GET' && path === '/api/teams.csv') {
      const { rows } = await load(store);
      return new Response(toCsv(rows), { headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="dancing-to-beat-als-teams.csv"',
        'Cache-Control': 'no-store',
      } });
    }
    if (req.method === 'GET' && path === '/api/teams') {
      const { rows } = await load(store);
      return json({ teams: rows.map(rowToTeam), source: 'Shared committee review list (teams.csv)', updated: new Date().toISOString() });
    }
    if (req.method === 'POST' && path === '/api/registrations') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
      for (let attempt = 0; attempt < 5; attempt++) {
        const { rows, etag } = await load(store);
        let result;
        try { result = upsert(rows, body); } catch (e) { return json({ error: e.message }, 400); }
        const res = await store.set(KEY, toCsv(result.rows), { onlyIfMatch: etag });
        if (!res || res.modified !== false) return json({ id: result.row.id, saved: true, created: result.created });
      }
      return json({ error: 'Someone else saved at the same moment. Please click Pay again.' }, 503);
    }
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    return json({ error: 'The shared team list is unavailable right now.' }, 500);
  }
};

export const config = { path: ['/api/teams', '/api/teams.csv', '/api/registrations'] };
