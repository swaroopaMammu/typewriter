import { useEffect, useRef } from "react";
import MalayalamEditor from "./MalayalamEditor";
import { setTarget, type FieldEl } from "./target";
import { IS_TOUCH } from "../env";

interface Props {
  initial: string;
  onChange: (value: string) => void;
  mode: "ml" | "en";
  online: boolean;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onCtrlEnter?: () => void;
  /** a plain field using the system keyboard (for dialogs, where the typing bar is covered) */
  native?: boolean;
}

/** One Manglish-aware text field. Desktop: live conversion in place. Phone: read-only field fed by the typing bar. */
export default function MlField(p: Props) {
  const ref = useRef<FieldEl>(null);

  useEffect(() => {
    if (p.native || !IS_TOUCH || !p.autoFocus || !ref.current) return;
    setTarget({ el: ref.current, onChange: p.onChange });
    // eslint-disable-next-line
  }, []);

  // Phone: the field is tappable (cursor, selection handles) but only the typing bar may change it. React's onBeforeInput
  // is not the native event and can't cancel it, so listen natively.
  useEffect(() => {
    if (p.native || !IS_TOUCH) return;
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("beforeinput", stop);
    return () => el.removeEventListener("beforeinput", stop);
  }, [p.native]);

  if (p.native) {
    const common = {
      className: p.className, defaultValue: p.initial, placeholder: p.placeholder, lang: "ml", spellCheck: false,
      onChange: (e: React.ChangeEvent<FieldEl>) => p.onChange(e.target.value),
    };
    return p.multiline
      ? <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} rows={2} {...common} />
      : <input ref={ref as React.RefObject<HTMLInputElement>} {...common} />;
  }

  if (IS_TOUCH) {
    const activate = () => { if (ref.current) setTarget({ el: ref.current, onChange: p.onChange }); };
    const common = {
      className: p.className, defaultValue: p.initial, placeholder: p.placeholder, lang: "ml",
      // Not readOnly: a read-only field shows no cursor and can't be tapped to place one. inputMode "none" keeps the
      // system keyboard away (the typing bar writes here), and native input/paste/cut/drop are blocked so only the bar edits.
      inputMode: "none" as const, onClick: activate, onFocus: activate,
      onPaste: (e: React.ClipboardEvent) => e.preventDefault(),
      onCut: (e: React.ClipboardEvent) => e.preventDefault(),
      onDrop: (e: React.DragEvent) => e.preventDefault(),
    };
    return p.multiline
      ? <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} rows={2} {...common} />
      : <input ref={ref as React.RefObject<HTMLInputElement>} {...common} />;
  }

  return (
    <MalayalamEditor
      single={!p.multiline} initial={p.initial} mode={p.mode} online={p.online} onChange={p.onChange}
      className={p.className} placeholder={p.placeholder} autoFocus={p.autoFocus} onCtrlEnter={p.onCtrlEnter}
    />
  );
}
