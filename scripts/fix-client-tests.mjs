import fs from "fs";
import path from "path";

const testsDir = "src/__tests__";
const files = [
  "OAuthAppClient.test.ts",
  "IdentityAppClient.test.ts",
  "CommercialAppClient.test.ts",
  "Surface.test.ts",
];

for (const file of files) {
  const full = path.join(testsDir, file);
  let src = fs.readFileSync(full, "utf8");

  if (!src.includes('from "./helpers"')) {
    src = src.replace(
      /^(import .+\n)+/,
      (block) =>
        `${block}import { isCliodotFail } from "../http/cliodot-result";\nimport { assertOk } from "./helpers";\n`
    );
  }

  src = src.replace(
    /expect\(\(\) => new (\w+)\(\{[^\}]+\}\)\)\.toThrow\([\s\S]*?\);\s*/g,
    ""
  );
  src = src.replace(
    /await expect\(([^)]+)\)\.rejects\.toMatchObject\(([\s\S]*?)\);/g,
    (_, call, expected) => {
      return `const failResult = await ${call};\n    expect(isCliodotFail(failResult)).toBe(true);\n    if (isCliodotFail(failResult)) {\n      expect(failResult.error).toMatchObject(${expected.replace(/message:/g, "message:").replace(/status:/g, "status:").replace(/code:/g, "code:")});\n    }`;
    }
  );
  src = src.replace(
    /await expect\(([^)]+)\)\.rejects\.toThrow\(([^)]+)\);/g,
    (_, call, msg) =>
      `const failResult = await ${call};\n    expect(isCliodotFail(failResult)).toBe(true);\n    if (isCliodotFail(failResult)) expect(failResult.error.message).toContain(${msg});`
  );

  src = src.replace(
    /const (\w+) = await ([^;]+);\n(\s*)expect\(\1\./g,
    "const $1 = await $2;\n$3assertOk($1);\n$3expect($1."
  );

  fs.writeFileSync(full, src);
  console.log("patched", file);
}
