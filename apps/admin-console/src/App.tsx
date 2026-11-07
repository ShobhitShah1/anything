import { useEffect, useMemo, useState } from 'react';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { collectionGroup, getDocs, getFirestore, limit, query } from 'firebase/firestore';
import { Activity, ArrowLeft, Cloud, LogOut, RefreshCw, Search, Shield, Users } from 'lucide-react';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const workerUrl = import.meta.env.VITE_CLOUDFLARE_WORKER_URL?.trim() || '';
const ownerUid = '28J4d7cdG9W7az1zZu6x4O5INbp1';
const configured = !!(config.apiKey && config.authDomain && config.projectId && config.appId);
const app = configured ? (getApps().length ? getApp() : initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
type Save = {
  uid: string;
  id: string;
  kind: string;
  title: string;
  type: string;
  date: number;
  data: Record<string, unknown>;
};
type AccountStatus = {
  paid: boolean;
  used: number;
  limit: number;
  remaining: number;
  month: string;
  subscription: {
    paid: boolean;
    expiresAt: string | null;
    gracePeriodExpiresAt: string | null;
    productIdentifier: string | null;
  };
};

function signInError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/unauthorized-domain')
    return `Firebase blocked sign-in from “${window.location.hostname}”. Add this exact hostname in Firebase Console → Authentication → Settings → Authorized domains, then retry.`;
  if (code === 'auth/popup-blocked')
    return 'Allow pop-ups for this site, then try Google sign-in again.';
  return error instanceof Error ? error.message : 'Google sign-in failed.';
}

export function App() {
  const [user, setUser] = useState<User | null>(null),
    [admin, setAdmin] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [saves, setSaves] = useState<Save[]>([]),
    [search, setSearch] = useState(''),
    [selectedUid, setSelectedUid] = useState(''),
    [tab, setTab] = useState('Overview'),
    [secrets, setSecrets] = useState(false),
    [workerLoading, setWorkerLoading] = useState(false),
    [workerError, setWorkerError] = useState(''),
    [workerAccess, setWorkerAccess] = useState<{
      paid: boolean;
      used: number;
      limit: number;
      remaining: number;
      month: string;
    } | null>(null),
    [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null),
    [accountStatusLoading, setAccountStatusLoading] = useState(false),
    [accountStatusError, setAccountStatusError] = useState(''),
    [refresh, setRefresh] = useState(0);
  useEffect(
    () =>
      auth
        ? onAuthStateChanged(auth, async (u) => {
            setUser(u);
            setAdmin(false);
            setLoading(!!u);
            setError('');
            if (!u) {
              setSaves([]);
              return;
            }
            try {
              const token = await u.getIdTokenResult(true);
              if (auth?.currentUser?.uid !== u.uid) return;
              const allowed = u.uid === ownerUid && token.claims.admin === true;
              setAdmin(allowed);
              if (!allowed) setLoading(false);
            } catch (e) {
              setError((e as Error).message);
              setLoading(false);
            }
          })
        : undefined,
    [],
  );
  useEffect(() => {
    if (!user || !admin || !app) return;
    let live = true;
    getDocs(query(collectionGroup(getFirestore(app), 'collection'), limit(500)))
      .then((s) => {
        if (!live) return;
        setSaves(
          s.docs
            .map((d) => {
              const x = d.data(),
                v = (x.data || {}) as Record<string, unknown>;
              if (x.deleted === true) return null;
              return {
                uid: d.ref.path.split('/')[1] || '',
                id: String(x.id || d.id),
                kind: String(x.kind || ''),
                title: String(v.title || '(untitled)'),
                type: String(v.type || x.kind || ''),
                date: Number(v.createdAt || 0),
                data: v,
              };
            })
            .filter((save): save is Save => save !== null),
        );
      })
      .catch((e) => live && setError((e as Error).message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [user, admin, refresh]);
  const grouped = useMemo(() => {
    const byUid = new Map<string, Save[]>();
    for (const save of saves) byUid.set(save.uid, [...(byUid.get(save.uid) || []), save]);
    return [...byUid].map(([uid, records]) => ({ uid, records }));
  }, [saves]);
  const owners = grouped.length;
  const matchingGroups = grouped.filter(({ uid, records }) =>
    `${uid} ${records.map(({ title, type }) => `${title} ${type}`).join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const selectedGroup = matchingGroups.find(({ uid }) => uid === selectedUid) || matchingGroups[0];
  const safeDetails = (save: Save) =>
    Object.fromEntries(
      Object.entries(save.data).map(([key, value]) => [
        key,
        save.type === 'secret' &&
        !secrets &&
        !['id', 'title', 'type', 'category', 'createdAt'].includes(key)
          ? '••••••••'
          : /secret|password|token|private.?key|api.?key/i.test(key) && !secrets
            ? '••••••••'
            : value,
      ]),
    );
  const login = () =>
    auth && signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => setError(signInError(e)));
  const checkWorker = async () => {
    setWorkerError('');
    setWorkerAccess(null);
    if (!workerUrl) {
      setWorkerError(
        'Set VITE_CLOUDFLARE_WORKER_URL in apps/admin-console/.env.local and restart Vite.',
      );
      return;
    }
    setWorkerLoading(true);
    try {
      const endpoint = new URL(workerUrl);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password)
        throw new Error('The Worker URL must be a public HTTPS /ai endpoint.');
      if (!endpoint.pathname.endsWith('/ai'))
        endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/ai`;
      const token = await user?.getIdToken();
      if (!token) throw new Error('Sign in again to check Worker access.');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Worker returned HTTP ${response.status}.`);
      setWorkerAccess(data);
    } catch (e) {
      const message = (e as Error).message;
      setWorkerError(
        e instanceof TypeError
          ? `Browser could not reach the Worker. Allow ${window.location.origin} in ADMIN_CONSOLE_ORIGINS on the Worker, then deploy the Worker.`
          : message,
      );
    } finally {
      setWorkerLoading(false);
    }
  };
  const loadAccountStatus = async () => {
    setAccountStatusError('');
    setAccountStatus(null);
    if (!selectedGroup) {
      setAccountStatusError('Choose an account from User data first.');
      return;
    }
    setAccountStatusLoading(true);
    try {
      const endpoint = new URL(workerUrl);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password)
        throw new Error('The Worker URL must be a public HTTPS /ai endpoint.');
      if (!endpoint.pathname.endsWith('/ai'))
        endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/ai`;
      const token = await user?.getIdToken();
      if (!token) throw new Error('Sign in again to check account access.');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_status', uid: selectedGroup.uid }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Worker returned HTTP ${response.status}.`);
      setAccountStatus(data);
    } catch (e) {
      setAccountStatusError(
        e instanceof TypeError
          ? `Browser could not reach the Worker. Allow ${window.location.origin} in ADMIN_CONSOLE_ORIGINS on the Worker, then deploy the Worker.`
          : (e as Error).message,
      );
    } finally {
      setAccountStatusLoading(false);
    }
  };
  const formatBillingDate = (value: string | null) => {
    if (!value) return 'No expiry reported';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Invalid expiry from RevenueCat' : date.toLocaleString();
  };
  if (!configured)
    return (
      <div className="setup">
        <div className="wordmark">
          anything<span>.</span>
        </div>
        <small>ADMIN CONSOLE / SETUP</small>
        <h1>Connect the Firebase project</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code>, fill in the Firebase Web App
          values, then restart the console.
        </p>
        <p>
          Admin access is checked from the signed-in Firebase token. No project data loads without
          the <code>admin: true</code> claim.
        </p>
      </div>
    );
  if (!user)
    return (
      <div className="setup">
        <div className="wordmark">
          anything<span>.</span>
        </div>
        <small>ADMIN CONSOLE</small>
        <h1>Control, with care.</h1>
        <p>Sign in with the account that has the Firebase administrator claim.</p>
        <button className="primary" onClick={login}>
          Continue with Google
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  return (
    <div className="layout">
      <aside className="sidebar">
        <a className="wordmark" href="/">
          anything<span>.</span>
        </a>
        <small>OPERATIONS</small>
        {[
          ['Overview', Activity],
          ['User data', Users],
          ['Access & billing', Shield],
          ['Cloudflare', Cloud],
        ].map(([name, Icon]: any) => (
          <button
            className={tab === name ? 'selected' : ''}
            key={name}
            onClick={() => setTab(name)}
          >
            <Icon size={16} />
            {name}
          </button>
        ))}
        <div className="sidebottom">
          <span>{user.email}</span>
          <button onClick={() => auth && signOut(auth)}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <small>ANYTHING / ADMIN</small>
            <h1>{tab}</h1>
          </div>
          <span className="secure">
            <i />
            Authenticated
          </span>
        </header>
        {error && admin && (
          <section className="notice" role="alert">
            <Shield size={18} />
            <div>
              <h2>Could not load saved records</h2>
              <p>{error}</p>
            </div>
          </section>
        )}
        {!admin ? (
          <section className="notice">
            <Shield />
            <div>
              <h2>Owner access required</h2>
              <p>
                This console is restricted to the configured owner UID and requires its{' '}
                <code>admin: true</code> custom claim. User data was not queried. Set the claim with
                Firebase Admin SDK, then sign out and back in.
              </p>
            </div>
          </section>
        ) : tab === 'Overview' ? (
          <>
            <div className="metrics">
              <article>
                <small>USERS WITH SAVES</small>
                <strong>{owners}</strong>
              </article>
              <article>
                <small>RECORDS LOADED</small>
                <strong>{saves.length}</strong>
              </article>
              <article>
                <small>CONNECTION</small>
                <strong>{error ? 'Needs attention' : loading ? 'Loading' : 'Connected'}</strong>
              </article>
            </div>
            <section className="intro">
              <small>WORKSPACE HEALTH</small>
              <h2>{error ? 'Collection data did not load.' : 'Collection data loaded.'}</h2>
              <p>
                {error
                  ? 'Use the error above to check the deployed rules and Firebase project.'
                  : `${saves.length} records read directly from Firestore. The list is capped at 500 records per refresh.`}
              </p>
              <p className="footnote">
                Firebase project: <code>{config.projectId}</code>
              </p>
              <button
                className="quiet"
                onClick={() => {
                  setLoading(true);
                  setRefresh((x) => x + 1);
                }}
              >
                <RefreshCw size={14} />
                Refresh data
              </button>
            </section>
            <p className="footnote">
              Sensitive content is masked in the user data view. Admin access is powerful; use it
              only for support and operations.
            </p>
          </>
        ) : tab === 'User data' ? (
          <>
            <div className="toolbar">
              <div>
                <h2>{selectedGroup ? 'Account saves' : 'Accounts'}</h2>
                <p>
                  {matchingGroups.length} matching accounts · {saves.length} active saves
                </p>
              </div>
              <label>
                <Search size={15} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search accounts, saves or types"
                />
              </label>
              <button className="quiet" onClick={() => setSecrets(!secrets)}>
                {secrets ? 'Mask private fields' : 'Reveal private fields'}
              </button>
            </div>
            <div className="user-browser">
              <nav className="account-list" aria-label="Accounts with saved data">
                <div className="account-list-heading">ACCOUNTS</div>
                {matchingGroups.map(({ uid, records }) => (
                  <button
                    key={uid}
                    className={selectedGroup?.uid === uid ? 'account selected' : 'account'}
                    onClick={() => setSelectedUid(uid)}
                  >
                    <span className="account-uid">{uid}</span>
                    <span className="account-count">{records.length} saves</span>
                  </button>
                ))}
                {!matchingGroups.length && <p className="footnote">No matching accounts.</p>}
              </nav>
              <section className="record-list" aria-label="Selected account saves">
                {selectedGroup ? (
                  <>
                    <div className="record-heading">
                      <div>
                        {selectedUid && (
                          <button className="back-button" onClick={() => setSelectedUid('')}>
                            <ArrowLeft size={14} /> All accounts
                          </button>
                        )}
                        <h2 className="mono">{selectedGroup.uid}</h2>
                        <p>{selectedGroup.records.length} active saves in this account</p>
                      </div>
                      <span className="account-count">{selectedGroup.records.length} records</span>
                    </div>
                    <div className="records">
                      {selectedGroup.records
                        .filter(
                          (save) =>
                            !search ||
                            `${selectedGroup.uid} ${save.title} ${save.type}`
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                        )
                        .map((save) => (
                          <article className="record" key={`${save.uid}/${save.id}`}>
                            <div className="record-main">
                              <strong>{save.title || '(untitled)'}</strong>
                              <span className="record-type">{save.type || save.kind}</span>
                              <time>
                                {save.date
                                  ? new Date(save.date).toLocaleDateString()
                                  : 'Date unavailable'}
                              </time>
                            </div>
                            <details>
                              <summary>Record details</summary>
                              <pre>{JSON.stringify(safeDetails(save), null, 2)}</pre>
                            </details>
                          </article>
                        ))}
                    </div>
                  </>
                ) : loading ? (
                  <p className="footnote">Loading accounts…</p>
                ) : (
                  <p className="footnote">No saved records match this search.</p>
                )}
                {saves.length === 500 && (
                  <p className="footnote">Showing at most 500 records per refresh.</p>
                )}
              </section>
            </div>
          </>
        ) : tab === 'Access & billing' ? (
          <section className="intro">
            <small>ACCOUNT ACCESS</small>
            <h2>Account access and billing</h2>
            <p>
              Check the selected account’s current RevenueCat entitlement, expiry, and AI allowance.
              Store subscriptions remain authoritative; use RevenueCat to issue refunds or change a
              customer’s subscription.
            </p>
            <div className="account-status-toolbar">
              <div>
                <small>SELECTED ACCOUNT</small>
                <code>{selectedGroup?.uid || 'No account selected'}</code>
              </div>
              <button className="quiet" onClick={() => setTab('User data')}>
                Choose account
              </button>
              <button
                className="primary"
                disabled={!workerUrl || accountStatusLoading || !selectedGroup}
                onClick={() => void loadAccountStatus()}
              >
                {accountStatusLoading ? 'Loading…' : 'Refresh access & usage'}
              </button>
            </div>
            {accountStatusError && <p className="error">{accountStatusError}</p>}
            {accountStatus && (
              <div className="account-status">
                <div>
                  <small>PRO ACCESS</small>
                  <strong>{accountStatus.subscription.paid ? 'Active' : 'Free plan'}</strong>
                </div>
                <div>
                  <small>ENTITLEMENT</small>
                  <strong>{accountStatus.subscription.productIdentifier || '—'}</strong>
                </div>
                <div>
                  <small>EXPIRES</small>
                  <strong>{formatBillingDate(accountStatus.subscription.expiresAt)}</strong>
                </div>
                <div>
                  <small>GRACE PERIOD</small>
                  <strong>
                    {formatBillingDate(accountStatus.subscription.gracePeriodExpiresAt)}
                  </strong>
                </div>
                <div>
                  <small>AI RESPONSES</small>
                  <strong>{accountStatus.remaining} remaining</strong>
                  <span>
                    {accountStatus.used} of {accountStatus.limit} used · {accountStatus.month} UTC
                  </span>
                </div>
              </div>
            )}
            <p className="footnote">
              This screen is read-only. Pro grants, refunds, and cancellations belong in RevenueCat;
              manual quota adjustments are not available. The status comes from the protected Worker
              API and is checked against the current entitlement expiry.
            </p>
            <a
              className="quiet linkbutton"
              href="https://app.revenuecat.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open RevenueCat ↗
            </a>
          </section>
        ) : (
          <section className="intro">
            <small>SECRETS STAY SERVER SIDE</small>
            <h2>Cloudflare Worker</h2>
            <p>
              Check the Worker connection and the signed-in account’s AI allowance. Provider
              credentials remain in Cloudflare and are never sent to this console.
            </p>
            <div className="worker-check">
              <code>{workerUrl || 'Worker URL is not configured'}</code>
              <button
                className="primary"
                disabled={workerLoading}
                onClick={() => void checkWorker()}
              >
                {workerLoading ? 'Checking…' : 'Test connection'}
              </button>
            </div>
            {workerError && <p className="error">{workerError}</p>}
            {workerAccess && (
              <div className="worker-result">
                <span>Worker connected</span>
                <strong>
                  {workerAccess.remaining} / {workerAccess.limit} AI responses remaining
                </strong>
                <small>
                  {workerAccess.paid ? 'Pro allowance' : 'Free allowance'} · {workerAccess.month}
                </small>
              </div>
            )}
            <a
              className="primary linkbutton"
              href="https://dash.cloudflare.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open Cloudflare dashboard ↗
            </a>
            <p className="footnote">
              Manage or rotate Groq and RevenueCat secrets in Cloudflare → Workers &amp; Pages →
              anything-ai → Settings → Variables and Secrets. Never put a Cloudflare API token or
              provider key in a Vite variable.
            </p>
            <p className="footnote">
              For a GitHub Pages deployment, the CORS origin is <code>https://OWNER.github.io</code>{' '}
              (no repository path). Add that exact origin to <code>ADMIN_CONSOLE_ORIGINS</code>,
              deploy the Worker, and retest here.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
