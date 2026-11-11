const COPY = [
  "direction", "boxSizing", "width", "height", "overflowX", "overflowY", "borderTopWidth", "borderRightWidth",
  "borderBottomWidth", "borderLeftWidth", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "lineHeight", "fontFamily",
  "textAlign", "textTransform", "textIndent", "letterSpacing", "wordSpacing", "tabSize",
] as const;

/** Pixel position of character index `pos` inside a textarea, relative to the textarea's top-left. */
export function caretCoords(el: HTMLTextAreaElement | HTMLInputElement, pos: number) {
  const cs = getComputedStyle(el);
  const div = document.createElement("div");
  for (const p of COPY) (div.style as unknown as Record<string, string>)[p] = cs[p] as string;
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = el instanceof HTMLInputElement ? "pre" : "pre-wrap";
  div.style.overflowWrap = "break-word";
  div.style.top = "0";
  div.style.left = "-9999px";
  div.textContent = el.value.slice(0, pos);
  const span = document.createElement("span");
  span.textContent = el.value.slice(pos) || ".";
  div.appendChild(span);
  document.body.appendChild(div);
  const out = {
    top: span.offsetTop - el.scrollTop,
    left: span.offsetLeft - el.scrollLeft,
    height: parseFloat(cs.lineHeight) || 24,
  };
  document.body.removeChild(div);
  return out;
}
