# Security policy

## Supported versions

Security fixes target the latest published release.

## Reporting a vulnerability

Please report vulnerabilities privately through the repository's GitHub
Security Advisory page. Do not publish exploit details before a fix is
available.

## Release requirements

- The Windows runtime is Electron 45 or newer.
- `pnpm audit --prod` must report no known vulnerabilities.
- `pnpm check` must pass.
- Release assets are produced from the tagged commit by GitHub Actions.
- Do not distribute the legacy `release/` directory. It contains development
  backups and is not a release artifact.
