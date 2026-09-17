import fs from "fs";

const path = "src/CommercialAppClient.ts";
let src = fs.readFileSync(path, "utf8");
src = src.replace(/\)\s*:\s*Promise<[\s\S]*?>\s*\{/g, ") {");
src = src.replace(
  /throw new CliodotApiError\(([\s\S]*?)\);/g,
  "return Promise.resolve(cliodotValidationFail($1));"
);
fs.writeFileSync(path, src);
console.log("fixed commercial");
