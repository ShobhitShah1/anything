import { safeEmail, legalReady } from "./shared.js";
const main = document.querySelector("#legal-content");
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
try {
  const response = await fetch("./site-config.json");
  if (!response.ok) throw new Error("The policy details could not be loaded.");
  const config = await response.json();
  const pageKey = document.body.dataset.page;
  const page = config.pages?.[pageKey];
  if (!page) throw new Error("This policy is unavailable.");
  document.title = `${pageKey === "delete-account" ? "Data & deletion" : pageKey[0].toUpperCase() + pageKey.slice(1)} — ${config.product.name}`;
  main.append(
    element("p", "ANYTHING / THE PRACTICAL DETAILS", "eyebrow"),
    element("h1", page.title),
    element("p", page.subtitle, "legal-intro"),
  );
  const date = new Date(`${config.legal.effectiveDate}T00:00:00Z`);
  if (Number.isFinite(date.getTime()))
    main.append(
      element(
        "p",
        `Updated ${new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date)}`,
        "legal-meta",
      ),
    );
  if (!legalReady(config))
    main.append(
      element(
        "aside",
        "Draft for release review. Operator/contact details, retention, legal bases, transfer safeguards and account-deletion handling still need confirmation before these policies are published as final.",
        "draft-notice",
      ),
    );
  const operator = element("div", null, "operator-info");
  operator.append(
    element(
      "p",
      `Operator: ${config.operator.legalName || "Details not published yet"}`,
    ),
  );
  if (config.operator.country)
    operator.append(element("p", config.operator.country));
  if (config.operator.postalAddress)
    operator.append(element("p", config.operator.postalAddress));
  if (
    config.legal.minimumAge !== null &&
    Number.isInteger(config.legal.minimumAge) &&
    config.legal.minimumAge > 0
  )
    operator.append(
      element(
        "p",
        `Minimum age: ${config.legal.minimumAge}; additional local consent requirements may apply.`,
      ),
    );
  if (pageKey === "terms" && config.legal.disputeJurisdiction)
    operator.append(
      element(
        "p",
        `Jurisdiction: ${config.legal.disputeJurisdiction}. Mandatory local consumer rights continue to apply.`,
      ),
    );
  const contact = safeEmail(
    config.operator.privacyEmail || config.operator.supportEmail,
  );
  if (contact) {
    const anchor = element("a", contact);
    anchor.href = `mailto:${contact}`;
    operator.append(anchor);
  }
  main.append(operator);
  const sections = element("div", null, "legal-sections");
  page.sections.forEach((section, index) => {
    const details = element("details", null, "legal-section");
    details.open = index === 0;
    details.append(element("summary", section.title));
    for (const paragraph of section.paragraphs || [])
      details.append(element("p", paragraph));
    for (const key of section.settings || [])
      if (config.legal[key]) details.append(element("p", config.legal[key]));
    if (
      section.link &&
      [
        "permissions.html",
        "privacy.html",
        "terms.html",
        "delete-account.html",
      ].includes(section.link.href)
    ) {
      const link = element("a", `${section.link.label} ↗`, "text-link");
      link.href = section.link.href;
      details.append(link);
    }
    sections.append(details);
  });
  main.append(sections);
  const end = element("div", null, "legal-contact");
  if (pageKey === "delete-account") {
    if (contact && config.legal.accountDeletionRequestsEnabled === true) {
      end.append(
        element(
          "p",
          "Send an account-deletion request from the email used for your Anything account. This opens your email app; no request is submitted until you send it.",
        ),
      );
      const link = element("a", "Email an account-deletion request ↗");
      link.href = `mailto:${contact}?subject=${encodeURIComponent("Anything account and associated-data deletion request")}`;
      end.append(link);
    } else
      end.append(
        element(
          "p",
          "Account-deletion requests are not enabled here yet. The operator must configure and test the request channel before release.",
        ),
      );
  } else if (contact) {
    const link = element("a", "Contact the operator ↗");
    link.href = `mailto:${contact}`;
    end.append(link);
  }
  main.append(end);
} catch (error) {
  main.append(
    element("h1", "Let’s try that again."),
    element(
      "p",
      error instanceof Error ? error.message : "Policy details could not load.",
      "legal-intro",
    ),
  );
  const retry = element("a", "Reload policy ↗", "text-link");
  retry.href = location.href;
  main.append(retry);
}
