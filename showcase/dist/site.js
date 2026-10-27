import { safeWebUrl, safeEmail } from "./shared.js";
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.dataset.visible = "";
          observer.unobserve(entry.target);
        }
    },
    { threshold: 0.08 },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((node) => observer.observe(node));
  document.documentElement.classList.add("motion-ready");
}
try {
  const response = await fetch("./site-config.json");
  if (!response.ok) throw new Error("Configuration unavailable");
  const config = await response.json();
  for (const anchor of document.querySelectorAll("[data-link]")) {
    const key = anchor.dataset.link;
    const url = safeWebUrl(config.links?.[key]);
    if (!url) continue;
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.hidden = false;
    document.querySelectorAll(`[data-fallback="${key}"]`).forEach((node) => {
      node.hidden = true;
    });
  }
  if (
    safeWebUrl(config.links?.googlePlay) ||
    safeWebUrl(config.links?.appStore)
  )
    document.querySelector("#mobile-availability").hidden = true;
  const email = safeEmail(config.operator?.supportEmail);
  for (const node of document.querySelectorAll("[data-contact]"))
    if (email) {
      node.href = `mailto:${email}`;
      node.hidden = false;
    }
  for (const node of document.querySelectorAll("[data-owner]"))
    node.textContent = config.operator?.legalName || config.product.name;
  for (const node of document.querySelectorAll("[data-year]"))
    node.textContent = String(new Date().getFullYear());
} catch {
  // Keep product information and legal navigation usable when release settings cannot load.
  document.documentElement.dataset.configuration = "unavailable";
}
