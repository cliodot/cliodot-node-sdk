const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

function walk(dir, fn) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, fn);
    else if (name.endsWith('.js')) fn(full);
  }
}

const reserved = [
  'require', 'exports', 'module', '__esModule', '__createBinding', '__exportStar',
  'Object', 'defineProperty', 'enumerable', 'get', 'value', 'prototype',
  'hasOwnProperty', 'process', 'Buffer', 'global', 'console'
];

walk(distDir, (file) => {
  const code = fs.readFileSync(file, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    reservedNames: reserved,
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    transformObjectKeys: false,
    unicodeEscapeSequence: false
  });
  fs.writeFileSync(file, result.getObfuscatedCode());
});
