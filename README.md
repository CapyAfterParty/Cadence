# Summit OS

Pratham's study system. Built for one person, on the Ontario curriculum: courses with codes like SPH4U, unit tests and exams, marks in percent.

It runs one weekly loop (flashcards daily, a timed practice exam each weekend, every mistake redone until it is fixed, a Sunday review) and opens on **Today**: an ordered plan of what to do now.

Everything is stored in the browser (IndexedDB) and locked with a password. No accounts, no backend, no cost.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). To build a static site: `npm run build`; the `dist/` folder works on any static host.

## Password lock

The first time Summit OS opens, it asks for one thing: a password. From then on, every visit starts at the lock screen.

- The password is never stored. Summit OS keeps a PBKDF2-SHA256 verifier (310,000 iterations, random salt) in IndexedDB, next to your data, so clearing localStorage cannot skip the lock.
- It locks itself after a chosen idle time (Settings › Security; default 15 minutes), never in the middle of a timed paper. Lock by hand with ⇧⌘L / Ctrl+Shift+L or the lock in the sidebar.
- After 5 wrong tries it makes you wait 30 seconds, doubling each time.
- There is no recovery. "Forgot your password?" can only erase everything on this device and start fresh, so keep a JSON backup.

### Site password (for a deployed copy)

Data lives per browser, so a stranger visiting your deployed site never sees *your* data. But without a site password they could run setup in their own browser. To stop that, bake in a site password:

```bash
node scripts/hash-password.mjs "a long passphrase"
```

Put the printed `VITE_SITE_KEY=...` line in `.env.local` (or your host's environment variables) and rebuild. A fresh browser must then enter that password before it can even start setup, and it becomes that browser's password.

What this does and does not protect: it is a lock on the app, not encryption. Someone with your unlocked computer and the browser's developer tools could still read IndexedDB directly. Phase 2's backend with real accounts is where server-side protection comes in.

## Shortcuts

- `Ctrl K` / `Cmd K`: search everything, jump anywhere, run actions ("start timer", "log paper", "lock", ...)
- `Ctrl Shift L` / `Cmd Shift L`: lock now
- `N`: add a mistake from any screen (subject defaults to the last one used)
- Redo session: `Space` reveals the fix, `→` right, `←` wrong

## Screens

- **Home**: today chips (what to do now), study time, flashcards, mistakes due, loop score, paper scores, target gauge, study heatmap, this week's goals
- **Subjects**: one hub per subject with notes (markdown), papers, mistakes, scans, weak topics, target and test countdown
- **Mistakes**: filters, inline autosaving editor, redo queue, Anki CSV export, bulk entry ("4, 5, 7a, 14b")
- **Papers**: weekly timed-paper target, all subjects compared, trend per subject, scans per paper
- **Timer**: study sessions (survive refresh, shown in the tab title), timed sprints in full-screen exam mode, flashcard log
- **Check-in**: this week's stats pre-filled, reflection form that saves as you type, past check-ins
- **Settings**: name, redo interval, the photo in Today's glass card, subjects, JSON backup and restore

## Data safety

The app asks the browser for persistent storage. Export a JSON backup from Settings or the Sunday check-in; importing it restores everything, scans included.

## Design

Dark, glassy and vivid, after the reference dashboard.

- **Mark:** an ensō, the single brushstroke circle. The favicon is the white ensō on a pink-violet-blue glass tile (`public/summit-icon.svg`, with PNG copies for Safari).
- **Materials (`src/styles/glass.css`, `src/components/glass.tsx`):** gel cards (pink, blue, violet, or any course colour) lit at the top and bottom edges with a dark centre; smoky grey glass; dark glass panels with a coloured glow. A soft light follows the cursor.
- **Numbers:** dot-matrix numerals (Doto, round dots) for headline figures, thin Outfit for the rest.
- **Today:** four tall cards (study dot matrix, plan under reeded glass over your photo, mistakes in orbit, upcoming tests in rings), a strip of quick controls, and the week's timeline.
- **Other screens:** a row of glass cards on top, then wide working panels: filter rail and table on Mistakes, a big dot-matrix clock on Focus, course-coloured gels on Courses and Redo.
- **Motion:** cards rise and un-blur on entry, dots fill in, orbits turn slowly. No bounce. Reduced-motion settings are respected.
- **Scale:** sizes are in rem with a fluid root, so a 16" laptop and a 27" display get the same composition.

## Code map

- `src/db`: Dexie schema, types, and delete-with-undo operations
- `src/lib`: dates, derived stats (streaks, loop score, weak topics), backup, small stores
- `src/components`: the design system (Card, Stat, Chip, Button, inputs, Sidebar, charts)
- `src/features`: search/palette, mistake and paper forms, timer controller
- `src/pages`: one file per screen
- `src/features/Gate.tsx`: lock screen and onboarding; `src/lib/security.ts`: the password logic
- `src/styles/tokens.css`: all design tokens

## Navigation

- **Today**: the plan for now, this week's numbers, and upcoming tests. The sidebar badge counts what is left.
- **Progress**: the charts.
- **Study**: Courses, Mistakes (badge: how many are due for a redo), Tests.
- **Routine**: Focus (study timer and timed practice), Review (the Sunday check-in).
- **Settings**: security, rhythm, backup.

Your name and curriculum live in `src/owner.ts`.
