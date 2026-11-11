import { describe, expect, it } from "vitest";
import { transliterate as t } from "./engine";

const pairs = (list: [string, string][]) => () => {
  for (const [src, want] of list) expect(t(src), src).toBe(want);
};

describe("transliterate", () => {
  it("vowels", pairs([
    ["a", "അ"], ["aa", "ആ"], ["i", "ഇ"], ["ee", "ഈ"], ["u", "ഉ"], ["oo", "ഊ"],
    ["e", "എ"], ["E", "ഏ"], ["ai", "ഐ"], ["o", "ഒ"], ["O", "ഓ"], ["au", "ഔ"],
  ]));

  it("consonant + vowel (matras)", pairs([
    ["ka", "ക"], ["kaa", "കാ"], ["ki", "കി"], ["kee", "കീ"], ["ku", "കു"],
    ["koo", "കൂ"], ["ke", "കെ"], ["kE", "കേ"], ["kai", "കൈ"], ["ko", "കൊ"], ["kO", "കോ"],
  ]));

  it("common words", pairs([
    ["amma", "അമ്മ"], ["achan", "അചൻ"], ["mazha", "മഴ"], ["pazham", "പഴം"],
    ["vaazha", "വാഴ"], ["avanu", "അവനു"], ["thanne", "തന്നെ"], ["onnu", "ഒന്നു"],
    ["kandu", "കണ്ടു"], ["pankajam", "പങ്കജം"], ["manjju", "മഞ്ജു"], ["kunju", "കുഞു"],
    ["sundharam", "സുന്ദരം"], ["kaattu", "കാട്ടു"], ["kaarru", "കാറ്റു"],
  ]));

  it("word-final chillu and anusvara", pairs([
    ["avan", "അവൻ"], ["aval", "അവൽ"], ["paal", "പാൽ"], ["kaar", "കാർ"],
    ["avaL", "അവൾ"], ["maram", "മരം"], ["kaN", "കൺ"],
  ]));

  it("geminates stay non-chillu", pairs([["kann", "കന്ന്"], ["kall", "കല്ല്"]]));

  it("explicit forms", pairs([
    ["saMsaaram", "സംസാരം"], ["dhuHkham", "ദുഃഖം"], ["n~", "ൻ"], ["avan_", "അവന്"],
    ["tt", "ട്ട്"], ["rr", "റ്റ്"], ["tth", "ത്ത്"],
  ]));

  it("conjuncts", pairs([
    ["ksha", "ക്ഷ"], ["nta", "ന്റ"], ["ntha", "ന്ത"], ["ndha", "ന്ദ"],
    ["nka", "ങ്ക"], ["ncha", "ഞ്ച"], ["njnja", "ഞ്ഞ"], ["nja", "ഞ"],
  ]));

  it("ng + vowel is geminate, cch/ddh", pairs([
    ["angane", "അങ്ങനെ"], ["pankaj", "പങ്കജ്"], ["cchaa", "ച്ചാ"], ["ddha", "ദ്ദ"],
  ]));

  it("passes through unknown characters", pairs([["1", "1"], ["", ""]]));
});
