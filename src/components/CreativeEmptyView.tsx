import React from 'react';
import { BrandMark } from './BrandMark';
import { GoogleSignInButton } from './AccountMenu';
import type { CloudAccount } from '../hooks/useCloudAccount';

interface CreativeEmptyViewProps {
  account: CloudAccount;
  onOpenCapture: () => void;
  onDirectPaste: () => void;
}

export const CreativeEmptyView: React.FC<CreativeEmptyViewProps> = ({ account, onOpenCapture, onDirectPaste }) => (
  <section className="mind-empty">
    <div className="welcome-inner">
      <div className="mind-empty-art" aria-hidden="true"><BrandMark /></div>

      <h1 className="welcome-headline">
        Your collection<br />starts here.
      </h1>
      <p className="welcome-description">Save a link, a note, or an idea for later.</p>

      <div className="mind-empty-actions">
        <button type="button" className="mind-save-button" onClick={onOpenCapture}>
          Save your first find
        </button>
        {!account.user && (
          <GoogleSignInButton
            onClick={() => void account.signIn()}
            disabled={account.busy || account.loading}
          />
        )}

        {account.user && (
            <button type="button" className="welcome-ghost" onClick={onDirectPaste}>
              Paste a link
            </button>
        )}
      </div>

      {account.error && <p className="account-error" role="alert">{account.error}</p>}
      <nav className="welcome-links" aria-label="About Anything">
        <a href={`${import.meta.env.BASE_URL}about/`}>About Anything</a>
        <a href={`${import.meta.env.BASE_URL}about/privacy.html`}>Privacy</a>
        <a href={`${import.meta.env.BASE_URL}about/terms.html`}>Terms</a>
      </nav>
    </div>

  </section>
);
