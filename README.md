# Dancing to Beat ALS — committee review

Static review copy. Connect this repository to Netlify, leave the build command empty, and set publish directory to `.`.

Team directory data is a snapshot in teams-data.json exported from the working Excel workbook. No captain email addresses or payment records are included in that snapshot. Test registrations are saved only in each browser; they are not shared or written back to Excel. Payments and email confirmations are simulations.

The site is not password protected by this source code. noindex requests search engines not to list it; it is not access control.

## Shared team list

Completed test teams are saved to one shared CSV file (`teams.csv`) in Netlify Blobs, so every reviewer sees the same list. The Netlify function in `netlify/functions/teams.mjs` serves:

- `GET /api/teams` — the team list for the site
- `GET /api/teams.csv` — the raw CSV (linked from the Teams page as "Download the team list")
- `POST /api/registrations` — add a team, or update one that was opened for editing

The first time the list is read, it is seeded from `teams-data.json`. The CSV includes captain names and emails entered by testers, so the site should stay behind Netlify visitor access.
