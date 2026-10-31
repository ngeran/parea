// Demo avatars for the seeded profiles. The photo GET route only accepts keys
// shaped like the app's own uploads — photos/<uuid>.(jpg|jpeg|png|webp), see
// src/routes/photos.ts KEY_RE — so each seed profile gets a fixed, namespaced
// UUID key. The same UUIDs live in seed.sql and seed-demo.sql, which means
// re-running any of the three stays idempotent (same key, same object).
//
//   npm run db:avatars           → local .wrangler state (wrangler dev reads it)
//   npm run db:avatars:remote    → the deployed R2 bucket
//
// SVG is rendered to PNG with ImageMagick (RN's Image can't read SVG).
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 8.4:1+ text contrast on every fill (same ember the theme darkened for
// labels), admin inverted. Order mirrors seed.sql.
const PROFILES = [
  { id: "seed-maria", initial: "Μ", bg: "#FFE7DB", uuid: "5eed0001-0000-4000-8000-000000000001" },
  { id: "seed-nikos", initial: "Ν", bg: "#FFE3C2", uuid: "5eed0002-0000-4000-8000-000000000002" },
  { id: "seed-eleni", initial: "Ε", bg: "#F3E7DA", uuid: "5eed0003-0000-4000-8000-000000000003" },
  { id: "seed-dimitris", initial: "Δ", bg: "#FBE1DC", uuid: "5eed0004-0000-4000-8000-000000000004" },
  { id: "seed-sofia", initial: "Σ", bg: "#FFE7DB", uuid: "5eed0005-0000-4000-8000-000000000005" },
  { id: "seed-giorgos", initial: "Γ", bg: "#FFE3C2", uuid: "5eed0006-0000-4000-8000-000000000006" },
  { id: "seed-katerina", initial: "Κ", bg: "#F3E7DA", uuid: "5eed0007-0000-4000-8000-000000000007" },
  { id: "seed-vasilis", initial: "Β", bg: "#FBE1DC", uuid: "5eed0008-0000-4000-8000-000000000008" },
  { id: "seed-admin", initial: "Δ", bg: "#8A2F10", fg: "#FFE7DB", uuid: "5eed0009-0000-4000-8000-000000000009" },
  { id: "seed-anna", initial: "Α", bg: "#FFE7DB", uuid: "5eed000a-0000-4000-8000-00000000000a" },
];

const remote = process.argv.includes("--remote");

try {
  execFileSync("which", ["magick"]);
} catch {
  console.error("ImageMagick is required (magick) — install it and re-run.");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "parea-avatars-"));
try {
  for (const p of PROFILES) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <circle cx="256" cy="256" r="256" fill="${p.bg}"/>
  <text x="256" y="256" font-family="sans-serif" font-size="220" font-weight="700"
    fill="${p.fg ?? "#8A2F10"}" text-anchor="middle" dominant-baseline="central">${p.initial}</text>
</svg>`;
    const svgPath = join(tmp, `${p.id}.svg`);
    const pngPath = join(tmp, `${p.id}.png`);
    writeFileSync(svgPath, svg);
    execFileSync("magick", ["-background", "none", svgPath, pngPath]);

    // Key MUST match photos.ts KEY_RE: photos/<36 hex/dashes>.png
    const key = `photos/${p.uuid}.png`;
    const args = ["wrangler", "r2", "object", "put", `parea-photos/${key}`];
    if (remote) args.push("--remote");
    args.push("--file", pngPath, "--content-type", "image/png");
    execFileSync(args[0], args.slice(1), { stdio: "pipe" });
    console.log(`uploaded ${key}  (${p.id})`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(remote ? "done — remote bucket" : "done — local .wrangler state");
