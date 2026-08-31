# Task 10 Verification Report

## Commands

- `cd frontend && npm run build`
- `cd frontend && npm run lint`
- `cd frontend && npm test`
- `cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000`
- `cd frontend && npm run dev -- --host 127.0.0.1 --port 5173`
- `cd frontend && node /tmp/task10-browser.mjs`

## Browser assertions

- Loaded `main-12` and confirmed 12 source-order rows.
- Selected `E2` and `MGR_B`; details changed read-only to Sophia Patel and Mei Chen.
- Previewed `LEAD_A -> MGR_C`; moved card and dashed preview state appeared.
- Applied the valid transfer; `MGR_A` showed `5 -> 2`, `INR 282,000 -> INR 137,000`, and `-INR 145,000`; `MGR_C` showed `2 -> 5`, `INR 117,000 -> INR 262,000`, and `+INR 145,000`; root line stated unchanged and not financially affected.
- Applied the `MGR_A -> E3` cycle preset; `MANAGEMENT_CYCLE` appeared, committed impact text was byte-for-byte retained, and no preview styling remained.
- Used Attempt root move; `ROOT_MOVE_FORBIDDEN` appeared and retained impact was unchanged.
- Reset cleared transfer cards and preview markers, restored one default inspected employee, and cleared transfer selections.
- Reapplied the valid preset and confirmed the same two impact deltas.
- At 390 x 844, no viewport horizontal overflow was detected and the source table remained readable through its horizontal scroll container.

Expected 400 network responses were observed for the cycle and root-protection demonstrations; no application console or page errors occurred.

## Screenshots

Captured outside the repository at `/tmp/task10-shots`:

- `01-desktop-loaded.png`
- `02-desktop-preview.png`
- `03-desktop-applied.png`
- `04-desktop-cycle-rejected.png`
- `05-desktop-root-rejected.png`
- `06-desktop-reset.png`
- `07-desktop-reapplied.png`
- `08-mobile-applied.png`
