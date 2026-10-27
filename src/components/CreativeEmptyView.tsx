import React from 'react';
import { GoogleSignInButton } from './AccountMenu';
import type { CloudAccount } from '../hooks/useCloudAccount';

const websiteBase = `${import.meta.env.BASE_URL}${import.meta.env.DEV ? 'website/public/' : 'about/'}`;

interface CreativeEmptyViewProps {
  account: CloudAccount;
}

export const CreativeEmptyView: React.FC<CreativeEmptyViewProps> = ({ account }) => (
  <section className="mind-empty welcome-scene">
    <div className="welcome-inner">
      <div className="welcome-copy">

      <h1 className="welcome-headline">
        Your collection<br />starts here.
      </h1>
      <p className="welcome-description">Save a link, a note, or an idea for later.</p>

      {!account.user && (
        <div className="mind-empty-actions">
          <GoogleSignInButton
            onClick={() => void account.signIn()}
            disabled={account.busy || account.loading}
          />
        </div>
      )}

      {account.error && <p className="account-error" role="alert">{account.error}</p>}
      <nav className="welcome-links" aria-label="About Anything">
        <a href={websiteBase}>About Anything</a>
        <a href={`${websiteBase}privacy.html`}>Privacy Policy</a>
        <a href={`${websiteBase}terms.html`}>Terms &amp; Conditions</a>
      </nav>
      </div>
      <div className="welcome-space-art" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}welcome-moon.webp`} width="1672" height="941" alt="" decoding="async" />
      </div>
    </div>

  </section>
);
