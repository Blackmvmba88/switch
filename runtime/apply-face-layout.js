#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mode = process.argv[2] || "xbox-physical";
const files = [
  path.join(root, "profiles", "rock-candy-wired-controller-for-nintendo-switch-vendor-0e6f-product-0187.normalized.json"),
  path.join(process.env.HOME, "Library/Application Support/BlackMambaInput/profiles/rock-candy.normalized.json")
];

const layouts = {
  "xbox-physical": {
    description: "Xbox physical positions on Switch/Rock Candy: Xbox A=bottom/printed B, B=right/printed A, X=left/printed Y, Y=top/printed X",
    layoutTag: "switch-rock-candy:xbox-physical",
    buttons: {
      A: { index: 1, position: "bottom", printed: "B" },
      B: { index: 0, position: "right", printed: "A" },
      X: { index: 3, position: "left", printed: "Y" },
      Y: { index: 2, position: "top", printed: "X" }
    }
  },
  "switch-labels": {
    description: "Nintendo/Switch labels: A right, B bottom, X top, Y left",
    layoutTag: "switch-rock-candy:switch-labels",
    buttons: {
      A: { index: 0, position: "right", printed: "A" },
      B: { index: 1, position: "bottom", printed: "B" },
      X: { index: 2, position: "top", printed: "X" },
      Y: { index: 3, position: "left", printed: "Y" }
    }
  }
};

function assertUniqueButtons(profile) {
  const seen = new Map();
  for (const name of ["A", "B", "X", "Y"]) {
    const source = profile.semantic?.[name]?.source;
    if (!source) {
      throw new Error(`Missing ${name} face button binding`);
    }
    if (seen.has(source)) {
      throw new Error(`Duplicate face button binding: ${seen.get(source)} and ${name} both use ${source}`);
    }
    seen.set(source, name);
  }
}

function applyLayout(profile, layoutMode = "xbox-physical") {
  const layout = layouts[layoutMode];
  if (!layout) {
    throw new Error(`Unknown layout: ${layoutMode}. Available: ${Object.keys(layouts).join(", ")}`);
  }
  profile.semantic ||= {};
  for (const [name, binding] of Object.entries(layout.buttons)) {
    profile.semantic[name] = {
      source: `B${binding.index}`,
      kind: "button",
      index: binding.index,
      confidence: 0.99,
      position: binding.position,
      printedLabel: binding.printed,
      mappedBy: layoutMode
    };
  }
  assertUniqueButtons(profile);
  profile.layout = layout.layoutTag;
  return profile;
}

function main() {
  const layout = layouts[mode];
  if (!layout) {
    console.error(`Unknown layout: ${mode}`);
    console.error(`Available: ${Object.keys(layouts).join(", ")}`);
    process.exit(1);
  }

  for (const file of files) {
    const profile = applyLayout(JSON.parse(fs.readFileSync(file, "utf8")), mode);
    profile.updatedAt = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(profile, null, 2) + "\n");
    console.log(`updated ${file}`);
  }

  console.log(layout.description);
}

if (require.main === module) {
  main();
}

module.exports = {
  applyLayout,
  layouts
};
