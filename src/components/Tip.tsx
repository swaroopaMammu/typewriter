import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { registerTip } from "../lib/tips";

/**
 * Wraps one control and shows a short hint under it, once ever, for 3 seconds. Tips run one after another
 * (lowest `order` first). `className` goes on the wrapper, so put layout classes like "hide-sm" there.
 */
export default function Tipped({ id, text, order, className, children }: {
  id: string; text: string; order: number; className?: string; children: React.ReactNode;
}) {
  const [on, setOn] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  useEffect(() => registerTip({
    id, order,
    visible: () => {
      const el = wrap.current?.firstElementChild as HTMLElement | null;
      return !!el && el.offsetParent !== null;
    },
    show: () => setOn(true),
    hide: () => setOn(false),
  }), [id, order]);

  // keep the bubble inside the screen; the little arrow keeps pointing at the control
  useLayoutEffect(() => {
    const b = bubble.current;
    if (!on || !b) return;
    b.style.setProperty("--dx", "0px");
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth;
    const dx = r.left < 8 ? 8 - r.left : r.right > vw - 8 ? vw - 8 - r.right : 0;
    b.style.setProperty("--dx", `${dx}px`);
  }, [on]);

  return (
    <span ref={wrap} className={className ? `tip-wrap ${className}` : "tip-wrap"}>
      {children}
      {on && <span ref={bubble} className="tip" role="status">{text}</span>}
    </span>
  );
}
