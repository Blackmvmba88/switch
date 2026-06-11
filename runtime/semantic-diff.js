#!/usr/bin/env node
const fs = require("node:fs");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function bindingKey(binding) {
  if (!binding) return "missing";
  return `${binding.kind}:${binding.source}:${binding.to ?? binding.from ?? ""}`;
}

function main() {
  const leftPath = process.argv[2];
  const rightPath = process.argv[3];
  if (!leftPath || !rightPath || process.argv.includes("--help")) {
    console.log(`Usage:
  node runtime/semantic-diff.js profile-a.normalized.json profile-b.normalized.json`);
    process.exit(leftPath || rightPath ? 0 : 1);
  }

  const left = readJson(leftPath);
  const right = readJson(rightPath);
  const leftSemantic = left.semantic || {};
  const rightSemantic = right.semantic || {};
  const names = [...new Set([...Object.keys(leftSemantic), ...Object.keys(rightSemantic)])].sort();

  console.log(`Semantic diff`);
  console.log(`A: ${leftPath}`);
  console.log(`B: ${rightPath}`);
  console.log("");
  console.log(`semantic       status      A                 B`);
  console.log(`-------------  ----------  ----------------  ----------------`);

  let changed = 0;
  for (const name of names) {
    const a = leftSemantic[name];
    const b = rightSemantic[name];
    const aKey = bindingKey(a);
    const bKey = bindingKey(b);
    const status = aKey === bKey ? "same" : !a ? "added" : !b ? "removed" : "changed";
    if (status !== "same") changed += 1;
    console.log(`${name.padEnd(13)}  ${status.padEnd(10)}  ${aKey.padEnd(16)}  ${bKey.padEnd(16)}`);
  }

  console.log("");
  console.log(`Changed: ${changed}`);
  process.exit(changed > 0 ? 2 : 0);
}

main();

