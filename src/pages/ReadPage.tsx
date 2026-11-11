import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getNovelSections, novelType, sceneHeading, sectionLabel, typeLabel } from "../lib/db/db";
import { downloadNovelText, safeName, stamp } from "../lib/export/exporters";
import { downloadBookPdf } from "../lib/export/pdf";
import { ThemeToggle } from "../components/ui";
import { IS_ARTIFACT, IS_NATIVE } from "../env";
import { charName, hasStructure, type Character } from "../lib/screenplay";
import { wordsLabel } from "../lib/text";
import type { Section } from "../lib/db/db";

const DIALOGUE = /^([^\d:：]{1,40}?)\s*[:：]\s*(.+)$/;

function Poem({ text }: { text: string }) {
  const stanzas = text.split(/\n\s*\n/).map((s) => s.replace(/^\n+|\s+$/g, "")).filter((s) => s.trim());
  if (!stanzas.length) return <p className="muted">Nothing written here yet.</p>;
  return <>{stanzas.map((s, i) => <p key={i} className="stanza">{s}</p>)}</>;
}

function Body({ text, script }: { text: string; script: boolean }) {
  const lines = text.split(/\n+/).filter((p) => p.trim());
  if (!lines.length) return <p className="muted">Nothing written here yet.</p>;
  return (
    <>
      {lines.map((line, i) => {
        const m = script ? line.match(DIALOGUE) : null;
        if (m) {
          return (
            <div key={i} className="dlg">
              <span className="who">{m[1].trim()}</span>
              <span className="colon">:</span>{" "}
              <span className="said">{m[2]}</span>
            </div>
          );
        }
        return <p key={i}>{line}</p>;
      })}
    </>
  );
}

function Scene({ s, chars }: { s: Section; chars: Character[] }) {
  return (
    <>
      {s.setup?.trim() && <p className="setup">{s.setup.trim()}</p>}
      {!!s.cast?.length && (
        <ul className="cast-list">
          {s.cast.map((c) => (
            <li key={c.id}>
              <span className="who">{charName(chars, c.id)}</span>
              {c.look?.trim() && <span className="look"> — {c.look.trim()}</span>}
            </li>
          ))}
        </ul>
      )}
      {(s.blocks ?? []).filter((b) => b.text.trim()).map((b) =>
        b.kind === "dialogue" ? (
          <div key={b.id} className="dlg">
            <span className="who">{charName(chars, b.who) || "?"}</span>
            <span className="colon">:</span>{" "}
            {b.paren?.trim() && <><span className="paren">({b.paren.trim()})</span>{" "}</>}
            <span className="said">{b.text.trim()}</span>
          </div>
        ) : (
          <p key={b.id}>{b.text.trim()}</p>
        ),
      )}
    </>
  );
}

export default function ReadPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const novel = useLiveQuery(() => db.novels.get(id), [id]);
  const sections = useLiveQuery(() => getNovelSections(id), [id]);
  const [size, setSize] = useState(() => { try { return Number(localStorage.getItem("tw-read-size")) || 20; } catch { return 20; } });
  const canPrint = !IS_ARTIFACT && !IS_NATIVE;
  const bookRef = useRef<HTMLElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const savePdf = async () => {
    if (!bookRef.current || !novel) return;
    setPdfBusy(true);
    try { await downloadBookPdf(bookRef.current, `${safeName(novel.name)}-${stamp()}.pdf`); } finally { setPdfBusy(false); }
  };

  useEffect(() => { try { localStorage.setItem("tw-read-size", String(size)); } catch { /* ignore */ } }, [size]);

  useEffect(() => {
    if (canPrint && params.get("print") === "1" && sections) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [params, sections, canPrint]);

  if (novel === undefined || sections === undefined) return <div className="page" />;
  if (!novel) return <div className="page"><main className="container"><Link to="/" className="btn">Back to my writing</Link></main></div>;

  const type = novelType(novel);
  const script = type === "screenplay";
  const poem = type === "poem";
  const words = sections.reduce((a, s) => a + s.wordCount, 0);

  return (
    <div className="page read">
      <header className="topbar glass no-print">
        <Link to={`/novel/${id}`} className="btn ghost">← Keep writing</Link>
        <div className="title"><strong className="ml">{novel.name}</strong><span className="chip hide-sm">{typeLabel(type)} · {novel.category}</span></div>
        <div className="spacer" />
        <button className="btn" title="Smaller text" onClick={() => setSize((s) => Math.max(14, s - 2))}>A−</button>
        <button className="btn" title="Larger text" onClick={() => setSize((s) => Math.min(36, s + 2))}>A+</button>
        <button className="btn hide-sm" onClick={() => downloadNovelText(id)}>Save as text</button>
        <button className="btn" disabled={pdfBusy} onClick={savePdf}>{pdfBusy ? "Preparing your PDF…" : "Save as PDF"}</button>
        {canPrint && <button className="btn hide-sm" onClick={() => window.print()}>Print</button>}
        <ThemeToggle />
      </header>

      <div className="workspace">
        <aside className="sidebar glass no-print">
          <div className="side-head"><strong>Contents</strong></div>
          <ol className="toc">
            {sections.map((s, i) => (
              <li key={s.id}>
                <button className="sec-title" onClick={() => document.getElementById(`s-${s.id}`)?.scrollIntoView({ behavior: "smooth" })}>
                  <span className="ml">
                    {sectionLabel(type, s, i)}
                    {script && (s.location || "").trim() && <span className="muted small"> · {s.location}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <article ref={bookRef} className={script ? "book ml script" : poem ? "book ml poem" : "book ml"} style={{ fontSize: size }}>
          <h1 className="book-title">{novel.name}</h1>
          <p className="muted book-meta">
            {typeLabel(type)} · {novel.category} · {sections.length} {script ? (sections.length === 1 ? "scene" : "scenes") : poem ? (sections.length === 1 ? "poem" : "poems") : (sections.length === 1 ? "chapter" : "chapters")} · {wordsLabel(words)}
          </p>
          {sections.map((s, i) => (
            <section key={s.id} id={`s-${s.id}`} className="chapter">
              <h2>{sectionLabel(type, s, i)}</h2>
              {script && <p className="scene-line">{sceneHeading(s)}</p>}
              {script && hasStructure(s) ? <Scene s={s} chars={novel.characters ?? []} /> : poem ? <Poem text={s.content} /> : <Body text={s.content} script={script} />}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
