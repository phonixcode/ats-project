# MG-ATS

Every resume gets a real look.

MG-ATS is a single-recruiter applicant tracker. You post a role, upload a zip of resumes, make a call (shortlist / maybe later / not this time), and export the shortlist as a spreadsheet.

It runs on your machine. No cloud account is required. Postgres and Redis are not required.

## What you need

- Node.js 20 or newer
- npm

Optional:

- [Ollama](https://ollama.com) if you want a local model to score resumes (otherwise the built-in fallback still scores)

## Run it on your laptop

Open two terminals.

**1. API**

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

Wait until you see `MG_ATS_READY http://127.0.0.1:3000`.

**2. UI**

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### First use

1. Post a job — title, description, and who you need in one box.
2. Upload a `.zip` of resumes (PDF or Word).
3. Open **Review**. Work the “To review” list, 20 at a time.
4. Open a candidate, tap **Shortlist** when they should go forward.
5. **Export shortlist** downloads a CSV you can open in Excel.

Scoring can take a few seconds per resume. You can keep reviewing the ones that are ready.

## Local model

In `backend/.env`:

```
LOCAL_LLM_ENABLED=true
LOCAL_LLM_URL=http://127.0.0.1:11434
LOCAL_LLM_MODEL=llama3.2
```

Pull the model once:

```bash
ollama pull llama3.2
```

If Ollama is off or the model fails, MG-ATS falls back to the built-in scorer so the pile still moves.

Cloud keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `CLAUDE_API_KEY`) are optional. Leave them blank for a fully offline setup.

## Where your data lives

| Mode | Database and uploads |
|---|---|
| Laptop (`npm run start:dev`) | `backend/data/` (`mg-ats.db`, `uploads/`) |
| Packaged Windows app | `%APPDATA%\MG-ATS\` |

Uninstalling the Windows app does not delete that folder unless you choose to.

This is a new SQLite file. Roles you had in an old Postgres database are not copied over — post the job again and re-upload resumes.

## Desktop window (smoke test)

Build the API and UI, then open Electron:

```bash
cd backend && npm run build
cd ../frontend && npm run build
cd ../desktop && npm install && npm start
```

The window talks to a local API on `127.0.0.1`. The OS picks a free port so it will not clash with whatever is already on 3000.

## Windows installer

GitHub Actions builds the `.exe` on a Windows runner. After this workflow is on `main`:

1. GitHub → **Actions** → **Windows installer** → **Run workflow**
2. Open that run and download **MG-ATS-windows**

Pushing a `v*` tag (for example `v0.1.0`) also builds and attaches the `.exe` to a GitHub Release.

Do not pack from a Mac. Native modules will be wrong.

To pack on a Windows PC:

```bash
cd backend && npm install && npx prisma generate && npm run build
cd ../frontend && npm install && npm run build
cd ../desktop && npm install && npm run pack:win
```

The installer is in `desktop/release/`. It adds Start Menu and desktop shortcuts. Remove it from Windows Settings → Apps. You will be asked whether to keep your roles and shortlists.

Comfortable machines: 16GB RAM. 8GB works with the small local model and one resume at a time.

## Tests

```bash
cd backend && npm test
```

## Project layout

```
backend/    Nest API, SQLite, in-process scoring queue
frontend/   React review UI
desktop/    Electron shell and Windows NSIS config
```

## If something goes wrong

| What you see | What to do |
|---|---|
| API will not start | Check the terminal for `MG_ATS_READY`. If it errors, stop it and run `npm run start:dev` again from `backend/`. |
| UI cannot load roles | Confirm the API is on `127.0.0.1:3000` and the UI is the Vite dev server (port 5173). |
| Desktop window says it could not start | The window must start the API with **Node**, not Electron. Rebuild the API (`cd backend && npm run build`) then `cd desktop && npm start` again. |
| Empty roles list after the SQLite switch | Expected. Post a job and upload resumes again. |
| Scoring stuck | Stay on the candidate page — it updates when the score is ready. Or tap **Score leftover** if resumes are still waiting. |
| “Couldn’t read this file” | The zip entry was not a readable PDF/Word resume. Skip it or fix the file and upload again. |

No Redis. No Postgres. No public server port — the API binds to this machine only.
