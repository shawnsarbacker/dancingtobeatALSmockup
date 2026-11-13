# Dancing to Beat ALS — committee review

Static review copy. Connect this repository to Netlify, leave the build command empty, and set publish directory to `.`.

Team directory data is a snapshot in teams-data.json exported from the working Excel workbook. No captain email addresses or payment records are included in that snapshot. Test registrations are saved only in each browser; they are not shared or written back to Excel. Payments and email confirmations are simulations.

The site is not password protected by this source code. noindex requests search engines not to list it; it is not access control.

## Shared participant list (Concept v2.2, charity-led model)

Participating charities and the supporter/company teams fundraising for them are saved to one shared CSV file (`participants-v2.csv`) in Netlify Blobs, so every reviewer sees the same list. The Netlify function in `netlify/functions/teams.mjs` serves:

- `GET /api/participants` — charities and teams for the site (`/api/teams` is an alias)
- `GET /api/participants.csv` — the raw CSV (linked from the Charities page)
- `POST /api/registrations` — add or update a charity application (`type: "charity"`) or a fundraising page (`type: "team"`)

The first read seeds the list from `participants-data.json` (fictional charities and teams). The earlier team list (`teams.csv`) is left untouched in storage. The CSV includes contact details testers enter, so the site should stay behind Netlify visitor access.

Pages: `registration.html` (Enter your charity), `fundraise.html` (Fundraise for a charity), `division-guide.html` (mission-first division helper), `teams.html` (Charities directory).
