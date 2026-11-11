import { IS_NATIVE } from "../../env";

type HostDownloads = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };

async function saveBlob(filename: string, blob: Blob) {
  if (IS_NATIVE) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const b64: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] ?? "");
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
    const w = await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
    await Share.share({ title: filename, url: w.uri, dialogTitle: "Save or share" });
    return;
  }
  const host = (window as unknown as { claude?: { use: (n: string) => Promise<HostDownloads | null> } }).claude;
  if (host?.use) {
    const d = await host.use("downloads");
    if (d) await d.save({ filename, data: blob }).catch(() => undefined);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Renders the reader (#book) exactly as it looks, in light colours on white,
 * one chapter per page like Print, and saves it as an A4 PDF.
 * Image-based on purpose: Malayalam shaping and the dialogue layout come out identical to the screen.
 */
export async function downloadBookPdf(article: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  await document.fonts.ready;

  const root = document.createElement("div");
  root.setAttribute("data-theme", "light");
  root.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;color:#000;";
  const clone = article.cloneNode(true) as HTMLElement;
  clone.id = "";
  clone.style.cssText =
    "width:794px;max-width:none;margin:0;padding:56px 64px;background:#fff;border:0;border-radius:0;color:#000;" +
    "-webkit-backdrop-filter:none;backdrop-filter:none;font-size:" + article.style.fontSize;
  clone.querySelectorAll<HTMLElement>(".muted").forEach((e) => (e.style.color = "#555"));
  root.appendChild(clone);
  document.body.appendChild(root);

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  let first = true;

  try {
    // pieces: title block + first chapter on page 1, then each further chapter on a new page (like Print)
    const chapters = Array.from(clone.querySelectorAll<HTMLElement>(":scope > .chapter"));
    const head = Array.from(clone.children).filter((c) => !c.classList.contains("chapter")) as HTMLElement[];
    const pieces: HTMLElement[] = [];
    chapters.forEach((c, i) => {
      c.style.marginTop = i === 0 ? "1.2em" : "0";
      const w = document.createElement("div");
      w.style.cssText = "width:794px;max-width:none;margin:0;border:0;border-radius:0;backdrop-filter:none;-webkit-backdrop-filter:none;padding:56px 64px;background:#fff;color:#000;box-sizing:border-box;font-size:" + article.style.fontSize;
      w.className = clone.className;
      w.style.lineHeight = "2";
      if (i === 0) head.forEach((h) => w.appendChild(h));
      w.appendChild(c);
      pieces.push(w);
    });
    clone.innerHTML = "";
    pieces.forEach((w) => clone.appendChild(w));
    clone.style.padding = "0";

    for (const el of pieces) {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 794 });
      const scale = PW / canvas.width;
      const sliceH = Math.floor(PH / scale); // canvas px per page
      for (let y = 0; y < canvas.height; y += sliceH) {
        const h = Math.min(sliceH, canvas.height - y);
        const part = document.createElement("canvas");
        part.width = canvas.width;
        part.height = h;
        const ctx = part.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, part.width, part.height);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, PW, h * scale);
      }
    }
  } finally {
    root.remove();
  }
  await saveBlob(filename, pdf.output("blob"));
}
