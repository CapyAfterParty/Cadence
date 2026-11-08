# Cadence

A personal, local-first study app that runs one weekly loop: log past papers, track mistakes, redo them, and review the week.

Everything is stored in your browser (IndexedDB). No accounts, no backend, no cost.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). To build a static site: `npm run build`; the `dist/` folder works on any static host.

## Shortcuts

- `Ctrl K` / `Cmd K`: search everything, jump anywhere, run actions ("start timer", "log paper", ...)
- `N`: add a mistake from any screen (subject defaults to the last one used)
- Redo session: `Space` reveals the fix, `→` right, `←` wrong

## Screens

- **Home**: today chips (what to do now), study time, flashcards, mistakes due, loop score, paper scores, target gauge, study heatmap, this week's goals
- **Subjects**: one hub per subject with notes (markdown), papers, mistakes, scans, weak topics, target and test countdown
- **Mistakes**: filters, inline autosaving editor, redo queue, Anki CSV export, bulk entry ("4, 5, 7a, 14b")
- **Papers**: weekly timed-paper target, all subjects compared, trend per subject, scans per paper
- **Timer**: study sessions (survive refresh, shown in the tab title), timed sprints in full-screen exam mode, flashcard log
- **Check-in**: this week's stats pre-filled, reflection form that saves as you type, past check-ins
- **Settings**: name, redo interval, homepage photo, subjects, JSON backup and restore

## Data safety

The app asks the browser for persistent storage. Export a JSON backup from Settings or the Sunday check-in; importing it restores everything, scans included.

## Code map

- `src/db`: Dexie schema, types, and delete-with-undo operations
- `src/lib`: dates, derived stats (streaks, loop score, weak topics), backup, small stores
- `src/components`: the design system (Card, Stat, Chip, Button, inputs, Sidebar, charts)
- `src/features`: search/palette, mistake and paper forms, timer controller
- `src/pages`: one file per screen
- `src/styles/tokens.css`: all design tokens
