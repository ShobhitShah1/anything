export function safeWebUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function safeEmail(value) {
  return typeof value === "string" &&
    /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) &&
    !/[\r\n]/.test(value)
    ? value
    : null;
}
export function legalReady(config) {
  return (
    config.legal?.publicationReady === true &&
    !!config.operator?.legalName?.trim() &&
    !!config.operator?.country?.trim() &&
    !!safeEmail(config.operator?.privacyEmail || config.operator?.supportEmail)
  );
}
