import MalayalamEditor from "./MalayalamEditor";

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
  onEnter?: (value: string) => void;
  clearOnEnter?: boolean;
}

/** One Manglish-aware text field: type English letters on the keyboard (desktop or phone) and it converts in place. */
export default function MlField(p: Props) {
  return (
    <MalayalamEditor
      single={!p.multiline} initial={p.initial} mode={p.mode} online={p.online} onChange={p.onChange}
      className={p.className} placeholder={p.placeholder} autoFocus={p.autoFocus} onCtrlEnter={p.onCtrlEnter} onEnter={p.onEnter} clearOnEnter={p.clearOnEnter}
    />
  );
}
