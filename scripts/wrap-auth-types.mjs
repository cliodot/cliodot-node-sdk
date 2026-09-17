import fs from "fs";

const path = "src/types/auth-app.api.ts";
let src = fs.readFileSync(path, "utf8");

if (!src.includes("CliodotMethodResult")) {
  src = "import type { CliodotMethodResult } from '../http/cliodot-result';\n\n" + src;
}

src = src.replace(
  /: Promise<((?:[^<>]|<[^>]+>)+)>/g,
  ": Promise<CliodotMethodResult<$1>>"
);

fs.writeFileSync(path, src);
console.log("updated auth api types");
