# Korosha ATS

An applicant tracking system for a small caregiver recruiting team, built as a self-contained demo that runs on local CSV files with no database and no accounts.

**Live demo:** [link to be added after deployment]

## Screenshots

| Analytics | Current Status |
| --- | --- |
| ![Analytics](docs/analytics.png) | ![Current Status board](docs/current-status.png) |
| **Applicants** | **History** |
| ![Applicants](docs/applicants.png) | ![History](docs/history.png) |

## What it does

- **Work the applicant list.** Every active applicant, newest first, filterable by job posting, with a status change, a call, notes and History on each row. Create new job postings from the same page.
- **See current status.** A board with a column per status for every active applicant, including new submissions from the public apply form, for all postings or one. Change a status from a card or the candidate record. Statuses are editable in settings.
- **Keep the history.** Notes, and a timeline of every status change, call and move to History on each candidate.
- **Log calls.** A call flow records the outcome, duration and notes, adds a written summary to the history, shows earlier attempts, and can move the applicant to the next stage in the same step. Calls are simulated in this demo.
- **History.** Move finished applicants out of the working views without losing them, and restore them at any time.
- **See the numbers.** Applications and calls per week, status and source breakdowns, status conversion, time to hire and call connect rate, computed live from the data.

## How it is built

Next.js 15 (App Router), React 19 and TypeScript, styled with Tailwind CSS. Data lives in flat files: six CSVs in `data/` for job postings, statuses, applications, notes, call logs and an activity log, read and written through a single store module. There is no database, no account system and no external service at runtime, so the app runs as soon as it is installed.

A Python script using only the standard library generates the demo data: 150 applications across six job postings. Tests run on Vitest.

## Running it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Requires Node.js 18.18 or newer. Changes you make are saved to the CSV files.

The generated data is committed, so Python is not needed to run the app. It is only needed to reset the data to a fresh state with `npm run seed` (Python 3).

## How this differs from production

This demo is cut from an ATS I built during my internship. The recruiting workflow is the same; the infrastructure was replaced so it runs anywhere with no setup.

- **Storage.** Production ran on PostgreSQL through Prisma. Here the same records live in CSV files behind one store module.
- **Intake.** Production ingested applications by email and parsed resumes automatically. Here applicants come from generated data and the apply form. Applications marked Email stand in for that path; nothing is ingested.
- **Calling.** Production placed real calls and produced call summary reports. Here the call flow is simulated: nothing dials out, and the summary is generated from the outcome, duration and notes.
- **Sign-in.** Production required sign-in. The demo has no accounts.
- **Hosting.** Where the filesystem is read-only, as on a hosted deployment, the store loads the CSVs into memory and applies changes there. Changes are held by the server instance that received them, so they reset when that instance restarts and on every redeploy.
- **Data.** Every applicant, email, phone number and note is generated. No real applicant information is included.

## Engineering notes

- **Atomic writes.** The store writes each table to a temporary file and renames it over the original, so a crash mid-write never leaves a truncated CSV. The seed script replaces files the same way.
- **One interface, two modes.** On first use the store tries a single write in `data/` and caches the result. If the directory is writable it reads and writes the files directly; if not, it loads each CSV into memory once and keeps changes there. The same `selectAll`, `selectOne`, `insert`, `update` and `remove` calls work in both modes.
- **Reproducible data with current dates.** The seed simulates each applicant through the hiring statuses on a fixed calendar, using its own seeded random stream, then shifts the timeline to the present by whole weeks. Every run produces the same pipeline outcomes, timings and call results, and the dates always look recent.
- **Checked numbers.** `python3 scripts/seed.py --check` validates the generated data against target rates for 14 consecutive days. `--report` recomputes the analytics from the CSVs without the app, so the analytics page can be compared against an independent calculation.
