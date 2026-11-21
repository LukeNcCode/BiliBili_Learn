const { spawn } = require("child_process");
const path = require("path");

const executable = path.resolve(
  "release-artifacts",
  "win-unpacked",
  "BiliBili Learning Version.exe",
);
const child = spawn(executable, [], {
  cwd: path.dirname(executable),
  env: {
    ...process.env,
    STUDYFLOW_CAPTURE: path.resolve("packaged-runtime.png"),
    STUDYFLOW_CAPTURE_VIEW: "creator",
    STUDYFLOW_CAPTURE_DELAY: "2000",
  },
  stdio: "inherit",
  windowsHide: true,
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  if (code !== 0) process.exitCode = code || 1;
});
