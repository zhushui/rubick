const fs = require("fs");
const https = require("https");
const { execFileSync } = require("child_process");

function run(command, args) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryRun(command, args) {
  try {
    return run(command, args);
  } catch {
    return "";
  }
}

function resolveGitCommand() {
  if (process.platform !== "win32") {
    return "git";
  }

  const candidates = tryRun("where", ["git"])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return candidates[0] || "git";
}

const gitCommand = resolveGitCommand();

function tagExists(tagName) {
  return Boolean(tryRun(gitCommand, ["rev-parse", "-q", "--verify", `refs/tags/${tagName}`]));
}

function resolveCommitRef(refName) {
  return tryRun(gitCommand, ["rev-parse", `${refName}^{commit}`]);
}

function parseCommitSubjects(commitsRaw) {
  return commitsRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function requestJson(url, token) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: token ? `Bearer ${token}` : undefined,
          "User-Agent": "rubick-release-notes",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (error) {
              reject(error);
            }
            return;
          }

          reject(
            new Error(
              `GitHub compare API request failed with status ${response.statusCode || "unknown"}: ${body}`,
            ),
          );
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

async function resolveCompareCommits(repo, previousTag, currentTag) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  if (!repo || !previousTag || !currentTag || !token) {
    return [];
  }

  const compareUrl = `https://api.github.com/repos/${repo}/compare/${encodeURIComponent(previousTag)}...${encodeURIComponent(currentTag)}`;

  try {
    const payload = await requestJson(compareUrl, token);
    return (payload.commits || [])
      .map((commit) => commit?.commit?.message?.split(/\r?\n/, 1)[0]?.trim() || "")
      .filter(Boolean);
  } catch (error) {
    console.warn(`[generate-release-notes] ${error.message}`);
    return [];
  }
}

function resolveBaselineTag(currentTag) {
  const forkBaseMatch = currentTag.match(/^(v\d+\.\d+\.\d+)-vite\.1$/);
  if (forkBaseMatch) {
    const baselineTag = forkBaseMatch[1];
    if (!tagExists(baselineTag)) {
      throw new Error(
        `Missing baseline tag ${baselineTag}. Push this tag to the fork before publishing ${currentTag}.`,
      );
    }

    return baselineTag;
  }

  return tryRun(gitCommand, ["describe", "--tags", "--abbrev=0", `${currentTag}^`]);
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY || "zhushui/rubick";
  const tag = process.env.RELEASE_TAG;

  if (!tag) {
    throw new Error("RELEASE_TAG is required.");
  }

  const previousTag = resolveBaselineTag(tag);
  const previousCommit = previousTag ? resolveCommitRef(previousTag) : "";
  const targetCommit = resolveCommitRef(tag) || resolveCommitRef("HEAD");
  const range = previousCommit && targetCommit ? `${previousCommit}..${targetCommit}` : targetCommit || tag;
  const compareCommits = await resolveCompareCommits(repo, previousTag, tag);
  const gitCommits = parseCommitSubjects(tryRun(gitCommand, ["log", range, "--no-merges", "--format=%s"]));
  const commits = compareCommits.length > 0 ? compareCommits : gitCommits;

  const lines = [];
  lines.push("## \u66f4\u65b0\u6458\u8981");
  lines.push("");

  if (previousTag) {
    lines.push(`- \u672c\u6b21\u66f4\u65b0\u8303\u56f4\u57fa\u4e8e ${previousTag} \u81f3 ${tag}\u3002`);
    lines.push("");
  }

  if (commits.length === 0) {
    lines.push("- \u672c\u6b21\u53d1\u5e03\u672a\u68c0\u6d4b\u5230\u65b0\u7684\u63d0\u4ea4\u6458\u8981\u3002");
  } else {
    for (const subject of commits) {
      lines.push(`- ${subject}`);
    }
  }

  lines.push("");
  lines.push("## \u53d1\u5e03\u8bf4\u660e");
  lines.push("");
  lines.push("- \u53d1\u5e03\u8d44\u6e90\u7531 GitHub Actions \u81ea\u52a8\u6784\u5efa\u5e76\u4e0a\u4f20\u3002");
  lines.push("- \u5982\u9700\u67e5\u770b\u5b8c\u6574\u4ee3\u7801\u5dee\u5f02\uff0c\u53ef\u4f7f\u7528\u4e0b\u65b9\u6bd4\u8f83\u94fe\u63a5\u3002");
  lines.push("");

  if (previousTag) {
    lines.push(`**\u5b8c\u6574\u66f4\u65b0\u65e5\u5fd7**: https://github.com/${repo}/compare/${previousTag}...${tag}`);
  } else {
    lines.push(`**\u5b8c\u6574\u66f4\u65b0\u65e5\u5fd7**: https://github.com/${repo}/commits/${tag}`);
  }

  lines.push("");

  fs.writeFileSync("release-notes.generated.md", `${lines.join("\n")}\n`, "utf8");
  console.log(`[generate-release-notes] Generated release-notes.generated.md for ${tag}`);
}

main().catch((error) => {
  console.error(`[generate-release-notes] ${error.message}`);
  process.exitCode = 1;
});
