import fs from "fs";

const path = "src/types/commercial-app.api.ts";
let src = fs.readFileSync(path, "utf8");

if (!src.includes("CliodotMethodResult")) {
  src = "import type { CliodotMethodResult } from '../http/cliodot-result';\n\n" + src;
}

const start = src.indexOf("export type CommercialAppClientApi");
const end = src.indexOf("};", start) + 2;
const block = src.slice(start, end);

const updated = block.replace(
  /: Promise<((?:[^<>]|<[^>]+>)+)>/g,
  ": Promise<CliodotMethodResult<$1>>"
);

src = src.slice(0, start) + updated + src.slice(end);
fs.writeFileSync(path, src);
console.log("updated commercial api types");
