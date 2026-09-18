# Korosha ATS

An applicant tracking system for a small caregiver recruiting team, built as a self-contained demo that runs on local CSV files with no connected databse or in app calling.

**Live demo:** https://applicant-tracking-system-pearl.vercel.app/analytics

## Screenshots

| | | |
|---|---|---|
| **Applicants** | **Analytics** | **History** |
| <a href="https://github.com/user-attachments/assets/9c50e304-9318-4234-9e85-373697367ae0"><img src="https://github.com/user-attachments/assets/9c50e304-9318-4234-9e85-373697367ae0" alt="Applicants" width="320"></a> | <a href="https://github.com/user-attachments/assets/7e0e97dc-3b7b-4489-a6ea-b502e87eb833"><img src="https://github.com/user-attachments/assets/7e0e97dc-3b7b-4489-a6ea-b502e87eb833" alt="Analytics" width="320"></a> | <a href="https://github.com/user-attachments/assets/db9cd495-6954-4669-a65a-60bfea678728"><img src="https://github.com/user-attachments/assets/db9cd495-6954-4669-a65a-60bfea678728" alt="History" width="320"></a> |
| Every active applicant, newest first, filterable by posting, with status, call, notes, and record access on each row. | Weekly application and call volume, status and source breakdowns, and conversion computed live from the data. | Finished applicants kept out of the working views with their full record intact, restorable at any time. |



## What it does

**Analytics.** The landing view. Applications and calls per week, status and source breakdowns, status conversion, time to hire, and call connect rate, all computed live from the data rather than stored.

**Applicants.** A list of every active applicant, newest first, filterable by job posting, with status change, call, notes, History, and a link to the full candidate record on each row. A board view shows a column per status, including new submissions from the public apply form, for all postings or just one. Statuses can be changed from a card or from the record itself, notes and a timeline of every status change and call live on each candidate, and new job postings are created from this same page. The call flow records outcome, duration, and notes, writes a summary into the timeline, shows earlier attempts, and can advance the applicant to the next stage in one step. Calls are simulated in this demo.

**History.** Finished applicants moved out of the working views without being deleted. Everything on the record stays intact, and any of them can be restored at any time.

**Settings.** Configuration for the pipeline itself, including the list of statuses used across the board, list, and candidate records.

## How it is built

Next.js 15 (App Router), React 19 and TypeScript, styled with Tailwind CSS. Data lives in flat files: six CSVs in `data/` for job postings, statuses, applications, notes, call logs and an activity log, read and written through a single store module. There is no database, no account system and no external service at runtime, so the app runs as soon as it is installed.


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


