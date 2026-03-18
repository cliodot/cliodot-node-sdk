import { randomBytes } from "crypto";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

export function executeRandom(opts: any, actionMethod: string): any {
  const o = opts;
  switch (actionMethod) {
    case "random_int": {
      const min = o.min ?? 0;
      const max = o.max ?? 100;
      return { value: randomInt(+min, +max + 1) };
    }
    case "random_float": {
      const min = o.min ?? 0;
      const max = o.max ?? 1;
      const decimals = o.decimals ?? 2;
      const value = Math.random() * (max - min) + min;
      return { value: parseFloat(value.toFixed(decimals)) };
    }
    case "random_string": {
      const { length = 10, charset = "alphanumeric", custom_charset, case: caseOption = "mixed" } = o;
      let chars = "";
      if (charset === "custom" && custom_charset) chars = custom_charset;
      else if (charset === "alphanumeric") chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      else if (charset === "alphabetic") chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
      else if (charset === "numeric") chars = "0123456789";
      else if (charset === "hex") chars = "0123456789abcdef";
      if (caseOption === "lower") chars = chars.toLowerCase();
      else if (caseOption === "upper") chars = chars.toUpperCase();
      let result = "";
      for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
      return { value: result };
    }
    case "random_uuid":
    case "uuid": {
      const format = o.format ?? "standard";
      const bytes = randomBytes(16);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      let uuid = bytes.toString("hex").replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
      if (format === "compact") uuid = uuid.replace(/-/g, "");
      return { value: uuid };
    }
    case "random_boolean": {
      const probability = o.probability ?? 0.5;
      return { value: Math.random() < probability };
    }
    case "random_choice": {
      const { choices, count = 1, unique = true } = o;
      if (!Array.isArray(choices) || choices.length === 0) throw new Error("Choices array is required and must not be empty");
      const selected: any[] = [];
      const used = new Set<number>();
      const maxCount = unique ? Math.min(count, choices.length) : count;
      for (let i = 0; i < maxCount; i++) {
        let index: number;
        if (unique) {
          do index = Math.floor(Math.random() * choices.length);
          while (used.has(index));
          used.add(index);
        } else {
          index = Math.floor(Math.random() * choices.length);
        }
        selected.push(choices[index]);
      }
      return { value: count === 1 ? selected[0] : selected };
    }
    case "random_password": {
      const {
        length = 16,
        include_uppercase = true,
        include_lowercase = true,
        include_numbers = true,
        include_symbols = true,
        exclude_similar = false,
        exclude_ambiguous = false,
      } = o;
      let chars = "";
      if (include_lowercase) chars += exclude_similar ? "abcdefghjkmnpqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz";
      if (include_uppercase) chars += exclude_similar ? "ABCDEFGHJKMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      if (include_numbers) chars += exclude_similar ? "23456789" : "0123456789";
      if (include_symbols) chars += exclude_ambiguous ? "!@#$%^&*" : "!@#$%^&*()_+-=[]{}|;:,.<>?";
      if (chars.length === 0) throw new Error("At least one character set must be included");
      let password = "";
      for (let i = 0; i < length; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
      return { value: password };
    }
    case "random_hex": {
      const { length = 16, prefix = "", uppercase = false } = o;
      const hex = randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
      return { value: prefix + (uppercase ? hex.toUpperCase() : hex) };
    }
    case "random_alphanumeric": {
      const { length = 10, case: caseOption = "mixed" } = o;
      return executeRandom({ length, charset: "alphanumeric", case: caseOption }, "random_string");
    }
    case "random_date": {
      const { start_date, end_date, format } = o;
      const start = start_date ? new Date(start_date).getTime() : 0;
      const end = end_date ? new Date(end_date).getTime() : Date.now();
      const randomTime = Math.random() * (end - start) + start;
      const date = new Date(randomTime);
      const result: any = { value: date.toISOString() };
      if (format) result.formatted = date.toISOString();
      return result;
    }
    case "random_color": {
      const { format = "hex", alpha = 1 } = o;
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      if (format === "hex") return { value: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}` };
      if (format === "rgb") return { value: `rgb(${r}, ${g}, ${b})` };
      if (format === "rgba") return { value: `rgba(${r}, ${g}, ${b}, ${alpha})` };
      return { value: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}` };
    }
    case "shuffle_array": {
      const { array, in_place = false } = o;
      if (!Array.isArray(array)) throw new Error("Array is required");
      const shuffled = in_place ? array : [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return { value: shuffled };
    }
    default: {
      const bytes = randomBytes(16);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      return { value: bytes.toString("hex").replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5") };
    }
  }
}
