import { useEffect, useRef, useState } from "react";
import MlField from "./MlField";
import { charName, sceneBody, type Block, type CastEntry, type Character } from "../lib/screenplay";
import { saveScene, type Section } from "../lib/db/db";
import { IS_TOUCH } from "../env";

interface Props {
  section: Section;
  characters: Character[];
  mode: "ml" | "en";
  online: boolean;
  onAddCharacter: (name: string) => Promise<string>;
  onDirty: () => void;
  onSaved: () => void;
  onContent: (text: string) => void;
  flushRef: React.MutableRefObject<(() => Promise<void>) | null>;
}

interface State { setup: string; cast: CastEntry[]; blocks: Block[] }
const uid = () => crypto.randomUUID();

function initialState(s: Section): State {
  // older plain-text scenes become action blocks, one per paragraph
  const legacy: Block[] = s.blocks
    ? s.blocks
    : s.content.trim()
      ? s.content.split(/\n+/).filter((l) => l.trim()).map((l) => ({ id: uid(), kind: "action" as const, text: l }))
      : [];
  return { setup: s.setup ?? "", cast: s.cast ?? [], blocks: legacy };
}

/**
 * One scene, the way a screenplay is written: setup, who is in it (and what they wear), then action and
 * dialogue in order. Tap a character to add their next line; Ctrl+Enter jumps to the next speaker.
 */
export default function ScriptEditor({ section, characters, mode, online, onAddCharacter, onDirty, onSaved, onContent, flushRef }: Props) {
  const [st, setSt] = useState<State>(() => initialState(section));
  const latest = useRef(st);
  const chars = useRef(characters);
  chars.current = characters;
  const timer = useRef<number | undefined>(undefined);
  const dirty = useRef(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  async function flush() {
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    await saveScene(section.id, latest.current);
    onSaved();
  }
  flushRef.current = flush;
  useEffect(() => () => { flush(); /* eslint-disable-next-line */ }, []);

  function update(patch: Partial<State>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setSt(next);
    dirty.current = true;
    onDirty();
    onContent(sceneBody(next, chars.current));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 500);
  }

  const castChars = st.cast.map((c) => ({ ...c, name: charName(characters, c.id) }));

  function addBlock(kind: Block["kind"], who?: string, after?: number) {
    const b: Block = { id: uid(), kind, text: "", ...(kind === "dialogue" ? { who } : {}) };
    const blocks = [...latest.current.blocks];
    blocks.splice(after === undefined ? blocks.length : after + 1, 0, b);
    update({ blocks });
    setFocusId(b.id);
  }
  function patchBlock(id: string, patch: Partial<Block>) {
    update({ blocks: latest.current.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  }
  function moveBlock(i: number, dir: -1 | 1) {
    const blocks = [...latest.current.blocks];
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    update({ blocks });
  }
  function removeBlock(id: string) {
    update({ blocks: latest.current.blocks.filter((b) => b.id !== id) });
  }
  /** Ctrl+Enter inside a block: start the next line, alternating speakers. */
  function nextLine(i: number) {
    const ids = latest.current.cast.map((c) => c.id);
    const cur = latest.current.blocks[i];
    if (!ids.length) { addBlock("action", undefined, i); return; }
    const idx = cur.kind === "dialogue" ? ids.indexOf(cur.who ?? "") : -1;
    addBlock("dialogue", ids[(idx + 1) % ids.length], i);
  }

  function addToCast(id: string) {
    if (latest.current.cast.some((c) => c.id === id)) return;
    update({ cast: [...latest.current.cast, { id }] });
  }
  async function createCharacter() {
    const name = newName.trim();
    if (!name) return;
    const id = await onAddCharacter(name);
    addToCast(id);
    setNewName("");
    setAdding(false);
  }

  const inCast = new Set(st.cast.map((c) => c.id));
  const available = characters.filter((c) => !inCast.has(c.id));

  return (
    <div className="script-ed">
      <section className="card-lite">
        <label className="field-label">Scene setup</label>
        <MlField multiline mode={mode} online={online} className="blk-text" initial={st.setup}
          placeholder="Where are we, what's around, the mood, props, lighting…"
          onChange={(v) => update({ setup: v })} />
      </section>

      <section className="card-lite">
        <label className="field-label">Characters in this scene</label>
        {castChars.length === 0 && <p className="muted small">Add the characters who appear, then write what each one wears or looks like.</p>}
        {castChars.map((c) => (
          <div className="cast-row" key={c.id}>
            <span className="who-chip ml">{c.name || "?"}</span>
            <MlField mode={mode} online={online} className="editor-line" initial={c.look ?? ""}
              placeholder="Costume / look in this scene"
              onChange={(v) => update({ cast: latest.current.cast.map((x) => (x.id === c.id ? { ...x, look: v } : x)) })} />
            <button className="icon-btn" title="Remove from scene" onClick={() => update({ cast: latest.current.cast.filter((x) => x.id !== c.id) })}>✕</button>
          </div>
        ))}
        <div className="cast-add">
          {available.map((c) => (
            <button key={c.id} className="btn small-btn" onClick={() => addToCast(c.id)}>+ {c.name}</button>
          ))}
          {!adding && <button className="btn small-btn" onClick={() => setAdding(true)}>+ New character</button>}
        </div>
        {adding && (
          <div className="cast-row">
            <MlField mode={mode} online={online} className="editor-line" initial="" autoFocus
              placeholder="Character name" onChange={setNewName} onCtrlEnter={createCharacter} />
            <button className="btn primary small-btn" onClick={createCharacter}>Add</button>
            <button className="btn small-btn" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</button>
          </div>
        )}
      </section>

      <section className="blocks">
        {st.blocks.length === 0 && (
          <p className="muted small">Add action or dialogue below. {IS_TOUCH ? "" : "Tip: Ctrl+Enter starts the next line with the next speaker."}</p>
        )}
        {st.blocks.map((b, i) => (
          <div className={b.kind === "dialogue" ? "block dialogue" : "block action"} key={b.id}>
            <div className="block-head">
              {b.kind === "dialogue" ? (
                <>
                  <select className="who-select ml" value={b.who ?? ""} onChange={(e) => patchBlock(b.id, { who: e.target.value || undefined })} aria-label="Speaker">
                    <option value="">Who speaks?</option>
                    {Array.from(new Set([...st.cast.map((c) => c.id), ...(b.who ? [b.who] : [])])).map((id) => (
                      <option key={id} value={id}>{charName(characters, id) || "?"}</option>
                    ))}
                  </select>
                  <MlField mode={mode} online={online} className="editor-line paren" initial={b.paren ?? ""}
                    placeholder="(how they say it)" onChange={(v) => patchBlock(b.id, { paren: v })} />
                </>
              ) : (
                <span className="field-label">Action</span>
              )}
              <span className="spacer" />
              <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => moveBlock(i, -1)}>↑</button>
              <button className="icon-btn" title="Move down" disabled={i === st.blocks.length - 1} onClick={() => moveBlock(i, 1)}>↓</button>
              <button className="icon-btn" title="Delete" onClick={() => removeBlock(b.id)}>✕</button>
            </div>
            <MlField multiline mode={mode} online={online} className="blk-text" initial={b.text} autoFocus={focusId === b.id}
              placeholder={b.kind === "dialogue" ? "What they say" : "What happens"}
              onChange={(v) => patchBlock(b.id, { text: v })} onCtrlEnter={() => nextLine(i)} />
          </div>
        ))}
      </section>

      <div className="addbar">
        <button className="btn small-btn" onClick={() => addBlock("action")}>+ Action</button>
        {castChars.map((c) => (
          <button key={c.id} className="btn small-btn ml" onClick={() => addBlock("dialogue", c.id)}>+ {c.name}</button>
        ))}
        {castChars.length === 0 && <span className="muted small">Add characters above to write their dialogue.</span>}
      </div>
    </div>
  );
}
