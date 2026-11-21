const DEFAULT_UPDATE_REPOSITORY = "LukeNcCode/BiliBili_Learn";

function normalizeRepository(value) {
  if (!value) return "";
  const raw =
    typeof value === "string"
      ? value.trim()
      : typeof value.url === "string"
        ? value.url.trim()
        : "";
  if (!raw) return "";

  const plain = raw.match(
    /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/,
  );
  if (plain) return `${plain[1]}/${plain[2]}`;

  const url = raw.match(
    /github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/#?]|$)/i,
  );
  return url ? `${url[1]}/${url[2]}` : "";
}

module.exports = {
  DEFAULT_UPDATE_REPOSITORY,
  normalizeRepository,
};
