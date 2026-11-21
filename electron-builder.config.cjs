const updateRepository =
  process.env.BILIBILI_LEARNING_UPDATE_REPOSITORY ||
  process.env.GITHUB_REPOSITORY ||
  "";

const [updateOwner, updateRepo] = updateRepository.split("/");
const hasUpdateRepository = Boolean(updateOwner && updateRepo);

module.exports = {
  appId: "app.bilibili.learning.version",
  productName: "BiliBili Learning Version",
  asar: true,
  directories: {
    output: "release-artifacts",
    buildResources: "build",
  },
  files: [
    "dist/**/*",
    "electron/**/*",
    "package.json",
    "MODEL-NOTICE.md",
  ],
  extraMetadata: {
    ...(hasUpdateRepository ? { updateRepository } : {}),
  },
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    artifactName: "BiliBili-Learning-Version-${version}-${arch}.${ext}",
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    differentialPackage: true,
  },
  publish: hasUpdateRepository
    ? [
        {
          provider: "github",
          owner: updateOwner,
          repo: updateRepo,
          releaseType: "release",
        },
      ]
    : undefined,
};
