import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeEmail, legalReady } from './public/shared.js';

export const policyNames = {
  privacy: 'Privacy Policy',
  permissions: 'Permissions & Device Access',
  terms: 'Terms & Conditions',
  'delete-account': 'Account & Data Deletion',
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function renderLegalPage(config, key) {
  const page = config.pages[key];
  const title = policyNames[key];
  if (!page || !title) throw new Error('Unknown policy page');
  const ready = legalReady(config);
  const contact = safeEmail(config.operator.privacyEmail || config.operator.supportEmail);
  const date = new Date(`${config.legal.effectiveDate}T00:00:00Z`);
  const updated = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date) : '';
  const pageLinks = Object.entries(policyNames).map(([id, label]) => `<a href="${id}.html"${id === key ? ' aria-current="page"' : ''}>${escape(label)}</a>`).join('');
  const sections = page.sections.map((section, i) => {
    const paragraphs = [...(section.paragraphs || []), ...(section.settings || []).map(setting => config.legal[setting]).filter(Boolean)];
    const link = section.link && Object.keys(policyNames).some(id => `${id}.html` === section.link.href)
      ? `<a class="policy-crosslink" href="${section.link.href}">${escape(section.link.label)} <span aria-hidden="true">↗</span></a>` : '';
    return `<section class="legal-section" id="section-${i + 1}"><h2>${escape(section.title)}</h2>${paragraphs.map(text => `<p>${escape(text)}</p>`).join('')}${link}</section>`;
  }).join('');
  const operator = [
    `Operator: ${config.operator.legalName || 'Not yet supplied'}`,
    config.operator.country,
    config.operator.postalAddress,
    Number.isInteger(config.legal.minimumAge) && config.legal.minimumAge > 0 ? `Minimum age: ${config.legal.minimumAge}; local consent requirements may also apply.` : '',
    key === 'terms' && config.legal.disputeJurisdiction ? `Jurisdiction: ${config.legal.disputeJurisdiction}. Mandatory consumer rights continue to apply.` : '',
  ].filter(Boolean).map(text => `<p>${escape(text)}</p>`).join('');
  const email = contact ? `<a href="mailto:${escape(contact)}">${escape(contact)}</a>` : '<p>Privacy contact: not yet supplied.</p>';
  const deletion = key === 'delete-account'
    ? contact && config.legal.accountDeletionRequestsEnabled === true
      ? `<p>Send your request from the email used for your Anything account. Your email app opens; nothing is submitted until you send it.</p><a href="mailto:${escape(contact)}?subject=${encodeURIComponent('Anything account and associated-data deletion request')}">Request account and data deletion ↗</a>`
      : '<p>Account-deletion requests are not enabled yet. The operator must configure and test the request channel before this page can be used for a store release.</p>'
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  ${ready ? '' : '<meta name="robots" content="noindex" />'}
  <meta name="theme-color" content="#101011" />
  <meta name="description" content="${escape(title)} for ${escape(config.product.name)}. ${escape(page.subtitle)}" />
  <title>${escape(title)} — ${escape(config.product.name)}</title>
  <link rel="canonical" href="https://shobhitshah1.github.io/anything/about/${key}.html" />
  <link rel="icon" type="image/png" href="assets/icon.png?v=folded-a-1" />
  <link rel="stylesheet" href="site.css" />
  <link rel="stylesheet" href="legal.css?v=20261027-centered" />
</head>
<body class="legal-page">
  <a class="skip" href="#legal-content">Skip to content</a>
  <header class="site-header legal-header"><a class="wordmark" href="./"><span class="site-symbol" aria-hidden="true"></span>anything.</a><a class="header-action" href="./">Back to website <span aria-hidden="true">↗</span></a></header>
  <main class="legal-main wrap" id="legal-content">
    <header class="policy-heading"><p class="eyebrow">${escape(config.product.name)} / Legal & support</p><h1>${escape(title)}</h1><p class="legal-intro">${escape(page.subtitle)}</p>${updated ? `<p class="legal-meta">Updated ${escape(updated)}</p>` : ''}</header>
    <div class="policy-layout">
      <nav class="policy-pages" aria-label="Policy pages">${pageLinks}</nav>
      <article class="policy-body" aria-label="${escape(title)}">
        ${ready ? '' : '<aside class="draft-notice"><strong>Draft — release details pending.</strong> Operator/contact details, retention, legal bases, transfer safeguards and deletion handling need confirmation before these policies are final.</aside>'}
        <div class="operator-info">${operator}${email}</div>
        ${sections}
        ${deletion ? `<div class="legal-contact">${deletion}</div>` : ''}
      </article>
    </div>
  </main>
  <footer class="site-footer wrap"><a class="wordmark" href="./">anything.</a><nav class="legal-nav" aria-label="Legal">${pageLinks}</nav></footer>
</body>
</html>
`.replace(/^[ \t]+$/gm, '');
}

export async function renderLegalPages() {
  const root = resolve(import.meta.dirname, 'public');
  const config = JSON.parse(await readFile(resolve(root, 'site-config.json'), 'utf8'));
  for (const key of Object.keys(policyNames)) await writeFile(resolve(root, `${key}.html`), renderLegalPage(config, key));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await renderLegalPages();
  console.log('Rendered four public policy pages from site-config.json.');
}
