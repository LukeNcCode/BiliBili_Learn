const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repository = process.env.GITHUB_REPOSITORY || "LukeNcCode/BiliBili_Learn";
const [tag, notesPath] = process.argv.slice(2);

if (!tag || !notesPath) {
  throw new Error(
    "Usage: node update-release-notes.cjs <tag> <notes-file>",
  );
}

function readGitHubToken() {
  const output = execFileSync("git", ["credential", "fill"], {
    input: [
      "protocol=https",
      "host=github.com",
      `path=${repository}.git`,
      "",
    ].join("\n"),
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const password = output
    .split(/\r?\n/)
    .find((line) => line.startsWith("password="))
    ?.slice("password=".length);
  if (!password) throw new Error("GitHub credentials are unavailable");
  return password;
}

async function main() {
  const token = readGitHubToken();
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "BiliBili-Learning-Version-release-maintenance",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const releaseResponse = await fetch(
    `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
    { headers },
  );
  if (!releaseResponse.ok) {
    throw new Error(
      `Unable to find release ${tag}: ${releaseResponse.status}`,
    );
  }
  const release = await releaseResponse.json();
  const body = fs.readFileSync(path.resolve(notesPath), "utf8");
  const updateResponse = await fetch(release.url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: `BiliBili Learning Version ${tag}`,
      body,
    }),
  });
  if (!updateResponse.ok) {
    throw new Error(`Unable to update release: ${updateResponse.status}`);
  }
  const updated = await updateResponse.json();
  console.log(updated.html_url);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
