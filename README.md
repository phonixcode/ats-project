# MG-ATS

Every resume gets a real look.

MG-ATS is a single-recruiter applicant tracker. You post a role, upload a zip of resumes, make a call (shortlist / maybe later / not this time), and export the shortlist as a spreadsheet.

It runs on your machine. No cloud account is required. Postgres and Redis are not required.

## What you need

- Node.js 20 or newer
- npm

Optional:

- Cloud keys (OpenAI, Claude, or Gemini) in **Settings**. You only need one. Without a key, MG-ATS still scores with a basic built-in read.

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

1. Open **Settings** and paste an OpenAI, Claude, or Gemini key (one is enough). Skip this for a basic built-in read.
2. Post a job — title, description, and who you need in one box.
3. Drag in resumes — a `.zip`, or one or many PDF/Word files.
4. Open **Review**. Work the “To review” list, 20 at a time.
5. Open a candidate, tap **Shortlist** when they should go forward.
6. **Export shortlist** downloads a CSV you can open in Excel.

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

On the Windows app, add cloud keys in **Settings**. They stay in `%APPDATA%\MG-ATS\settings.json`. We do not ship a local-model installer — an 8GB PC is a poor fit for that.

## Where your data lives

| Mode | Database and uploads |
|---|---|
| Laptop (`npm run start:dev`) | `backend/data/` (`mg-ats.db`, `uploads/`) |
| Packaged Windows app | `%APPDATA%\MG-ATS\` |

Uninstalling the Windows app does not delete that folder unless you choose to. Updates never touch it.

Before the app changes the database structure on an update, it saves a copy to `backups\` in the same folder (the last 5 are kept). To roll back, close MG-ATS and copy a backup over `mg-ats.db`.

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

### Shipping an update

Installed apps check this repo's GitHub Releases on start and every 4 hours (Help → **Check for updates…** checks now). The repo must be public for that to work.

```bash
git tag v0.2.0
git push origin v0.2.0
```

The tag sets the app version, so each release needs a higher number than the last. CI publishes the installer, `latest.yml` and the `.blockmap`; the app needs all three. Users see **Update now / Later**, the download runs in the background, then **Restart now** installs it into the same folder. Their data folder is left alone.

Changing the database:

1. Edit `backend/prisma/schema.prisma`.
2. `cd backend && npx prisma migrate dev --name what_changed` — commit the new folder under `prisma/migrations/`.
3. Keep changes additive: new tables, and new columns that are optional or have a default. Never rename or drop a column people's data lives in; add the new one and copy across in the same migration.

On start, the app applies migrations it hasn't run yet, one at a time, each all-or-nothing, after taking a backup.

Do not pack from a Mac. Native modules will be wrong.

To pack on a Windows PC:

```bash
cd backend && npm install && npx prisma generate && npm run build
cd ../frontend && npm install && npm run build
cd ../desktop && npm install && npm run pack:win
```

The installer is in `desktop/release/`. It adds Start Menu and desktop shortcuts. Remove it from Windows Settings → Apps. You will be asked whether to keep your roles and shortlists.

The installer includes Chromium (Electron). That sets a floor around ~80–120MB after compression. Dev tools and unused packages are left out of the pack.

### Windows SmartScreen

Windows will warn on an unsigned installer. There is no code-only way to make SmartScreen trust it. You need an **Authenticode code signing certificate** from a public CA (DigiCert, Sectigo, or SSL.com). An EV certificate clears SmartScreen faster than a standard OV certificate.

Add these GitHub Actions secrets, then re-run **Windows installer**:

| Secret | Value |
|---|---|
| `WINDOWS_CSC_LINK` | Base64 of your `.pfx` file, or a `https://` URL to it |
| `WINDOWS_CSC_KEY_PASSWORD` | Password for that `.pfx` |

Encode the cert on a trusted machine: `base64 -i certificate.pfx | pbcopy` (macOS) or `[Convert]::ToBase64String([IO.File]::ReadAllBytes('certificate.pfx'))` (Windows).

Until Microsoft has seen enough signed downloads, some PCs may still show SmartScreen once. Choose **More info** → **Run anyway**. After reputation builds, that prompt goes away.

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
| Desktop window says it could not start | Rebuild the API (`cd backend && npm run build`) then `cd desktop && npm start` again. |
| Desktop says it took too long to start | Close other programs (browser, Cursor, etc.), then open MG-ATS again. 8GB PCs need the spare memory. First launch can take a few minutes. |
| Empty roles list after the SQLite switch | Expected. Post a job and upload resumes again. |
| Scoring stuck | Stay on the candidate page — it updates when the score is ready. Or tap **Score leftover** if resumes are still waiting. |
| “Couldn’t read this file” | The zip entry was not a readable PDF/Word resume. Skip it or fix the file and upload again. |
| Upload fails or a batch shows nothing read | Desktop: **Help → Open logs folder** and check `api.log`, or **Help → Export logs…** to save a copy to share. Each upload logs what it received, extracted, and skipped. **View → Toggle Developer Tools** shows UI errors. |

No Redis. No Postgres. No public server port — the API binds to this machine only.
