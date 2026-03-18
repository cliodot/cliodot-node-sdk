import Jexl from "jexl";

let templateJexl: InstanceType<typeof Jexl.Jexl> | null = null;

function getTemplateJexl(): InstanceType<typeof Jexl.Jexl> {
  if (templateJexl) return templateJexl;
  const jexl = new Jexl.Jexl();
  jexl.addFunctions({
    lowercase: (v: any) => (v != null ? String(v).toLowerCase() : v),
    trim: (v: any) => (v != null ? String(v).trim() : v),
    uppercase: (v: any) => (v != null ? String(v).toUpperCase() : v),
    substring: (v: any, start?: number, end?: number) => {
      if (v == null) return v;
      const s = String(v);
      const st = start ?? 0;
      return end != null ? s.substring(st, end) : s.substring(st);
    },
    replace: (v: any, search?: string, repl?: string) =>
      v != null ? String(v).replace(search ?? "", repl ?? "") : v,
    split: (v: any, sep?: string, limit?: number) => {
      if (v == null) return v;
      const arr = String(v).split(sep ?? ",");
      return limit != null ? arr.slice(0, limit) : arr;
    },
    join: (v: any, sep?: string) =>
      Array.isArray(v) ? v.join(sep ?? ",") : v != null ? String(v) : v,
    default_value: (v: any, d: any) => (v != null && v !== "" ? v : d),
    to_string: (v: any) => (v != null ? String(v) : v),
    to_number: (v: any) => (v != null ? Number(v) : v),
    to_boolean: (v: any) => (v != null ? Boolean(v) : v),
    json_parse: (v: any) => (typeof v === "string" ? JSON.parse(v) : v),
    json_stringify: (v: any) => (v != null ? JSON.stringify(v) : v),
    length: (v: any) =>
      v != null ? (Array.isArray(v) ? v.length : String(v).length) : 0,
    first: (v: any) =>
      Array.isArray(v) && v.length > 0 ? v[0] : v != null ? String(v)[0] : v,
    last: (v: any) =>
      Array.isArray(v) && v.length > 0
        ? v[v.length - 1]
        : v != null
          ? String(v).slice(-1)
          : v,
    coalesce: (obj: any, fieldsArg?: string | string[]) => {
      const fields = Array.isArray(fieldsArg) ? fieldsArg : fieldsArg ? [fieldsArg] : [];
      if (!obj || typeof obj !== "object") return undefined;
      for (const f of fields) {
        const val = f.split(".").reduce((o: any, p) => o?.[p], obj);
        if (val != null && val !== "") return val;
      }
      return undefined;
    },
  });
  templateJexl = jexl;
  return templateJexl;
}

function preprocessExpression(expr: string): string {
  let result = expr;
  let changed = true;
  let iterations = 0;
  const maxIterations = 10;
  while (changed && iterations < maxIterations) {
    iterations++;
    const before = result;
    result = result.replace(
      /([\w\]])\.([a-zA-Z_][a-zA-Z0-9_-]+)(?![\[\(])/g,
      (match, base, prop) => {
        if (prop.includes("-") || /^\d/.test(prop)) {
          return `${base}['${prop}']`;
        }
        return match;
      }
    );
    changed = before !== result;
  }
  return result;
}

export async function renderTemplate(
  template: string,
  context: Record<string, any> = {}
): Promise<any> {
  if (typeof template !== "string") return template;
  if (!template.includes("{{")) return template;

  const regex = /\{\{\s*([^}]+)\s*\}\}/g;
  let result = template;
  let offset = 0;
  const matches = [...template.matchAll(regex)];

  for (const match of matches) {
    const expr = match[1].trim();
    try {
      const value = await evaluateExpression(expr, context);
      let replacement: string;
      const adjustedMatchIndex = match.index! + offset;
      let replaceStart = adjustedMatchIndex;
      let replaceLength = match[0].length;

      if (value == null) {
        replacement = "";
      } else if (typeof value === "object") {
        replacement = JSON.stringify(value);
      } else {
        replacement = String(value);
      }

      const lengthDiff = replacement.length - replaceLength;
      offset += lengthDiff;
      result =
        result.substring(0, replaceStart) +
        replacement +
        result.substring(replaceStart + replaceLength);
    } catch (err) {
      const adjustedMatchIndex = match.index! + offset;
      result =
        result.substring(0, adjustedMatchIndex) +
        "" +
        result.substring(adjustedMatchIndex + match[0].length);
      offset -= match[0].length;
    }
  }
  return result;
}

export async function evaluateExpression(
  expr: string,
  context: Record<string, any>
): Promise<any> {
  const processedExpr = preprocessExpression(expr);
  const jexl = getTemplateJexl();
  return jexl.eval(processedExpr, context);
}
