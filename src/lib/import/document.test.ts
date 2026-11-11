import { describe, expect, it } from "vitest";
import { buildSections, convertToMalayalam, isHeading, reflow, splitSections } from "./document";

describe("convertToMalayalam", () => {
  it("converts English-letter words and keeps Malayalam, digits and punctuation", () => {
    expect(convertToMalayalam("avan, maram 12!")).toBe("അവൻ, മരം 12!");
    expect(convertToMalayalam("മരം avan")).toBe("മരം അവൻ");
  });
  it("treats a sentence-case word as lower case", () => {
    expect(convertToMalayalam("Avan")).toBe(convertToMalayalam("avan"));
  });
});

describe("reflow", () => {
  it("joins hard-wrapped lines inside paragraphs", () => {
    expect(reflow("a b\nc d\n\ne f")).toBe("a b c d\n\ne f");
  });
  it("leaves one-paragraph-per-line text alone", () => {
    expect(reflow("a\nb\nc")).toBe("a\nb\nc");
  });
});

describe("splitSections", () => {
  it("splits at chapter headings", () => {
    const r = splitSections("Chapter 1\nhello\n\nChapter 2: Two\nworld", "novel");
    expect(r.map((p) => p.title)).toEqual(["Chapter 1", "Chapter 2: Two"]);
    expect(r[1].body).toBe("world");
  });
  it("keeps short text as one section", () => {
    expect(splitSections("just a short note", "novel")).toHaveLength(1);
  });
  it("chunks long text without headings into several chapters", () => {
    const para = Array(100).fill("word").join(" ");
    const text = Array(40).fill(para).join("\n\n");
    expect(splitSections(text, "novel").length).toBeGreaterThan(1);
  });
  it("never chunks poems", () => {
    expect(splitSections(Array(5000).fill("word").join(" "), "poem")).toHaveLength(1);
  });
});

describe("buildSections", () => {
  it("keep mode stores text as it is", () => {
    expect(buildSections("Chapter 1\navan", { type: "novel", mode: "keep" })[0]).toEqual({ title: "Chapter 1", body: "avan" });
  });
  it("convert mode converts title and body", () => {
    const [p] = buildSections("avan\nmaram", { type: "poem", mode: "convert" });
    expect(p.body).toBe("അവൻ\nമരം");
  });
});

describe("headings", () => {
  it("recognises headings but not sentences that start with the same word", () => {
    expect(isHeading("Chapter 1")).toBe(true);
    expect(isHeading("Chapter 2: The river")).toBe(true);
    expect(isHeading("അധ്യായം 3")).toBe(true);
    expect(isHeading("Part of the road was closed because of the rain.")).toBe(false);
    expect(isHeading("Partly cloudy")).toBe(false);
  });
  it("keeps a heading that is directly followed by text as its own section", () => {
    const r = buildSections("Chapter 1\nAvan veettil poyi.\nAvan maram kandu.\n\nChapter 2\nNjan vayichu.", { type: "novel", mode: "keep" });
    expect(r).toEqual([
      { title: "Chapter 1", body: "Avan veettil poyi. Avan maram kandu." },
      { title: "Chapter 2", body: "Njan vayichu." },
    ]);
  });
});

describe("heading words when converting", () => {
  it("maps Chapter/Part/Poem to Malayalam instead of transliterating them", () => {
    const r = buildSections("Chapter 1\navan\n\nChapter 2\nmaram", { type: "novel", mode: "convert" });
    expect(r.map((p) => p.title)).toEqual(["അധ്യായം 1", "അധ്യായം 2"]);
    expect(r[0].body).toBe("അവൻ");
  });
});
