import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  addCharacter, addSection, countWords, db, deleteSection, getNovelSections, moveSection, novelType, renameSection, saveContent,
  sceneHeading, sectionLabel, SETTINGS, TIMES, unitName, updateScene,
} from "../lib/db/db";
import { downloadNovelBackup, downloadNovelText, downloadSectionText } from "../lib/export/exporters";
import MalayalamEditor from "../components/MalayalamEditor";
import MlField from "../components/MlField";
import ComposerBar from "../components/ComposerBar";
import ScriptEditor from "../components/ScriptEditor";
import CharactersModal from "../components/CharactersModal";
import { Confirm, Menu, Modal, ThemeToggle } from "../components/ui";
import { IS_ARTIFACT, IS_NATIVE, IS_TOUCH } from "../env";

const KEYS: [string, string][] = [
  ["a aa i ee u oo", "അ ആ ഇ ഈ ഉ ഊ"],
  ["e E ai o O au", "എ ഏ ഐ ഒ ഓ ഔ"],
  ["k kh g gh ng", "ക ഖ ഗ ഘ ങ"],
  ["ch chh j jh nj", "ച ഛ ജ ഝ ഞ"],
  ["t / T  Th  d / D  Dh  N", "ട ഠ ഡ ഢ ണ"],
  ["th thh dh dhh n", "ത ഥ ദ ധ ന"],
  ["p ph b bh m", "പ ഫ ബ ഭ മ"],
  ["y r R l L zh v", "യ ര റ ല ള ഴ വ"],
  ["sh S s h", "ശ ഷ സ ഹ"],
  ["nt  nd  nk  nch", "ന്റ ണ്ട ങ്ക ഞ്ച"],
  ["tt  tth  rr  ksha", "ട്ട ത്ത റ്റ ക്ഷ"],
  ["n~ N~ r~ l~ L~", "ൻ ൺ ർ ൽ ൾ  (chillu)"],
  ["M  H", "ം ഃ"],
  ["_", "force a plain ് (avan_ → അവന്)"],
];

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Typing guide" onClose={onClose}>
      <p className="muted small">
        Type the sound in English letters. Capital letters are different sounds (T vs t, L vs l).
        A final n, N, r, l, L becomes a chillu automatically (avan → അവൻ, maram → മരം).
        Press <kbd>Ctrl</kbd>+<kbd>M</kbd> to switch between Malayalam and English.
      </p>
      <p className="muted small">
        A suggestion list appears under the word you are typing. <kbd>Space</kbd> accepts the first one,
        <kbd>↑</kbd>/<kbd>↓</kbd>, <kbd>1</kbd>–<kbd>9</kbd> or a click picks another, <kbd>Esc</kbd> closes it.
        Whatever you pick is remembered for next time. With Online On, suggestions also come from Google
        Input Tools (the word you type is sent to Google).
      </p>
      <p className="muted small">
        Screenplay: each scene has a setup, the characters in it (with costume notes), then action and dialogue in order.
        Tap a character button to add their line, or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> inside a line to start the next speaker's line.
      </p>
      <table className="keys">
        <tbody>
          {KEYS.map(([k, v]) => (
            <tr key={k}><td><code>{k}</code></td><td className="ml">{v}</td></tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

export default function WritePage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const novel = useLiveQuery(() => db.novels.get(id), [id]);
  const sections = useLiveQuery(() => getNovelSections(id), [id]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<"ml" | "en">("ml");
  const [saved, setSaved] = useState(true);
  const [liveWords, setLiveWords] = useState(0);
  const [help, setHelp] = useState(false);
  const [online, setOnline] = useState(() => {
    try { return localStorage.getItem("tw-online") !== "0"; } catch { return true; }
  });
  const toggleOnline = () => setOnline((o) => {
    try { localStorage.setItem("tw-online", o ? "0" : "1"); } catch { /* ignore */ }
    return !o;
  });
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [delSec, setDelSec] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [cast, setCast] = useState(false);
  const scriptFlush = useRef<(() => Promise<void>) | null>(null);
  const sceneTimer = useRef<number | undefined>(undefined);

  const pending = useRef<{ id: string; value: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    await scriptFlush.current?.();
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    await saveContent(p.id, p.value);
    setSaved(true);
  }, []);

  const active = sections?.find((s) => s.id === activeId) ?? sections?.[0];
  const activeKey = active?.id;

  useEffect(() => { if (active) setLiveWords(active.wordCount); /* eslint-disable-next-line */ }, [activeKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") { e.preventDefault(); setMode((m) => (m === "ml" ? "en" : "ml")); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); flush(); }
    };
    const onUnload = () => { flush(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
      flush();
    };
  }, [flush]);

  function onChange(value: string) {
    if (!active) return;
    pending.current = { id: active.id, value };
    setSaved(false);
    setLiveWords(countWords(value));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 500);
  }

  async function select(sid: string) {
    await flush();
    setActiveId(sid);
    setDrawer(false);
  }

  async function add() {
    await flush();
    setActiveId(await addSection(id));
  }

  async function commitRename() {
    if (renaming && renameVal.trim()) await renameSection(renaming, renameVal.trim());
    setRenaming(null);
  }

  if (novel === undefined || sections === undefined) return <div className="page" />;
  if (!novel) {
    return (
      <div className="page"><main className="container">
        <p>This novel doesn't exist.</p><Link to="/" className="btn">Back to novels</Link>
      </main></div>
    );
  }

  const type = novelType(novel);
  const isScript = type === "screenplay";
  const unit = unitName(type);
  const activeIndex = Math.max(0, sections.findIndex((s) => s.id === active?.id));
  const patchScene = (patch: Parameters<typeof updateScene>[1]) => { if (active) updateScene(active.id, patch); };
  const total = sections.reduce((a, s) => a + (s.id === active?.id ? liveWords : s.wordCount), 0);

  return (
    <div className={IS_TOUCH ? "page write touch" : "page write"}>
      <header className="topbar glass">
        <button className="btn ghost" onClick={async () => { await flush(); nav("/"); }}>← Novels</button>
        <div className="title">
          <strong className="ml">{novel.name}</strong>
          <span className="chip">{isScript ? "Screenplay" : "Novel"} · {novel.category}</span>
        </div>
        <div className="spacer" />
        <button className="btn only-mobile" onClick={() => setDrawer((d) => !d)}>☰ {unit}s</button>
        <button className="btn mode" onClick={() => setMode(mode === "ml" ? "en" : "ml")} title="Ctrl+M">
          {mode === "ml" ? "മലയാളം" : "English"}
        </button>
        {!IS_ARTIFACT && (
          <button className="btn hide-sm" onClick={toggleOnline} title="Use Google Input Tools for better suggestions (sends typed words to Google)">
            Online: {online ? "On" : "Off"}
          </button>
        )}
        <span className="muted small status hide-sm">{saved ? "Saved" : "Saving…"} · {liveWords} / {total} words</span>
        {isScript && <button className="btn" onClick={() => setCast(true)}>Characters</button>}
        <button className="btn hide-sm" onClick={() => setHelp(true)}>Typing guide</button>
        <button className="btn" onClick={async () => { await flush(); nav(`/novel/${id}/read`); }}>Read</button>
        <Menu label="Download" items={[
          { label: "Whole novel (.txt)", onClick: async () => { await flush(); downloadNovelText(id); } },
          ...(active ? [{ label: "This section (.txt)", onClick: async () => { await flush(); downloadSectionText(id, active.id); } }] : []),
          { label: "Backup (.json)", onClick: async () => { await flush(); downloadNovelBackup(id); } },
          ...(IS_ARTIFACT || IS_NATIVE ? [] : [{ label: "Print / save as PDF", onClick: async () => { await flush(); nav(`/novel/${id}/read?print=1`); } }]),
        ]} />
        <ThemeToggle />
      </header>

      <div className="workspace">
        <aside className={drawer ? "sidebar glass open" : "sidebar glass"}>
          <div className="side-head">
            <strong>{unit}s</strong>
            <button className="btn small-btn" onClick={add}>+ Add</button>
          </div>
          <ol className="sections">
            {sections.map((s, i) => (
              <li key={s.id} className={s.id === active?.id ? "sec active" : "sec"}>
                {renaming === s.id ? (
                  <input autoFocus className="rename" value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={commitRename} onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }} />
                ) : (
                  <button className="sec-title" onClick={() => select(s.id)} onDoubleClick={() => { if (!isScript) { setRenaming(s.id); setRenameVal(s.title); } }}>
                    <span className="ml sec-name">
                      {sectionLabel(type, s, i)}
                      {isScript && (s.location || "").trim() && <span className="muted small"> · {s.location}</span>}
                    </span>
                    <span className="muted small">{s.id === active?.id ? liveWords : s.wordCount}</span>
                  </button>
                )}
                <div className="sec-actions">
                  <button title="Move up" disabled={i === 0} onClick={() => moveSection(id, s.id, -1)}>↑</button>
                  <button title="Move down" disabled={i === sections.length - 1} onClick={() => moveSection(id, s.id, 1)}>↓</button>
                  {!isScript && <button title="Rename" onClick={() => { setRenaming(s.id); setRenameVal(s.title); }}>Rename</button>}
                  <button title="Delete" disabled={sections.length === 1} onClick={() => setDelSec(s.id)}>✕</button>
                </div>
              </li>
            ))}
          </ol>
        </aside>

        <section className="paper">
          {active && (
            <>
              <div className="section-name ml">
                {isScript ? `Scene ${activeIndex + 1}` : active.title}
                {isScript && <span className="muted"> — {sceneHeading(active)}</span>}
              </div>
              {isScript && (
                <div className="scene-head" key={`h-${active.id}`}>
                  <select value={active.setting || "INT."} onChange={(e) => patchScene({ setting: e.target.value })} aria-label="Interior or exterior">
                    {SETTINGS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                  <MlField mode={mode} online={online && !IS_ARTIFACT} className="editor-line" initial={active.location || ""}
                    placeholder="Location (Manglish → Malayalam)"
                    onChange={(v) => { window.clearTimeout(sceneTimer.current); sceneTimer.current = window.setTimeout(() => patchScene({ location: v }), 400); }} />
                  <select value={active.time || "DAY"} onChange={(e) => patchScene({ time: e.target.value })} aria-label="Time of day">
                    {TIMES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
              )}
              {isScript ? (
                <ScriptEditor key={active.id} section={active} characters={novel.characters ?? []} mode={mode} online={online && !IS_ARTIFACT}
                  onAddCharacter={(name) => addCharacter(id, name)}
                  onDirty={() => setSaved(false)} onSaved={() => setSaved(true)}
                  onContent={(t) => setLiveWords(countWords(t))} flushRef={scriptFlush} />
              ) : (
                <MlField key={active.id} multiline className="editor" initial={active.content} mode={mode} online={online && !IS_ARTIFACT}
                  onChange={onChange} autoFocus />
              )}
            </>
          )}
        </section>
      </div>

      {IS_TOUCH && <ComposerBar mode={mode} online={online && !IS_ARTIFACT} onToggleMode={() => setMode((m) => (m === "ml" ? "en" : "ml"))} />}
      {cast && <CharactersModal novelId={id} characters={novel.characters ?? []} mode={mode} online={online && !IS_ARTIFACT} onClose={() => setCast(false)} />}
      {help && <HelpModal onClose={() => setHelp(false)} />}
      {delSec && (
        <Confirm title={`Delete ${unit.toLowerCase()}?`} confirmLabel={`Delete ${unit.toLowerCase()}`}
          message={`${unit} ${sections.findIndex((s) => s.id === delSec) + 1} will be permanently deleted.`}
          onConfirm={async () => { await flush(); if (delSec === active?.id) setActiveId(null); await deleteSection(id, delSec); }}
          onClose={() => setDelSec(null)} />
      )}
    </div>
  );
}
