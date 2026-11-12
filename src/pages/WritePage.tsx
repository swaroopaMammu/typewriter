import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  addCharacter, addSection, countWords, db, deleteCharacter, deleteSection, getNovelSections, moveSection, novelType, renameSection, typeLabel, saveContent,
  sceneHeading, sectionLabel, SETTINGS, TIMES, unitName, updateScene,
} from "../lib/db/db";
import { downloadNovelBackup, downloadNovelText, downloadSectionText } from "../lib/export/exporters";
import MalayalamEditor from "../components/MalayalamEditor";
import MlField from "../components/MlField";
import ScriptEditor from "../components/ScriptEditor";
import CharactersModal, { DeleteButton } from "../components/CharactersModal";
import { Confirm, Menu, ThemeToggle } from "../components/ui";
import VoiceButton from "../components/VoiceButton";
import SoundToggle, { toggleSound, useSoundOn } from "../components/SoundToggle";
import Tipped from "../components/Tip";
import { IS_ARTIFACT, IS_NATIVE, IS_TOUCH } from "../env";
import { focusFirstField, stepFocus } from "../lib/nav";
import { wordsLabel } from "../lib/text";

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
  ["n~ N~ r~ l~ L~", "ൻ ൺ ർ ൽ ൾ  (ending letters)"],
  ["M  H", "ം ഃ"],
  ["_", "keep the plain ് ending (avan_ → അവന്)"],
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl+Alt+→ / ←", "Jump to the next / previous box (or button in a pop-up)"],
  ["Ctrl+Alt+↓ / ↑", "Go to the next / previous chapter, scene or poem"],
  ["Ctrl+Alt+N", "Add a new chapter, scene or poem"],
  ["Ctrl+Alt+C", "Open your characters (novels and screenplays)"],
  ["Ctrl+M", "Switch between Malayalam and English"],
  ["Ctrl+S", "Save right now"],
  ["Tab", "Pick the highlighted word"],
  ["1 – 9", "Pick a word by its number"],
  ["Enter", "Add the character name you typed"],
  ["Ctrl+Enter", "Start the next speaker's line (screenplays)"],
  ["Esc", "Close a pop-up"],
];

/** Two heads: the "characters" icon. */
function PeopleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" /><path d="M2.8 20c.4-3.4 3-5.2 6.2-5.2s5.8 1.8 6.2 5.2" />
      <circle cx="17.2" cy="9" r="2.6" /><path d="M17 14.4c2.5 0 4.2 1.4 4.6 4" />
    </svg>
  );
}

function GuidePanel({ onClose }: { onClose: () => void }) {
  const soundIsOn = useSoundOn();
  return (
    <aside className="guide glass" aria-label="Typing guide">
      <div className="side-head">
        <strong>Typing guide</strong>
        <button className="btn small-btn" onClick={onClose} aria-label="Close typing guide">✕ Close</button>
      </div>
      <p className="muted small">
        Type the way a word sounds, using English letters. For example, type “namaskaram” and it becomes നമസ്കാരം.
        Small and capital letters make different sounds (t and T, l and L). Words that end in n, N, r, l or L get their
        special ending on their own (avan → അവൻ, maram → മരം). Press <kbd>Ctrl</kbd>+<kbd>M</kbd> to switch between Malayalam and English.
      </p>
      <p className="muted small">
        As you type, a list of words appears under the cursor. Press <kbd>Space</kbd> to take the first one, or pick a
        different one by clicking it, pressing its number (<kbd>1</kbd>–<kbd>9</kbd>) or using <kbd>↑</kbd> / <kbd>↓</kbd>.
        <kbd>Esc</kbd> hides the list. The words you pick are remembered for next time. If “More suggestions” is on, extra
        words also come from Google (the word you type is sent to Google).
      </p>
      <p className="muted small">
        Screenplays: each scene has a short setup, the characters in it (and what they wear), then the action and dialogue in order.
        Click a character to give them a line, or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> inside a line to jump to the next speaker.
      </p>
      <label className="guide-check">
        <input type="checkbox" checked={soundIsOn} onChange={(e) => toggleSound(e.target.checked)} />
        Soft typing sound
      </label>
      <h3 className="guide-h">Keyboard shortcuts</h3>
      <table className="keys">
        <tbody>
          {SHORTCUTS.map(([k, v]) => (
            <tr key={k}><td><code>{k}</code></td><td>{v}</td></tr>
          ))}
        </tbody>
      </table>
      <h3 className="guide-h">Letter chart</h3>
      <table className="keys">
        <tbody>
          {KEYS.map(([k, v]) => (
            <tr key={k}><td><code>{k}</code></td><td className="ml">{v}</td></tr>
          ))}
        </tbody>
      </table>
    </aside>
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
  const [help, setHelp] = useState(() => {
    try { return localStorage.getItem("tw-guide") === "1"; } catch { return false; }
  });
  const toggleHelp = () => setHelp((h) => {
    try { localStorage.setItem("tw-guide", h ? "0" : "1"); } catch { /* ignore */ }
    return !h;
  });
  const [online, setOnline] = useState(() => {
    try { return localStorage.getItem("tw-online") === "1"; } catch { return false; }
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
  const keyActions = useRef<{ section: (d: 1 | -1) => void; add: () => void; characters: () => void }>({ section: () => {}, add: () => {}, characters: () => {} });

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
      // keyboard-only navigation: Ctrl+Alt + arrows / N
      if (e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); stepFocus(e.key === "ArrowRight" ? 1 : -1); }
        else if (!document.querySelector(".modal") && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); keyActions.current.section(e.key === "ArrowDown" ? 1 : -1); }
        else if (!document.querySelector(".modal") && (e.code === "KeyN" || e.key.toLowerCase() === "n")) { e.preventDefault(); keyActions.current.add(); }
        else if (!document.querySelector(".modal") && (e.code === "KeyC" || e.key.toLowerCase() === "c")) { e.preventDefault(); keyActions.current.characters(); }
      }
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

  /** Ctrl+Alt+↓/↑: go to the next / previous chapter (scene, poem) and put the cursor in it. */
  async function stepSection(dir: 1 | -1) {
    if (!sections?.length) return;
    const i = Math.max(0, sections.findIndex((s) => s.id === active?.id));
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    await select(sections[j].id);
    window.setTimeout(focusFirstField, 60);
  }
  async function addAndFocus() {
    await add();
    window.setTimeout(focusFirstField, 60);
  }
  keyActions.current = { section: stepSection, add: addAndFocus, characters: () => { if (novel && novelType(novel) !== "poem") setCast(true); } };

  async function commitRename() {
    if (renaming && renameVal.trim()) await renameSection(renaming, renameVal.trim());
    setRenaming(null);
  }

  if (novel === undefined || sections === undefined) return <div className="page" />;
  if (!novel) {
    return (
      <div className="page"><main className="container">
        <p>We couldn't find this story. It may have been deleted.</p><Link to="/" className="btn">Back to my writing</Link>
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
        <button className="btn ghost" onClick={async () => { await flush(); nav("/"); }}>← My writing</button>
        <div className="title">
          <strong className="ml">{novel.name}</strong>
          <span className="chip">{typeLabel(type)} · {novel.category}</span>
        </div>
        <div className="spacer" />
        <Tipped id="drawer" order={0} className="only-mobile" text={type === "poem" ? `Tap here to switch between your ${unit.toLowerCase()}s` : `Tap here to switch ${unit.toLowerCase()}s and manage your characters`}>
          <button className="btn only-mobile" onClick={() => setDrawer((d) => !d)}>☰ {unit}s</button>
        </Tipped>
        <Tipped id="mode" order={1} text={IS_TOUCH ? "Switch between typing in Malayalam and English" : "Switch between typing in Malayalam and English (Ctrl+M)"}>
          <button className="btn mode" onClick={() => setMode(mode === "ml" ? "en" : "ml")} title="Switch between Malayalam and English typing (Ctrl+M)">
            {mode === "ml" ? "മലയാളം" : "English"}
          </button>
        </Tipped>
        <VoiceButton mode={mode} />
        <SoundToggle />
        {!IS_ARTIFACT && (
          <button className="btn hide-sm" onClick={toggleOnline} title="Turn this on to get extra word suggestions from Google. While it is on, the words you type are sent to Google.">
            More suggestions: {online ? "On" : "Off"}
          </button>
        )}
        <span className="muted small status hide-sm">{saved ? "All changes saved" : "Saving…"} · {wordsLabel(liveWords)} in this {unit.toLowerCase()} · {total} in all</span>
        <Tipped id="guide" order={3} className="hide-sm" text="Not sure which letters to type? Open the typing guide for a quick chart">
          <button className="btn hide-sm" aria-pressed={help} onClick={toggleHelp}>{help ? "Hide guide" : "Typing guide"}</button>
        </Tipped>
        <Tipped id="read" order={4} text="See your writing laid out like a book. You can also save it as a PDF">
          <button className="btn" onClick={async () => { await flush(); nav(`/novel/${id}/read`); }}>Read</button>
        </Tipped>
        <Menu label="Download" items={[
          { label: "Everything as text (.txt)", onClick: async () => { await flush(); downloadNovelText(id); } },
          ...(active ? [{ label: `This ${unit.toLowerCase()} as text (.txt)`, onClick: async () => { await flush(); downloadSectionText(id, active.id); } }] : []),
          { label: "Save a backup copy (.json)", onClick: async () => { await flush(); downloadNovelBackup(id); } },
          ...(IS_ARTIFACT || IS_NATIVE ? [] : [{ label: "Print or save as PDF", onClick: async () => { await flush(); nav(`/novel/${id}/read?print=1`); } }]),
        ]} />
        <ThemeToggle />
      </header>

      <div className="workspace">
        {help && <GuidePanel onClose={toggleHelp} />}
        <aside className={drawer ? "sidebar glass open" : "sidebar glass"} title={IS_TOUCH ? undefined : "Shortcuts: Ctrl+Alt+↑ / ↓ to switch, Ctrl+Alt+N to add a new one"}>
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
                  <button title={`Delete this ${unit.toLowerCase()}`} disabled={sections.length === 1} onClick={() => setDelSec(s.id)}>✕</button>
                </div>
              </li>
            ))}
          </ol>

          {type !== "poem" && (
            <div className="side-chars">
              <div className="side-head">
                <strong className="side-title"><PeopleIcon /> Characters
                  {(novel.characters ?? []).length > 0 && <span className="count-badge">{(novel.characters ?? []).length}</span>}
                </strong>
                <button className="btn small-btn" onClick={() => setCast(true)} title="Add, edit or remove characters (Ctrl+Alt+C)">Manage</button>
              </div>
              {(novel.characters ?? []).length === 0 ? (
                <p className="muted small">No characters yet. Tap Manage to add some.</p>
              ) : (
                <ul className="side-char-list">
                  {(novel.characters ?? []).map((c) => (
                    <li key={c.id}>
                      <button className="side-char-name ml" onClick={() => setCast(true)} title="Edit this character">{c.name || "?"}</button>
                      <DeleteButton label="✕" armedLabel="Delete?" className="icon-btn" title="Delete this character (click twice to confirm)"
                        onDelete={() => deleteCharacter(id, c.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
                  <select value={active.setting || "INT."} onChange={(e) => patchScene({ setting: e.target.value })} aria-label="Inside or outside">
                    {SETTINGS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                  <MlField mode={mode} online={online && !IS_ARTIFACT} className="editor-line" initial={active.location || ""}
                    placeholder="Where does this happen? e.g. veedu"
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

      {cast && <CharactersModal novelId={id} type={type} characters={novel.characters ?? []} mode={mode} online={online && !IS_ARTIFACT} onClose={() => setCast(false)} />}
      {delSec && (
        <Confirm title={`Delete ${unit.toLowerCase()}?`} confirmLabel={`Delete ${unit.toLowerCase()}`}
          message={(() => {
            const i = sections.findIndex((s) => s.id === delSec);
            return `“${sectionLabel(type, sections[i], i)}” and everything you wrote in it will be deleted for good.`;
          })()}
          onConfirm={async () => { await flush(); if (delSec === active?.id) setActiveId(null); await deleteSection(id, delSec); }}
          onClose={() => setDelSec(null)} />
      )}
    </div>
  );
}
