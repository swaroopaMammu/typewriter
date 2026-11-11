import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { createNovel, db, deleteNovel, novelType, NOVEL_TYPES, typeHint, typeLabel, unitName, updateNovel, type Novel, type NovelType } from "../lib/db/db";
import { downloadAllBackup, downloadNovelBackup, downloadNovelText, importBackup } from "../lib/export/exporters";
import { CATEGORIES, Confirm, Menu, Modal, ThemeToggle } from "../components/ui";

function NovelForm({ novel, categories, onClose }: { novel: Novel | null; categories: string[]; onClose: () => void }) {
  const nav = useNavigate();
  const [name, setName] = useState(novel?.name ?? "");
  const [category, setCategory] = useState(novel?.category ?? "");
  const [type, setType] = useState<NovelType>(novel ? novelType(novel) : "novel");
  const ok = name.trim() && category.trim();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    if (novel) {
      await updateNovel(novel.id, { name: name.trim(), category: category.trim() });
      onClose();
    } else {
      const id = await createNovel(name.trim(), category.trim(), type);
      nav(`/novel/${id}`);
    }
  }
  return (
    <Modal title={novel ? "Edit details" : "New project"} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {!novel && (
          <div className="type-pick" role="radiogroup" aria-label="Type">
            {NOVEL_TYPES.map((t) => (
              <button type="button" key={t} role="radio" aria-checked={type === t}
                className={type === t ? "type-opt active" : "type-opt"} onClick={() => setType(t)}>
                <strong>{typeLabel(t)}</strong>
                <span className="muted small">{typeHint(t)}</span>
              </button>
            ))}
          </div>
        )}
        <label>Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Title (Malayalam or English)" />
        </label>
        <label>Category
          <input list="cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Pick or type your own" />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!ok}>{novel ? "Save" : "Create & write"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function IndexPage() {
  const nav = useNavigate();
  const novels = useLiveQuery(() => db.novels.toArray(), []);
  const stats = useLiveQuery(async () => {
    const m: Record<string, { sections: number; words: number }> = {};
    await db.sections.each((s) => {
      const x = (m[s.novelId] ||= { sections: 0, words: 0 });
      x.sections++;
      x.words += s.wordCount;
    });
    return m;
  }, []);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [form, setForm] = useState<Novel | "new" | null>(null);
  const [del, setDel] = useState<Novel | null>(null);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => Array.from(new Set([...CATEGORIES, ...(novels ?? []).map((n) => n.category)])),
    [novels],
  );
  const usedCats = useMemo(() => Array.from(new Set((novels ?? []).map((n) => n.category))).sort(), [novels]);

  const list = useMemo(() => {
    const coll = new Intl.Collator("ml");
    return (novels ?? [])
      .filter((n) => (cat === "all" || n.category === cat) && (typeFilter === "all" || novelType(n) === typeFilter) && n.name.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => (sort === "name" ? coll.compare(a.name, b.name) : b.updatedAt - a.updatedAt));
  }, [novels, q, cat, typeFilter, sort]);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const n = await importBackup(f);
      setNotice(`Imported ${n} novel${n === 1 ? "" : "s"}.`);
    } catch (err) {
      setNotice((err as Error).message);
    }
    setTimeout(() => setNotice(""), 4000);
  }

  return (
    <div className="page">
      <header className="topbar glass">
        <div className="brand">TypeWriter <span className="ml hide-sm">ടൈപ്പ്റൈറ്റർ</span></div>
        <div className="spacer" />
        {notice && <span className="muted small">{notice}</span>}
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onImport} />
        <button className="btn" onClick={() => fileRef.current?.click()}>Import</button>
        <button className="btn hide-sm" onClick={() => downloadAllBackup()} disabled={!novels?.length}>Backup all</button>
        <ThemeToggle />
        <button className="btn primary" onClick={() => setForm("new")}>+ New</button>
      </header>

      <main className="container">
        <div className="toolbar">
          <input className="search" placeholder="Search novels…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            <option value="novel">Novels</option>
            <option value="poem">Poetry</option>
            <option value="screenplay">Screenplays</option>
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All categories</option>
            {usedCats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Recently edited</option>
            <option value="name">Name</option>
          </select>
        </div>

        {novels && novels.length === 0 && (
          <div className="empty glass">
            <h2>Nothing here yet</h2>
            <p className="muted">Create a novel, a poetry collection or a screenplay, then type in Manglish and watch it appear in Malayalam.</p>
            <button className="btn primary" onClick={() => setForm("new")}>+ New</button>
          </div>
        )}
        {novels && novels.length > 0 && list.length === 0 && <p className="muted">Nothing matches your search.</p>}

        <div className="grid">
          {list.map((n) => {
            const s = stats?.[n.id];
            return (
              <article key={n.id} className="card glass">
                <div className="card-main" onClick={() => nav(`/novel/${n.id}`)} role="button" tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && nav(`/novel/${n.id}`)}>
                  <div className="row">
                    <span className={novelType(n) === "novel" ? "chip" : "chip solid"}>{typeLabel(novelType(n))}</span>
                    <span className="chip">{n.category}</span>
                  </div>
                  <h3 className="ml">{n.name}</h3>
                  <p className="muted small">
                    {s?.sections ?? 0} {unitName(novelType(n)).toLowerCase()}{(s?.sections ?? 0) === 1 ? "" : "s"} · {s?.words ?? 0} words
                  </p>
                  <p className="muted small">Edited {new Date(n.updatedAt).toLocaleDateString()}</p>
                </div>
                <div className="card-actions">
                  <button className="btn" onClick={() => nav(`/novel/${n.id}`)}>Write</button>
                  <button className="btn" onClick={() => nav(`/novel/${n.id}/read`)}>Read</button>
                  <Menu label="Download" items={[
                    { label: "Novel as text (.txt)", onClick: () => downloadNovelText(n.id) },
                    { label: "Backup (.json)", onClick: () => downloadNovelBackup(n.id) },
                  ]} />
                  <button className="btn ghost" onClick={() => setForm(n)} title="Edit name / category">Edit</button>
                  <button className="btn ghost" onClick={() => setDel(n)} title="Delete">Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {form && <NovelForm novel={form === "new" ? null : form} categories={categories} onClose={() => setForm(null)} />}
      {del && (
        <Confirm title="Delete this project?" confirmLabel="Delete"
          message={`“${del.name}” and all its sections will be permanently deleted. Download a backup first if you might want it back.`}
          onConfirm={() => deleteNovel(del.id)} onClose={() => setDel(null)} />
      )}
    </div>
  );
}
