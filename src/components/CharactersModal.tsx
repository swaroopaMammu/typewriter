import { useState } from "react";
import { Modal } from "./ui";
import MlField from "./MlField";
import { addCharacter, deleteCharacter, saveCharacters } from "../lib/db/db";
import type { Character } from "../lib/screenplay";
import { IS_TOUCH } from "../env";

/** Manage the whole screenplay's cast: names and a general description (age, build, manner). */
export default function CharactersModal({
  novelId, characters, mode, online, onClose,
}: { novelId: string; characters: Character[]; mode: "ml" | "en"; online: boolean; onClose: () => void }) {
  const [newName, setNewName] = useState("");
  const [field, setField] = useState(0);
  const native = IS_TOUCH; // the phone typing bar sits behind the dialog, so use the system keyboard here

  const patch = (id: string, p: Partial<Character>) =>
    saveCharacters(novelId, characters.map((c) => (c.id === id ? { ...c, ...p } : c)));

  async function add() {
    const name = newName.trim();
    if (!name) return;
    await addCharacter(novelId, name);
    setNewName("");
    setField((f) => f + 1); // remount the name field to clear it
  }

  return (
    <Modal title="Characters" onClose={onClose}>
      <p className="muted small">Everyone in the film. Add a general description here; costume for a particular scene goes in that scene.</p>
      <div className="char-list">
        {characters.length === 0 && <p className="muted">No characters yet.</p>}
        {characters.map((c) => (
          <div className="char-item" key={c.id}>
            <MlField native={native} mode={mode} online={online} className="editor-line" initial={c.name}
              placeholder="Name" onChange={(v) => patch(c.id, { name: v })} />
            <MlField native={native} multiline mode={mode} online={online} className="blk-text" initial={c.about ?? ""}
              placeholder="About: age, appearance, manner…" onChange={(v) => patch(c.id, { about: v })} />
            <button className="btn ghost small-btn" onClick={() => deleteCharacter(novelId, c.id)}>Remove from film</button>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <MlField key={field} native={native} mode={mode} online={online} className="editor-line" initial=""
          placeholder="New character name" onChange={setNewName} onCtrlEnter={add} />
        <button className="btn primary" onClick={add} disabled={!newName.trim()}>Add</button>
      </div>
    </Modal>
  );
}
