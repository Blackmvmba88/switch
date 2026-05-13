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
    description: "Xbox physical positions on Switch/Rock Candy: A bottom, B right, X left, Y top",
    buttons: {
      A: 1,
      B: 0,
      X: 3,
      Y: 2
    }
  },
  "switch-labels": {
    description: "Nintendo/Switch labels: A right, B bottom, X top, Y left",
    buttons: {
      A: 0,
      B: 1,
      X: 2,
      Y: 3
    }
  }
};

const layout = layouts[mode];
if (!layout) {
  console.error(`Unknown layout: ${mode}`);
  console.error(`Available: ${Object.keys(layouts).join(", ")}`);
  process.exit(1);
}

for (const file of files) {
  const profile = JSON.parse(fs.readFileSync(file, "utf8"));
  profile.semantic ||= {};
  for (const [name, index] of Object.entries(layout.buttons)) {
    profile.semantic[name] = {
      ...(profile.semantic[name] || {}),
      source: `B${index}`,
      kind: "button",
      index,
      confidence: 0.99
    };
  }
  profile.layout = `${profile.layout || "rock-candy"}:${mode}`;
  profile.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(profile, null, 2) + "\n");
  console.log(`updated ${file}`);
}

console.log(layout.description);
