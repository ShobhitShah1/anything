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
        Good finds. Yours to keep.
      </h1>
      <p className="welcome-description">Links you love. Thoughts you don’t want to lose.</p>

      <div className="mind-empty-actions">
        {!account.user && (
          <GoogleSignInButton
            onClick={() => void account.signIn()}
            disabled={account.busy || account.loading}
          />
        )}

        {account.user ? (
          <>
            <button type="button" className="mind-save-button" onClick={onOpenCapture}>
              Save your first find
            </button>
            <button type="button" className="welcome-ghost" onClick={onDirectPaste}>
              Paste a link
            </button>
          </>
        ) : (
          <button type="button" className="welcome-local" onClick={onOpenCapture}>
            Start without an account
          </button>
        )}
      </div>

      {account.error && <p className="account-error" role="alert">{account.error}</p>}
    </div>

  </section>
);
