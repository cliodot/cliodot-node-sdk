import { randomBytes } from "crypto";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function str(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function pluralise(word: string, count = 2): string {
  if (count === 1) return word;
  const irregulars: Record<string, string> = {
    man: "men", woman: "women", child: "children", foot: "feet",
    tooth: "teeth", goose: "geese", mouse: "mice", ox: "oxen",
    person: "people", leaf: "leaves", life: "lives", wife: "wives",
    knife: "knives", wolf: "wolves", loaf: "loaves", potato: "potatoes",
    tomato: "tomatoes", cactus: "cacti", focus: "foci", fungus: "fungi",
    nucleus: "nuclei", syllabus: "syllabi", analysis: "analyses",
    thesis: "theses", crisis: "crises", phenomenon: "phenomena",
    criterion: "criteria", datum: "data",
  };
  const lw = word.toLowerCase();
  if (irregulars[lw]) {
    return word[0] === word[0].toUpperCase()
      ? irregulars[lw].charAt(0).toUpperCase() + irregulars[lw].slice(1)
      : irregulars[lw];
  }
  if (/(?:s|sh|ch|x|z)$/i.test(word)) return word + "es";
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  if (/(?:fe?)$/i.test(word)) return word.replace(/fe?$/, "ves");
  return word + "s";
}

function singularise(word: string): string {
  const irregulars: Record<string, string> = {
    men: "man", women: "woman", children: "child", feet: "foot",
    teeth: "tooth", geese: "goose", mice: "mouse", oxen: "ox",
    people: "person", leaves: "leaf", lives: "life", wives: "wife",
    knives: "knife", wolves: "wolf", loaves: "loaf", potatoes: "potato",
    tomatoes: "tomato", cacti: "cactus", foci: "focus", fungi: "fungus",
    nuclei: "nucleus", syllabi: "syllabus", analyses: "analysis",
    theses: "thesis", crises: "crisis", phenomena: "phenomenon",
    criteria: "criterion", data: "datum",
  };
  const lw = word.toLowerCase();
  if (irregulars[lw]) {
    return word[0] === word[0].toUpperCase()
      ? irregulars[lw].charAt(0).toUpperCase() + irregulars[lw].slice(1)
      : irregulars[lw];
  }
  if (/ies$/i.test(word)) return word.slice(0, -3) + "y";
  if (/ves$/i.test(word)) return word.slice(0, -3) + "fe";
  if (/ses$/i.test(word) || /shes$/i.test(word) || /ches$/i.test(word) || /xes$/i.test(word)) return word.slice(0, -2);
  if (/s$/i.test(word) && !/ss$/i.test(word)) return word.slice(0, -1);
  return word;
}

function wordWrap(s: string, width = 75, breakChar = "\n", cutLong = false): string {
  const words = s.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (cutLong && word.length > width) {
      if (current) { lines.push(current); current = ""; }
      for (let i = 0; i < word.length; i += width) {
        const chunk = word.slice(i, i + width);
        if (i + width < word.length) lines.push(chunk);
        else current = chunk;
      }
    } else if ((current + (current ? " " : "") + word).length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.join(breakChar);
}

function transliterate(s: string): string {
  const MAP: Record<string, string> = {
    À: "A", Á: "A", Â: "A", Ã: "A", Ä: "A", Å: "A", Æ: "AE", Ç: "C",
    È: "E", É: "E", Ê: "E", Ë: "E", Ì: "I", Í: "I", Î: "I", Ï: "I",
    Ð: "D", Ñ: "N", Ò: "O", Ó: "O", Ô: "O", Õ: "O", Ö: "O", Ø: "O",
    Ù: "U", Ú: "U", Û: "U", Ü: "U", Ý: "Y", Þ: "TH", ß: "ss",
    à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a", æ: "ae", ç: "c",
    è: "e", é: "e", ê: "e", ë: "e", ì: "i", í: "i", î: "i", ï: "i",
    ð: "d", ñ: "n", ò: "o", ó: "o", ô: "o", õ: "o", ö: "o", ø: "o",
    ù: "u", ú: "u", û: "u", ü: "u", ý: "y", þ: "th", ÿ: "y",
  };
  return s.split("").map((c) => MAP[c] ?? c).join("");
}

const APA_SMALL = new Set([
  "a", "an", "the", "and", "but", "or", "for", "nor", "as", "at", "by", "for",
  "in", "of", "off", "on", "per", "to", "up", "via", "with", "yet", "so",
]);

export function executeString(opts: any, actionMethod: string): any {
  const o = opts;
  switch (actionMethod) {
    case "concat": {
      const { strings, separator = "" } = o;
      if (!Array.isArray(strings)) throw new Error("Strings array is required");
      return { value: strings.join(separator) };
    }
    case "split": {
      const { string, delimiter, limit } = o;
      if (!string || !delimiter) throw new Error("String and delimiter are required");
      const parts = string.split(delimiter);
      return { value: limit ? parts.slice(0, limit) : parts };
    }
    case "join": {
      const { array, separator = "," } = o;
      if (!Array.isArray(array)) throw new Error("Array is required");
      return { value: array.join(separator) };
    }
    case "replace": {
      const { string, search, replace: replaceWith, case_sensitive = true, use_regex = false } = o;
      if (!string || search === undefined || replaceWith === undefined) throw new Error("String, search, and replace are required");
      const flags = case_sensitive ? "" : "i";
      const pattern = use_regex ? new RegExp(search, flags) : new RegExp(escapeRegex(search), flags);
      return { value: string.replace(pattern, replaceWith) };
    }
    case "replace_all": {
      const { string, search, replace: replaceWith, case_sensitive = true, use_regex = false } = o;
      if (!string || search === undefined || replaceWith === undefined) throw new Error("String, search, and replace are required");
      const flags = case_sensitive ? "g" : "gi";
      const pattern = use_regex ? new RegExp(search, flags) : new RegExp(escapeRegex(search), flags);
      return { value: string.replace(pattern, replaceWith) };
    }
    case "trim": {
      const { string, chars } = o;
      if (string === undefined || string === null) throw new Error("String is required");
      if (chars) return { value: string.replace(new RegExp(`^[${escapeRegex(chars)}]+|[${escapeRegex(chars)}]+$`, "g"), "") };
      return { value: string.trim() };
    }
    case "trim_start": {
      const { string, chars } = o;
      if (string === undefined || string === null) throw new Error("String is required");
      if (chars) return { value: string.replace(new RegExp(`^[${escapeRegex(chars)}]+`, "g"), "") };
      return { value: string.trimStart() };
    }
    case "trim_end": {
      const { string, chars } = o;
      if (string === undefined || string === null) throw new Error("String is required");
      if (chars) return { value: string.replace(new RegExp(`[${escapeRegex(chars)}]+$`, "g"), "") };
      return { value: string.trimEnd() };
    }
    case "to_uppercase":
    case "uppercase":
      if (!o.string) throw new Error("String is required");
      return { value: o.string.toUpperCase() };
    case "to_lowercase":
    case "lowercase":
      if (!o.string) throw new Error("String is required");
      return { value: o.string.toLowerCase() };
    case "capitalize": {
      const { string, all_words = false } = o;
      if (!string) throw new Error("String is required");
      if (all_words) return { value: string.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") };
      return { value: string.charAt(0).toUpperCase() + string.slice(1).toLowerCase() };
    }
    case "substring": {
      const { string, start, end } = o;
      if (!string || start === undefined) throw new Error("String and start are required");
      return { value: end !== undefined ? string.substring(start, end) : string.substring(start) };
    }
    case "length":
      if (o.string === undefined || o.string === null) throw new Error("String is required");
      return { value: o.string.length };
    case "contains": {
      const { string, search, case_sensitive = true } = o;
      if (!string || search === undefined) throw new Error("String and search are required");
      const s = case_sensitive ? string : string.toLowerCase();
      const q = case_sensitive ? search : search.toLowerCase();
      return { value: s.includes(q) };
    }
    case "starts_with": {
      const { string, prefix, case_sensitive = true } = o;
      if (!string || prefix === undefined) throw new Error("String and prefix are required");
      const s = case_sensitive ? string : string.toLowerCase();
      const p = case_sensitive ? prefix : prefix.toLowerCase();
      return { value: s.startsWith(p) };
    }
    case "ends_with": {
      const { string, suffix, case_sensitive = true } = o;
      if (!string || suffix === undefined) throw new Error("String and suffix are required");
      const s = case_sensitive ? string : string.toLowerCase();
      const p = case_sensitive ? suffix : suffix.toLowerCase();
      return { value: s.endsWith(p) };
    }
    case "remove_whitespace": {
      const { string, preserve_spaces = false } = o;
      if (!string) throw new Error("String is required");
      if (preserve_spaces) return { value: string.trim().replace(/\s+/g, " ") };
      return { value: string.replace(/\s+/g, "") };
    }
    case "slugify": {
      const { string, separator = "-", lowercase = true, preserve_case = false } = o;
      if (!string) throw new Error("String is required");
      let slug = transliterate(string.trim());
      if (!preserve_case && lowercase) slug = slug.toLowerCase();
      slug = slug.replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, separator).replace(
        new RegExp(`^${escapeRegex(separator)}+|${escapeRegex(separator)}+$`, "g"), ""
      );
      return { value: slug };
    }
    case "pad_start": {
      const { string, length, pad_string = " " } = o;
      if (!string || length === undefined) throw new Error("String and length are required");
      return { value: string.padStart(length, pad_string) };
    }
    case "pad_end": {
      const { string, length, pad_string = " " } = o;
      if (!string || length === undefined) throw new Error("String and length are required");
      return { value: string.padEnd(length, pad_string) };
    }
    case "reverse":
      if (!o.string) throw new Error("String is required");
      return { value: [...o.string].reverse().join("") };
    case "encode_base64": {
      const { string, url_safe = false } = o;
      if (!string) throw new Error("String is required");
      const encoded = Buffer.from(string).toString("base64");
      return { value: url_safe ? encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "") : encoded };
    }
    case "decode_base64": {
      const { string, url_safe = false } = o;
      if (!string) throw new Error("Base64 string is required");
      let decoded = string;
      if (url_safe) {
        decoded = decoded.replace(/-/g, "+").replace(/_/g, "/");
        while (decoded.length % 4) decoded += "=";
      }
      return { value: Buffer.from(decoded, "base64").toString("utf-8") };
    }
    case "encode_uri": {
      const { string, component = true } = o;
      if (!string) throw new Error("String is required");
      return { value: component ? encodeURIComponent(string) : encodeURI(string) };
    }
    case "decode_uri": {
      const { string, component = true } = o;
      if (!string) throw new Error("Encoded URI string is required");
      return { value: component ? decodeURIComponent(string) : decodeURI(string) };
    }
    case "after": {
      const { string, search } = o;
      if (!string || !search) throw new Error("String and search are required");
      const idx = string.indexOf(search);
      return { value: idx === -1 ? string : string.slice(idx + search.length) };
    }
    case "after_last": {
      const { string, search } = o;
      if (!string || !search) throw new Error("String and search are required");
      const idx = string.lastIndexOf(search);
      return { value: idx === -1 ? string : string.slice(idx + search.length) };
    }
    case "before": {
      const { string, search } = o;
      if (!string || !search) throw new Error("String and search are required");
      const idx = string.indexOf(search);
      return { value: idx === -1 ? string : string.slice(0, idx) };
    }
    case "before_last": {
      const { string, search } = o;
      if (!string || !search) throw new Error("String and search are required");
      const idx = string.lastIndexOf(search);
      return { value: idx === -1 ? string : string.slice(0, idx) };
    }
    case "between": {
      const { string, from, to } = o;
      if (!string || !from || !to) throw new Error("String, from, and to are required");
      const start = string.indexOf(from);
      const end = string.lastIndexOf(to);
      if (start === -1 || end === -1 || end <= start) return { value: string };
      return { value: string.slice(start + from.length, end) };
    }
    case "between_first": {
      const { string, from, to } = o;
      if (!string || !from || !to) throw new Error("String, from, and to are required");
      const start = string.indexOf(from);
      if (start === -1) return { value: string };
      const end = string.indexOf(to, start + from.length);
      if (end === -1) return { value: string };
      return { value: string.slice(start + from.length, end) };
    }
    case "camel": {
      const { string } = o;
      if (!string) throw new Error("String is required");
      const s = string.replace(/[-_\s]+(.)/g, (_: string, c: string) => c.toUpperCase());
      return { value: s.charAt(0).toLowerCase() + s.slice(1) };
    }
    case "char_at": {
      const { string, index } = o;
      if (!string || index === undefined) throw new Error("String and index are required");
      return { value: string.charAt(index) };
    }
    case "chop_start": {
      const { string, needle } = o;
      if (string === undefined || !needle) throw new Error("String and needle are required");
      return { value: string.startsWith(needle) ? string.slice(needle.length) : string };
    }
    case "chop_end": {
      const { string, needle } = o;
      if (string === undefined || !needle) throw new Error("String and needle are required");
      return { value: string.endsWith(needle) ? string.slice(0, -needle.length) : string };
    }
    case "contains_all": {
      const { string, needles, case_sensitive = true } = o;
      if (!string || !Array.isArray(needles)) throw new Error("String and needles array are required");
      const s = case_sensitive ? string : string.toLowerCase();
      return { value: (needles as string[]).every((n) => s.includes(case_sensitive ? n : n.toLowerCase())) };
    }
    case "doesnt_contain": {
      const { string, search, case_sensitive = true } = o;
      if (!string || search === undefined) throw new Error("String and search are required");
      const s = case_sensitive ? string : string.toLowerCase();
      const q = case_sensitive ? search : search.toLowerCase();
      return { value: !s.includes(q) };
    }
    case "doesnt_start_with": {
      const { string, prefix, case_sensitive = true } = o;
      if (!string || prefix === undefined) throw new Error("String and prefix are required");
      const s = case_sensitive ? string : string.toLowerCase();
      const p = case_sensitive ? prefix : prefix.toLowerCase();
      return { value: !s.startsWith(p) };
    }
    case "doesnt_end_with": {
      const { string, suffix, case_sensitive = true } = o;
      if (!string || suffix === undefined) throw new Error("String and suffix are required");
      const s = case_sensitive ? string : string.toLowerCase();
      const p = case_sensitive ? suffix : suffix.toLowerCase();
      return { value: !s.endsWith(p) };
    }
    case "deduplicate": {
      const { string, character = " " } = o;
      if (string === undefined || string === null) throw new Error("String is required");
      const esc = escapeRegex(character);
      return { value: string.replace(new RegExp(`${esc}{2,}`, "g"), character) };
    }
    case "excerpt": {
      const { string, phrase, radius = 100, omission = "..." } = o;
      if (!string || !phrase) throw new Error("String and phrase are required");
      const idx = string.toLowerCase().indexOf(phrase.toLowerCase());
      if (idx === -1) return { value: string.length > radius * 2 ? omission + string.slice(0, radius) + omission : string };
      const start = Math.max(0, idx - radius);
      const end = Math.min(string.length, idx + phrase.length + radius);
      const pre = start > 0 ? omission : "";
      const post = end < string.length ? omission : "";
      return { value: pre + string.slice(start, end) + post };
    }
    case "finish": {
      const { string, cap } = o;
      if (string === undefined || !cap) throw new Error("String and cap are required");
      return { value: string.endsWith(cap) ? string : string + cap };
    }
    case "start": {
      const { string, prefix } = o;
      if (string === undefined || !prefix) throw new Error("String and prefix are required");
      return { value: string.startsWith(prefix) ? string : prefix + string };
    }
    case "headline": {
      const { string } = o;
      if (!string) throw new Error("String is required");
      const words = string.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").trim().split(/\s+/);
      return { value: words.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") };
    }
    case "is": {
      const { string, pattern } = o;
      if (!string || !pattern) throw new Error("String and pattern are required");
      const regex = new RegExp("^" + escapeRegex(pattern).replace(/\\\*/g, ".*") + "$");
      return { value: regex.test(string) };
    }
    case "is_ascii":
      if (o.string === undefined || o.string === null) throw new Error("String is required");
      return { value: /^[\x00-\x7F]*$/.test(o.string) };
    case "is_json":
      if (o.string === undefined || o.string === null) throw new Error("String is required");
      try { JSON.parse(o.string); return { value: true }; } catch { return { value: false }; }
    case "is_ulid":
      if (o.string === undefined || o.string === null) throw new Error("String is required");
      return { value: /^[0-9A-Z]{26}$/i.test(o.string) };
    case "is_url": {
      const { string, protocols = ["http", "https"] } = o;
      if (!string) throw new Error("String is required");
      try {
        const u = new URL(string);
        const proto = u.protocol.replace(":", "");
        return { value: (protocols as string[]).includes(proto) };
      } catch { return { value: false }; }
    }
    case "is_uuid":
      if (o.string === undefined || o.string === null) throw new Error("String is required");
      return { value: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o.string) };
    case "is_empty":
      if (o.string === undefined || o.string === null) return { value: true };
      return { value: str(o.string).trim().length === 0 };
    case "is_match": {
      const { string, pattern, flags = "" } = o;
      if (string === undefined || !pattern) throw new Error("String and pattern are required");
      return { value: new RegExp(pattern, flags).test(string) };
    }
    case "kebab": {
      const { string } = o;
      if (!string) throw new Error("String is required");
      return { value: string.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase() };
    }
    case "snake": {
      const { string, delimiter = "_" } = o;
      if (!string) throw new Error("String is required");
      return { value: string.replace(/([a-z])([A-Z])/g, `$1${delimiter}$2`).replace(/[\s-]+/g, delimiter).toLowerCase() };
    }
    case "studly": {
      const { string } = o;
      if (!string) throw new Error("String is required");
      const s = string.replace(/[-_\s]+(.)/g, (_: string, c: string) => c.toUpperCase());
      return { value: s.replace(/^(.)/, (c: string) => c.toUpperCase()) };
    }
    case "title":
      if (!o.string) throw new Error("String is required");
      return { value: o.string.replace(/\w\S*/g, (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) };
    case "lcfirst":
      if (!o.string) throw new Error("String is required");
      return { value: o.string.charAt(0).toLowerCase() + o.string.slice(1) };
    case "ucfirst":
      if (!o.string) throw new Error("String is required");
      return { value: o.string.charAt(0).toUpperCase() + o.string.slice(1) };
    case "ucwords": {
      const { string, separators = " " } = o;
      if (!string) throw new Error("String is required");
      const sepRe = new RegExp(`([${escapeRegex(separators)}])`, "g");
      return { value: string.split(sepRe).map((part: string) =>
        separators.includes(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)
      ).join("") };
    }
    case "ucsplit": {
      const { string } = o;
      if (!string) throw new Error("String is required");
      return { value: string.replace(/([A-Z])/g, " $1").trim().split(/\s+/) };
    }
    case "limit": {
      const { string, limit: lim = 100, end = "..." } = o;
      if (string === undefined || string === null) throw new Error("String is required");
      if (string.length <= lim) return { value: string };
      return { value: string.slice(0, lim) + end };
    }
    case "mask": {
      const { string, character = "*", index, length } = o;
      if (!string || index === undefined) throw new Error("String and index are required");
      const len = string.length;
      const start = index < 0 ? Math.max(0, len + index) : Math.min(index, len);
      const maskLen = length !== undefined
        ? (length < 0 ? Math.max(0, len + length - start) : Math.min(length, len - start))
        : len - start;
      return { value: string.slice(0, start) + character.repeat(maskLen) + string.slice(start + maskLen) };
    }
    case "match": {
      const { string, pattern, flags = "" } = o;
      if (!string || !pattern) throw new Error("String and pattern are required");
      const m = string.match(new RegExp(pattern, flags));
      return { value: m ? (m[1] ?? m[0]) : null };
    }
    case "match_all": {
      const { string, pattern, flags = "g" } = o;
      if (!string || !pattern) throw new Error("String and pattern are required");
      const re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
      const results: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(string)) !== null) results.push(m[1] ?? m[0]);
      return { value: results };
    }
    case "pad_both": {
      const { string, length, pad_string = " " } = o;
      if (string === undefined || length === undefined) throw new Error("String and length are required");
      const totalPad = Math.max(0, length - string.length);
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;
      const pad = (n: number) => pad_string.repeat(Math.ceil(n / pad_string.length)).slice(0, n);
      return { value: pad(leftPad) + string + pad(rightPad) };
    }
    case "plural": {
      const { string, count = 2 } = o;
      if (!string) throw new Error("String is required");
      return { value: pluralise(string, count) };
    }
    case "singular": {
      const { string } = o;
      if (!string) throw new Error("String is required");
      return { value: singularise(string) };
    }
    case "position": {
      const { string, search, offset = 0, case_sensitive = true } = o;
      if (!string || !search) throw new Error("String and search are required");
      const s = case_sensitive ? string : string.toLowerCase();
      const q = case_sensitive ? search : search.toLowerCase();
      const idx = s.indexOf(q, offset);
      return { value: idx === -1 ? null : idx };
    }
    case "random": {
      const { length = 16, charset = "alphanumeric" } = o;
      const chars: Record<string, string> = {
        alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        alpha: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
        numeric: "0123456789",
        hex: "0123456789abcdef",
        lowercase: "abcdefghijklmnopqrstuvwxyz",
        uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      };
      const pool = chars[charset] ?? chars.alphanumeric;
      const bytes = randomBytes(length);
      return { value: Array.from(bytes).map((b) => pool[b % pool.length]).join("") };
    }
    case "remove": {
      const { string, search, case_sensitive = true } = o;
      if (string === undefined || search === undefined) throw new Error("String and search are required");
      const needles = Array.isArray(search) ? search : [search];
      let result = string;
      for (const needle of needles) {
        const flags = case_sensitive ? "g" : "gi";
        result = result.replace(new RegExp(escapeRegex(needle), flags), "");
      }
      return { value: result };
    }
    case "repeat": {
      const { string, times } = o;
      if (string === undefined || times === undefined) throw new Error("String and times are required");
      return { value: string.repeat(times) };
    }
    case "replace_array": {
      const { string, search, replace: values } = o;
      if (!string || !search || !Array.isArray(values)) throw new Error("String, search, and replace array are required");
      let i = 0;
      return { value: string.replace(new RegExp(escapeRegex(search), "g"), () => str(values[i++] ?? "")) };
    }
    case "replace_first": {
      const { string, search, replace: replaceWith } = o;
      if (!string || search === undefined || replaceWith === undefined) throw new Error("String, search, and replace are required");
      return { value: string.replace(search, replaceWith) };
    }
    case "replace_last": {
      const { string, search, replace: replaceWith } = o;
      if (!string || search === undefined || replaceWith === undefined) throw new Error("String, search, and replace are required");
      const idx = string.lastIndexOf(search);
      if (idx === -1) return { value: string };
      return { value: string.slice(0, idx) + replaceWith + string.slice(idx + search.length) };
    }
    case "replace_matches": {
      const { string, pattern, replace: replaceWith, flags = "g" } = o;
      if (!string || !pattern || replaceWith === undefined) throw new Error("String, pattern, and replace are required");
      return { value: string.replace(new RegExp(pattern, flags), replaceWith) };
    }
    case "replace_start": {
      const { string, search, replace: replaceWith } = o;
      if (string === undefined || search === undefined || replaceWith === undefined) throw new Error("String, search, and replace are required");
      return { value: string.startsWith(search) ? replaceWith + string.slice(search.length) : string };
    }
    case "replace_end": {
      const { string, search, replace: replaceWith } = o;
      if (string === undefined || search === undefined || replaceWith === undefined) throw new Error("String, search, and replace are required");
      return { value: string.endsWith(search) ? string.slice(0, -search.length) + replaceWith : string };
    }
    case "squish":
      if (o.string === undefined || o.string === null) throw new Error("String is required");
      return { value: o.string.trim().replace(/\s+/g, " ") };
    case "substr": {
      const { string, start, length } = o;
      if (!string || start === undefined) throw new Error("String and start are required");
      const s: string = string;
      const from = start < 0 ? Math.max(0, s.length + start) : start;
      return { value: length !== undefined ? s.slice(from, from + length) : s.slice(from) };
    }
    case "substr_count": {
      const { string, needle, case_sensitive = true } = o;
      if (!string || !needle) throw new Error("String and needle are required");
      const s = case_sensitive ? string : string.toLowerCase();
      const n = case_sensitive ? needle : needle.toLowerCase();
      let count = 0, pos = 0;
      while ((pos = s.indexOf(n, pos)) !== -1) { count++; pos += n.length; }
      return { value: count };
    }
    case "substr_replace": {
      const { string, replace: replaceWith, offset, length } = o;
      if (!string || replaceWith === undefined || offset === undefined) throw new Error("String, replace, and offset are required");
      const s: string = string;
      const from = offset < 0 ? Math.max(0, s.length + offset) : offset;
      const end = length !== undefined ? from + length : s.length;
      return { value: s.slice(0, from) + replaceWith + s.slice(end) };
    }
    case "swap": {
      const { string, map } = o;
      if (!string || !map) throw new Error("String and map are required");
      const keys = Object.keys(map).sort((a, b) => b.length - a.length);
      const pattern = keys.map(escapeRegex).join("|");
      if (!pattern) return { value: string };
      return { value: string.replace(new RegExp(pattern, "g"), (match: string) => str(map[match])) };
    }
    case "take": {
      const { string, count } = o;
      if (string === undefined || count === undefined) throw new Error("String and count are required");
      return { value: count >= 0 ? string.slice(0, count) : string.slice(count) };
    }
    case "word_count":
      if (o.string === undefined || o.string === null) throw new Error("String is required");
      const trimmed = o.string.trim();
      return { value: trimmed === "" ? 0 : trimmed.split(/\s+/).length };
    case "word_wrap": {
      const { string, characters = 75, break: breakChar = "\n", cut_long_words = false } = o;
      if (!string) throw new Error("String is required");
      return { value: wordWrap(string, characters, breakChar, cut_long_words) };
    }
    case "words": {
      const { string, words: limit = 100, end = "..." } = o;
      if (!string) throw new Error("String is required");
      const parts = string.trim().split(/\s+/);
      if (parts.length <= limit) return { value: string };
      return { value: parts.slice(0, limit).join(" ") + end };
    }
    case "wrap": {
      const { string, before, after } = o;
      if (string === undefined || !before) throw new Error("String and before are required");
      return { value: before + string + (after ?? before) };
    }
    case "unwrap": {
      const { string, before, after } = o;
      if (string === undefined || !before) throw new Error("String and before are required");
      const suf = after ?? before;
      let result = string;
      if (result.startsWith(before)) result = result.slice(before.length);
      if (result.endsWith(suf)) result = result.slice(0, -suf.length);
      return { value: result };
    }
    case "uuid": {
      const bytes = randomBytes(16);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = bytes.toString("hex");
      return { value: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` };
    }
    case "ulid": {
      const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
      const ts = Date.now();
      const rand = randomBytes(10);
      let result = "";
      let t = ts;
      for (let i = 9; i >= 0; i--) { result = ENCODING[t % 32] + result; t = Math.floor(t / 32); }
      let rVal = BigInt("0x" + rand.toString("hex"));
      let rStr = "";
      for (let i = 15; i >= 0; i--) { rStr = ENCODING[Number(rVal % 32n)] + rStr; rVal /= 32n; }
      return { value: result + rStr };
    }
    case "strip_tags": {
      const { string, allowed_tags = "" } = o;
      if (string === undefined || string === null) throw new Error("String is required");
      if (!allowed_tags) return { value: string.replace(/<[^>]*>/g, "") };
      const allowed = allowed_tags.split(",").map((t: string) => t.trim().toLowerCase());
      return { value: string.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match: string, tag: string) =>
        allowed.includes(tag.toLowerCase()) ? match : ""
      ) };
    }
    case "ascii":
      if (!o.string) throw new Error("String is required");
      return { value: transliterate(o.string).replace(/[^\x00-\x7F]/g, "") };
    case "apa": {
      const { string } = o;
      if (!string) throw new Error("String is required");
      const words = string.trim().split(/\s+/);
      return { value: words.map((w: string, i: number) => {
        const low = w.toLowerCase();
        return (i === 0 || !APA_SMALL.has(low))
          ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          : low;
      }).join(" ") };
    }
    case "class_basename": {
      const { class_name, delimiter = "\\" } = o;
      if (!class_name) throw new Error("class_name is required");
      const parts = class_name.split(delimiter);
      return { value: parts[parts.length - 1] };
    }
    default: {
      const val = o.value ?? o.string ?? "";
      return { value: String(val) };
    }
  }
}
