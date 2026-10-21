import { useId } from 'react';
import { Cloud, CloudOff, LogOut, UserRound, X, RefreshCw, Loader2, ChevronDown, Check } from 'lucide-react';
import type { CloudAccount } from '../hooks/useCloudAccount';

export function GoogleSignInButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="google-sign-in" onClick={onClick} disabled={disabled}>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.86 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59a14.41 14.41 0 0 1 0-9.18l-7.98-6.19a23.99 23.99 0 0 0 0 21.56l7.98-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>
    <span>Continue with Google</span>{disabled && <Loader2 className="account-spinner" aria-hidden="true" />}
  </button>;
}

export function AccountMenu({ account }: { account: CloudAccount }) {
  const id = useId();
  const status = account.status === 'synced' ? 'All changes synced' : account.status === 'syncing' ? 'Saving to your account…' : account.status === 'connecting' ? 'Connecting to your collection…' : account.status === 'error' ? 'Sync needs attention' : 'Saved on this device';
  const name = account.user?.displayName || account.user?.email || 'Your account';
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const avatar = <span className="account-avatar"><span>{account.user ? initials : <UserRound aria-hidden="true" />}</span>{account.user?.photoURL && <img src={account.user.photoURL} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} />}</span>;
  return <div className="account-control">
    <button type="button" className={`account-trigger ${account.user ? 'has-profile' : ''}`} popoverTarget={id} aria-label={account.user ? `Account: ${account.user.displayName || account.user.email}` : 'Sign in'} title={account.user?.email || 'Sign in to Anything'}>
      {account.user ? <>{avatar}<ChevronDown className="account-chevron" aria-hidden="true" /></> : <><UserRound aria-hidden="true" /><span>Sign in</span></>}
    </button>
    <div id={id} popover="auto" className="account-panel">
      <div className="account-panel-heading"><span>{account.user ? 'Account' : 'Welcome to Anything'}</span><button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="Close account"><X /></button></div>
      {account.user ? <>
        <div className="account-identity">{avatar}<div><strong>{name}</strong><span>{account.user.email}</span></div></div>
        <div className="account-sync-section">
          <label className="account-sync settings-clipboard">{account.enabled ? <Cloud aria-hidden="true" /> : <CloudOff aria-hidden="true" />}<span><strong>Cloud sync</strong><small>Sync your saves, folders, and secrets</small></span><input type="checkbox" role="switch" aria-label="Cloud sync" checked={account.enabled} onChange={account.toggleSync} /></label>
          <p className={`account-sync-status ${account.status === 'synced' ? 'is-synced' : ''}`} role="status">{account.status === 'synced' ? <Check /> : account.enabled ? <Cloud /> : <CloudOff />}{status}</p>
          {account.status === 'error' && <button type="button" className="account-retry" onClick={account.retry}><RefreshCw />Retry sync</button>}
        </div>
        <details className="account-privacy"><summary>About your data</summary><p>Enabling sync merges this collection with your Google account. Signing out keeps a local copy in this browser. Secret fields are not end-to-end encrypted.</p></details>
        <button type="button" className="account-sign-out" onClick={() => void account.signOut()} disabled={account.busy}><LogOut />Sign out<span>Keep local saves</span></button>
      </> : <>
        <div className="account-intro"><Cloud /><p>Sign in with Google, then choose whether to sync your collection across devices.</p></div>
        <GoogleSignInButton onClick={() => void account.signIn()} disabled={account.busy || account.loading} />
        <p className="account-note">An account is optional. You can always keep saving on this device.</p>
        {!account.configured && <p className="account-setup-note">Google connection is awaiting setup.</p>}
      </>}
      {account.error && <p className="account-error" role="alert">{account.error}</p>}
    </div>
  </div>;
}
