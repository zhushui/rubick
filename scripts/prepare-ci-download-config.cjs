const fs = require("fs");
const path = require("path");

if (process.env.GITHUB_ACTIONS !== "true") {
  console.log("[prepare-ci-download-config] Skipped outside GitHub Actions.");
  process.exit(0);
}

const npmrcPath = path.join(process.cwd(), ".npmrc");
const content = "# GitHub Actions uses official upstream download sources.\n";

fs.writeFileSync(npmrcPath, content, "utf8");
console.log(`[prepare-ci-download-config] Wrote ${npmrcPath}`);
