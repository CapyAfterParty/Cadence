import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Archive, ArchiveRestore, BookOpen, Database, Download, Eye, EyeOff, Image as ImageIcon, Info, KeyRound, Lock, ShieldCheck, SlidersHorizontal, Trash2, Upload, UserRound } from 'lucide-react';
import { db, useData, type AllData } from '../db/db';
import { addScans, deleteSubject } from '../db/ops';
import { exportBackup, importBackup } from '../lib/backup';
import { settings, toast } from '../lib/state';
import { checkPassword, getVerifier, lockNow, passwordStrength, security, setPassword, siteKey } from '../lib/security';
import { Button, Card, IconTile, PageSkeleton, Segmented, cx, type Tone } from '../components/ui';
import { AutoInput } from '../components/auto';
import { Topbar } from '../components/Topbar';
import { AddSubject, SubjectEditor } from '../components/SubjectEditor';
import { useScans } from '../components/Scans';
import { Emblem } from '../components/gl/Emblem';
import { Wordmark } from '../components/Logo';

const SW = 1.7;

const SECTIONS: { id: string; label: string; tone: Tone; icon: ReactNode }[] = [
  { id: 'profile', label: 'Profile', tone: 'ember', icon: <UserRound size={15} strokeWidth={SW} /> },
  { id: 'security', label: 'Security', tone: 'meadow', icon: <ShieldCheck size={15} strokeWidth={SW} /> },
  { id: 'study', label: 'Study rhythm', tone: 'orchid', icon: <SlidersHorizontal size={15} strokeWidth={SW} /> },
  { id: 'appearance', label: 'Appearance', tone: 'coral', icon: <ImageIcon size={15} strokeWidth={SW} /> },
  { id: 'subjects', label: 'Subjects', tone: 'lagoon', icon: <BookOpen size={15} strokeWidth={SW} /> },
  { id: 'data', label: 'Data & backup', tone: 'gold', icon: <Database size={15} strokeWidth={SW} /> },
  { id: 'about', label: 'About', tone: 'orchid', icon: <Info size={15} strokeWidth={SW} /> },
];

function Row({ title, desc, children }: { title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <div className="s-row">
      <div className="s-label">
        <strong>{title}</strong>
        {desc && <span>{desc}</span>}
      </div>
      <div className="s-control">{children}</div>
    </div>
  );
}

function Section({ id, title, desc, children, index, tint }: { id: string; title: string; desc?: string; children: ReactNode; index: number; tint?: Tone }) {
  const s = SECTIONS.find((x) => x.id === id)!;
  return (
    <Card className="s-section" index={index} tint={tint ?? s.tone} id={`s-${id}`}>
      <div className="row" style={{ gap: '0.85rem' }}>
        <IconTile tone={s.tone}>{s.icon}</IconTile>
        <div>
          <h3>{title}</h3>
          {desc && <p className="muted small">{desc}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  const data = useData();
  const [active, setActive] = useState('profile');
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id.replace('s-', ''));
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    document.querySelectorAll('.s-section').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [data == null]);
  if (!data) return <PageSkeleton />;
  return (
    <div className="page">
      <Topbar eyebrow="Preferences" title={<>Settings</>} />
      <div className="settings-layout">
        <nav className="s-nav" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#/settings`}
              className={cx(active === s.id && 'on')}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`s-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <IconTile tone={s.tone}>{s.icon}</IconTile>
              {s.label}
            </a>
          ))}
        </nav>
        <div className="s-main">
          <Profile data={data} />
          <SecuritySection />
          <StudySection />
          <AppearanceSection />
          <SubjectsSection data={data} />
          <DataSection data={data} />
          <AboutSection />
        </div>
      </div>
    </div>
  );
}

function Profile({ data }: { data: AllData }) {
  const st = settings.use();
  const initials = st.name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const since = data.subjects.length ? new Date(Math.min(...data.subjects.map((s) => s.createdAt))) : null;
  return (
    <Card className="s-section s-hero" index={0} tint="ember" id="s-profile">
      <span className="s-avatar">{initials || '·'}</span>
      <div className="stack" style={{ gap: '0.6rem', flex: 1, minWidth: 0 }}>
        <span className="eyebrow">{since ? `Studying with Cadence since ${since.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : 'Welcome'}</span>
        <AutoInput className="title-input" value={st.name} onSave={(name) => settings.set((s) => ({ ...s, name: name.trim() }))} placeholder="Your name" aria-label="Your name" />
        <span className="muted small">
          {data.subjects.filter((s) => !s.archived).length} subjects · {data.papers.length} papers · {data.mistakes.length} mistakes logged
        </span>
      </div>
    </Card>
  );
}

function SecuritySection() {
  const sec = security.use();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const strength = passwordStrength(pw);
  const change = async () => {
    setErr('');
    const v = await getVerifier();
    if (!v || !(await checkPassword(cur, v))) return setErr('Your current password is not right.');
    if (pw.length < 6) return setErr('Use at least 6 characters.');
    if (pw !== pw2) return setErr('The new passwords do not match.');
    await setPassword(pw);
    setCur('');
    setPw('');
    setPw2('');
    toast('Password changed');
  };
  return (
    <Section id="security" title="Security" desc="Cadence is locked with your password. It is hashed on this device and never stored or sent anywhere." index={1}>
      <div className="s-rows">
        <Row title="Lock automatically" desc="After this long without activity. Never during a timed paper.">
          <Segmented
            label="Auto-lock"
            value={String(sec.autoLockMin)}
            onChange={(v) => security.set({ autoLockMin: Number(v) })}
            options={[
              { value: '5', label: '5 min' },
              { value: '15', label: '15 min' },
              { value: '60', label: '1 hour' },
              { value: '0', label: 'Never' },
            ]}
          />
        </Row>
        <Row title="Lock now" desc={<>Or press <kbd className="k">⇧</kbd> <kbd className="k">⌘</kbd> <kbd className="k">L</kbd> anywhere.</>}>
          <Button onClick={lockNow}>
            <Lock size={15} strokeWidth={SW} /> Lock Cadence
          </Button>
        </Row>
        <Row title="Change password" desc="You will need your current one.">
          <form
            className="stack"
            style={{ width: '100%', gap: '0.5rem' }}
            onSubmit={(e) => {
              e.preventDefault();
              change();
            }}
          >
            <input className="input sm" type={show ? 'text' : 'password'} placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" aria-label="Current password" />
            <input className="input sm" type={show ? 'text' : 'password'} placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" aria-label="New password" />
            {pw && (
              <div className="strength" data-score={strength.score}>
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={i <= strength.score ? 'on' : ''} />
                ))}
                <em>{strength.label}</em>
              </div>
            )}
            <input className="input sm" type={show ? 'text' : 'password'} placeholder="New password again" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" aria-label="Confirm new password" />
            {err && <span className="tiny" style={{ color: '#ff8a95' }}>{err}</span>}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="link" onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff size={13} strokeWidth={SW} /> : <Eye size={13} strokeWidth={SW} />} {show ? 'Hide' : 'Show'}
              </button>
              <Button type="submit" size="sm" variant="primary" disabled={!cur || !pw || !pw2}>
                <KeyRound size={14} strokeWidth={SW} /> Change password
              </Button>
            </div>
          </form>
        </Row>
        <Row title="Site password" desc="Stops strangers on a fresh browser from even starting setup. Set it when you deploy (see README).">
          <span className={cx('pill', siteKey() ? 'green' : '')}>{siteKey() ? 'On for this build' : 'Not set'}</span>
        </Row>
      </div>
    </Section>
  );
}

function StudySection() {
  const st = settings.use();
  return (
    <Section id="study" title="Study rhythm" desc="How the loop paces itself." index={2}>
      <div className="s-rows">
        <Row title="Redo mistakes after" desc="A mistake not redone for this long rises to the top of the queue.">
          <Segmented
            label="Redo interval"
            value={String(st.redoDays)}
            onChange={(v) => settings.set((s) => ({ ...s, redoDays: Number(v) }))}
            options={[
              { value: '3', label: '3 days' },
              { value: '7', label: '1 week' },
              { value: '14', label: '2 weeks' },
            ]}
          />
        </Row>
        <Row title="Timed sprint length" desc="The default for a past paper under exam conditions.">
          <Segmented
            label="Sprint length"
            value={String(st.sprintMinutes)}
            onChange={(v) => settings.set((s) => ({ ...s, sprintMinutes: Number(v) }))}
            options={[
              { value: '60', label: '1h' },
              { value: '90', label: '1h 30' },
              { value: '120', label: '2h' },
              { value: '150', label: '2h 30' },
            ]}
          />
        </Row>
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const photos = useScans('hero', 'hero');
  const input = useRef<HTMLInputElement>(null);
  return (
    <Section id="appearance" title="Appearance" desc="Home is lit by a living aurora. You can lay your own photo over it." index={3}>
      <div className="s-rows">
        <Row title="Home background" desc={photos?.length ? 'Your photo, melted into the aurora.' : 'The Cadence aurora.'}>
          <Button size="sm" onClick={() => input.current?.click()}>
            <Upload size={14} strokeWidth={SW} /> {photos?.length ? 'Replace photo' : 'Use my photo'}
          </Button>
          {!!photos?.length && (
            <Button size="sm" variant="ghost" onClick={() => db.scans.bulkDelete(photos.map((p) => p.id))}>
              Back to aurora
            </Button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (photos?.length) await db.scans.bulkDelete(photos.map((p) => p.id));
              await addScans('hero', 'hero', [f]);
            }}
          />
        </Row>
      </div>
    </Section>
  );
}

function SubjectsSection({ data }: { data: AllData }) {
  const active = data.subjects.filter((s) => !s.archived);
  const archived = data.subjects.filter((s) => s.archived);
  return (
    <Section id="subjects" title="Subjects" desc="Everything saves as you type." index={4}>
      <div className="stack" style={{ marginTop: '1.25rem' }}>
        <AddSubject count={data.subjects.length} />
        <div>
          {active.map((s) => (
            <div key={s.id} className="subject-block">
              <SubjectEditor subject={s} />
              <div className="row" style={{ marginTop: '0.85rem', justifyContent: 'flex-end' }}>
                <Button size="sm" variant="ghost" onClick={() => db.subjects.update(s.id, { archived: true })}>
                  <Archive size={14} strokeWidth={SW} /> Archive
                </Button>
              </div>
            </div>
          ))}
        </div>
        {archived.length > 0 && (
          <div>
            <span className="eyebrow">Archived</span>
            {archived.map((s) => (
              <div key={s.id} className="list-item">
                <span className="subject-dot" style={{ background: s.colour, color: s.colour }} />
                <span className="grow">{s.name}</span>
                <Button size="sm" onClick={() => db.subjects.update(s.id, { archived: false })}>
                  <ArchiveRestore size={14} strokeWidth={SW} /> Restore
                </Button>
                <Button size="sm" variant="ghost" className="danger" onClick={() => deleteSubject(s.id)}>
                  <Trash2 size={14} strokeWidth={SW} /> Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function DataSection({ data }: { data: AllData }) {
  const st = settings.use();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);
  const days = st.lastBackupAt ? Math.floor((Date.now() - st.lastBackupAt) / 86_400_000) : null;
  return (
    <Section id="data" title="Data & backup" desc="Everything lives in this browser. A backup is one JSON file, scans included." index={5}>
      <div className="s-rows">
        <Row
          title="Back up now"
          desc={st.lastBackupAt ? `Last backup ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}.` : 'No backup yet.'}
        >
          <Button variant={days == null || days >= 7 ? 'primary' : undefined} onClick={exportBackup}>
            <Download size={15} strokeWidth={SW} /> Export JSON
          </Button>
        </Row>
        <Row title="Restore from a backup" desc="Replaces everything here with the file's contents. Your password stays the same.">
          <Button onClick={() => input.current?.click()}>
            <Upload size={15} strokeWidth={SW} /> Import JSON
          </Button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (!confirm('Importing replaces everything in Cadence with this backup. Continue?')) return;
              try {
                await importBackup(f);
                toast('Backup restored');
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Import failed');
              }
            }}
          />
        </Row>
        <Row title="Persistent storage" desc="Asks the browser never to clear this data to save space.">
          {persisted ? (
            <span className="pill green">Granted</span>
          ) : (
            <Button size="sm" onClick={async () => setPersisted((await navigator.storage?.persist?.()) ?? false)}>
              Ask the browser
            </Button>
          )}
        </Row>
        <Row title="What is stored" desc="Counts across every table.">
          <span className="small muted num">
            {data.notes.length} notes · {data.sessions.length} sessions · {data.flashLogs.length} flashcard days · {data.checkins.length} check-ins
          </span>
        </Row>
      </div>
    </Section>
  );
}

function AboutSection() {
  return (
    <Section id="about" title="About" index={6}>
      <div className="s-about">
        <Emblem size="11rem" />
        <div className="stack" style={{ gap: '0.6rem' }}>
          <Wordmark size="var(--fs-44)" />
          <p className="muted" style={{ maxWidth: '30rem' }}>
            A study system that runs in rhythm: flashcards every day, one timed paper every weekend, every mistake redone until it is fixed, and a Sunday check-in to close the loop.
          </p>
          <span className="eyebrow">Version 1.0 · Local-first · No accounts, no tracking</span>
        </div>
      </div>
    </Section>
  );
}
