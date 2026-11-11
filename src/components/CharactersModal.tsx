import { useEffect, useRef, useState } from "react";
import { Modal } from "./ui";
import MlField from "./MlField";
import { addCharacter, deleteCharacter, saveCharacters, type NovelType } from "../lib/db/db";
import type { Character } from "../lib/screenplay";
import { IS_TOUCH } from "../env";

/** Delete needs a second tap (within 3 seconds) so a character and its notes are not lost by accident. */
export function DeleteButton({ label, armedLabel = "Press again to delete", title, className = "btn ghost small-btn", onDelete }: {
  label: string; armedLabel?: string; title?: string; className?: string; onDelete: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button className={armed ? `${className} danger` : className} title={title}
      onClick={() => {
        if (armed) { window.clearTimeout(timer.current); onDelete(); return; }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 3000);
      }}>
      {armed ? armedLabel : label}
    </button>
  );
}

/** The cast: type a name and press Enter to create the character; each one has notes and a delete button. */
export default function CharactersModal({
  novelId, type, characters, mode, online, onClose,
}: { novelId: string; type: NovelType; characters: Character[]; mode: "ml" | "en"; online: boolean; onClose: () => void }) {
  const [newName, setNewName] = useState("");
  const [field, setField] = useState(0);
  const script = type === "screenplay";

  const patch = (id: string, p: Partial<Character>) =>
    saveCharacters(novelId, characters.map((c) => (c.id === id ? { ...c, ...p } : c)));

  /**
   * Enter: `typed` is the text straight from the field, which has already emptied itself (it keeps focus, so the next
   * name can be typed straight away). Add button / Ctrl+Enter: use the last reported text and remount the field to clear it.
   */
  async function add(typed?: string) {
    const fromEnter = typed !== undefined;
    const name = (typed ?? newName).trim();
    if (!name) return;
    setNewName("");
    if (!fromEnter) setField((f) => f + 1);
    await addCharacter(novelId, name);
  }

  return (
    <Modal title="Characters" onClose={onClose}>
      <p className="muted small">
        {script
          ? "Everyone in your film. Add a short description of each person here. What they wear in a particular scene goes in that scene."
          : "Everyone in your story. Type a name and press Enter to add them, and jot down notes about who they are. To remove someone, use the “Delete character” button under their name."}
      </p>
      <div className="char-list">
        {characters.length === 0 && <p className="muted">No characters yet. Type a name below and press Enter.</p>}
        {characters.map((c) => (
          <div className="char-item" key={c.id}>
            <MlField mode={mode} online={online} className="editor-line" initial={c.name}
              placeholder="Name" onChange={(v) => patch(c.id, { name: v })} />
            <MlField multiline mode={mode} online={online} className="blk-text" initial={c.about ?? ""}
              placeholder="Notes: age, looks, personality…" onChange={(v) => patch(c.id, { about: v })} />
            <DeleteButton label={script ? "Remove from film" : "Delete character"} onDelete={() => deleteCharacter(novelId, c.id)} />
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <MlField key={field} mode={mode} online={online} className="editor-line" initial="" autoFocus={field > 0 || !IS_TOUCH}
          placeholder="Type a name, then press Enter" onChange={setNewName}
          onEnter={(v) => add(v)} clearOnEnter onCtrlEnter={() => add()} />
        <button className="btn primary" onClick={() => add()} disabled={!newName.trim()}>Add</button>
      </div>
    </Modal>
  );
}
