# Term Life Rate Fetcher v3 - Auto-Refresh

## What Changed from v2

v2 broke because:
1. `isAccessDeniedResponse()` only checked `status === 400` — the API now returns `403` with "Authentication credentials were not provided" when the JWT expires
2. The 403 fell through to a generic warning that moved on to the next request, so every remaining request also failed
3. No token refresh — the JWT expires mid-run and the script has no way to recover

v3 fixes all of this with a **multi-layered auth strategy**:

| Layer | What it does |
|-------|-------------|
| **Proactive refresh** | Checks JWT expiry before every batch; refreshes 2 min early |
| **Refresh token** | Searches storage for refresh tokens, tries common DRF endpoints |
| **Fetch interceptor** | Captures fresh tokens from the app's own background requests |
| **Auth error handling** | Catches 401, 403, AND the specific 400; retries after refresh |
| **State persistence** | Saves progress to localStorage; survives page refreshes |
| **Auto-resume** | Detects saved state on re-paste; offers instant resume |

## How to Use

1. Audit term coverage in your DB:
   `node scripts/audit-term-fetch-coverage.mjs`
2. Generate the missing request list from your DB:
   `node scripts/generate-term-fetch-targets.mjs --carrier "American Amicable" --product "Term Made Simple" > /tmp/aa-term-targets.js`
   If the product has zero `premium_matrix` rows, add `--bootstrap-empty` so the generator seeds a request grid from shared term ages/face amounts plus product metadata.
   The default grid mode is now metadata-aware. Use `--grid-mode matrix` only if you want the old behavior that checks holes inside the already-imported grid.
3. Navigate to: `https://app.insurancetoolkits.com/term/quoter`
4. Open DevTools Console (F12)
5. Paste the entire script below
6. Paste the generated `/tmp/aa-term-targets.js` block. That calls `setTermFetcherTargets(...)`.
7. Run `setTermFetcherSpeed("balanced")`
8. Run `selectConfiguredCarrier()` or `selectCarrierByName("American Amicable")`
9. If it ever stops: refresh the page, re-paste the fetcher, re-paste the same generated target block, then run `resumeTermFetcher()`
10. Run `downloadPartialTermCsv()` any time to save progress

Performance note: with DB-driven targets, the planned sleep floor now scales with the real missing combo count instead of a guessed full matrix. You can still tune pacing with `setTermFetcherSpeed("safe" | "balanced" | "fast")`.

Targeting note: the browser fetcher no longer needs a hardcoded age/face grid when you use `setTermFetcherTargets(...)`. The local generator script reads `premium_matrix`, finds incomplete request combinations, and emits the exact combo list for the fetcher to run.
Bootstrap note: empty products are a separate case. Use `--bootstrap-empty` when there are no existing rows for the product and you need a seed request grid. That will over-request some invalid combinations by design; the browser fetcher skips those with 400s.
Availability note: some term products may not exist in the Insurance Toolkits term quoter at all. The audit script separates those into a manual/non-Toolkit bucket so you do not waste time generating browser targets for the wrong source.

## Script

```javascript
// ============================================
// TERM LIFE RATE FETCHER v3 - AUTO-REFRESH
// ============================================
// Handles JWT expiration via:
// - Proactive token refresh before expiry
// - Refresh token discovery + common DRF endpoints
// - Fetch interceptor for passive token capture
// - State persistence across page refreshes
// ============================================

let AVAILABLE_CARRIERS = [];
let SELECTED_CARRIER = null;
const TERM_FETCHER_VERSION = "2026-03-10b";

const TERM_FETCHER_SPEED_PROFILES = {
  safe: {
    requestDelayMs: 900,
    batchPauseEvery: 20,
    batchPauseMs: 15000,
    pauseBetweenTermsMs: 4000,
    checkpointEvery: 20,
  },
  balanced: {
    requestDelayMs: 250,
    batchPauseEvery: 100,
    batchPauseMs: 3000,
    pauseBetweenTermsMs: 500,
    checkpointEvery: 100,
  },
  fast: {
    requestDelayMs: 100,
    batchPauseEvery: 250,
    batchPauseMs: 1000,
    pauseBetweenTermsMs: 0,
    checkpointEvery: 250,
  },
};

const TERM_FETCHER_CONFIG = {
  state: "IL",
  paymentType: "Bank Draft/EFT",
  speedProfile: "balanced",
  ...TERM_FETCHER_SPEED_PROFILES.balanced,
  authRetryPauseMs: 5000,
  maxAuthRetries: 5,
  tokenExpiryBufferMs: 120000,
  stateStorageKey: "__termFetcherState_v5_dynamic_targets",
  checkpointMinIntervalMs: 45000,
  skipBlockOnAccessDenied400: false,
  targetCombos: null,
  targetLabel: "",
  preferredCarrier: "",
  faceAmounts: [
    25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000, 65000, 70000,
    75000, 80000, 85000, 90000, 95000, 100000, 105000, 110000, 115000,
    120000, 125000, 130000, 135000, 140000, 145000, 155000, 160000, 165000,
    170000, 175000, 180000, 185000, 190000, 195000, 200000,
  ],
  ages: [
    51, 52, 53, 54, 56, 57, 58, 59, 61, 62, 63, 64, 66, 67, 68, 69, 71, 72,
    73, 74,
  ],
  genders: ["Male", "Female"],
  tobaccos: ["None", "Tobacco"],
  terms: ["10", "15", "20", "25", "30"],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeStorageKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeSex = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  throw new Error(`Unsupported sex value "${value}". Use Male/Female.`);
};

const normalizeTobacco = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "none" || normalized === "non_tobacco") return "None";
  if (normalized === "tobacco") return "Tobacco";
  throw new Error(`Unsupported tobacco value "${value}". Use None/Tobacco.`);
};

const normalizeCombo = (combo) => ({
  sex: normalizeSex(combo.sex ?? combo.gender),
  tobacco: normalizeTobacco(combo.tobacco ?? combo.tobaccoClass),
  term: String(combo.term ?? combo.termYears ?? "").trim(),
  age: Number(combo.age),
  faceAmount: Number(combo.faceAmount ?? combo.face_amount),
});

const validateCombo = (combo) =>
  combo.term &&
  Number.isFinite(combo.age) &&
  Number.isFinite(combo.faceAmount) &&
  combo.age > 0 &&
  combo.faceAmount > 0;

const applySpeedProfile = (profileName = "balanced") => {
  const profile = TERM_FETCHER_SPEED_PROFILES[profileName];
  if (!profile) {
    throw new Error(
      `Unknown speed profile "${profileName}". Use safe, balanced, or fast.`,
    );
  }

  Object.assign(TERM_FETCHER_CONFIG, profile, { speedProfile: profileName });
  return TERM_FETCHER_CONFIG;
};

const estimatePlannedSleepMs = (combinations) => {
  const totalRequests = Array.isArray(combinations) ? combinations.length : 0;
  if (!totalRequests) return 0;

  const perRequestSleepMs =
    Math.max(totalRequests - 1, 0) * TERM_FETCHER_CONFIG.requestDelayMs;
  const batchSleepMs =
    Math.floor(totalRequests / TERM_FETCHER_CONFIG.batchPauseEvery) *
    TERM_FETCHER_CONFIG.batchPauseMs;
  let termBoundaryCount = 0;
  for (let index = 1; index < combinations.length; index += 1) {
    if (combinations[index].term !== combinations[index - 1].term) {
      termBoundaryCount += 1;
    }
  }
  const termBoundarySleepMs =
    Math.max(termBoundaryCount, 0) * TERM_FETCHER_CONFIG.pauseBetweenTermsMs;

  return perRequestSleepMs + batchSleepMs + termBoundarySleepMs;
};

// ─── JWT Utilities ───────────────────────────

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const isValidJwt = (s) => typeof s === "string" && s.split(".").length === 3;

const jwtExpiryMs = (token) => {
  const decoded = decodeJwtPayload(token);
  return decoded?.exp ? decoded.exp * 1000 : null;
};

// ─── Token Management ────────────────────────

let _capturedToken = null;
let _refreshEndpoint = null;

const searchStorage = (patterns, extractors = []) => {
  for (const store of [localStorage, sessionStorage]) {
    for (const key of patterns) {
      const value = store.getItem(key);
      if (value) return value;
    }
  }

  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      const raw = key ? store.getItem(key) : null;
      if (!raw) continue;

      for (const extractor of extractors) {
        const result = extractor(key, raw);
        if (result) return result;
      }
    }
  }

  return null;
};

const getAccessToken = () => {
  if (_capturedToken) {
    const exp = jwtExpiryMs(_capturedToken);
    if (exp && exp > Date.now()) return _capturedToken;
    _capturedToken = null;
  }

  return searchStorage(
    ["accessToken", "itk:accessToken", "token:accessToken", "auth.accessToken", "access_token"],
    [
      (key, raw) => {
        if (/token/i.test(key) && isValidJwt(raw)) return raw;
        return null;
      },
      (_key, raw) => {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.accessToken === "string") return parsed.accessToken;
          if (typeof parsed?.access_token === "string") return parsed.access_token;
          if (typeof parsed?.token === "string" && isValidJwt(parsed.token)) return parsed.token;
        } catch {}
        return null;
      },
    ],
  );
};

const getRefreshToken = () =>
  searchStorage(
    ["refreshToken", "itk:refreshToken", "token:refreshToken", "auth.refreshToken", "refresh_token", "refresh"],
    [
      (key, raw) => {
        if (/refresh/i.test(key) && !/timestamp|expir/i.test(key)) return raw;
        return null;
      },
      (_key, raw) => {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.refreshToken === "string") return parsed.refreshToken;
          if (typeof parsed?.refresh_token === "string") return parsed.refresh_token;
          if (typeof parsed?.refresh === "string") return parsed.refresh;
        } catch {}
        return null;
      },
    ],
  );

const getTokenExpirationIso = () => {
  const exp = jwtExpiryMs(getAccessToken());
  return exp ? new Date(exp).toISOString() : "unknown";
};

const isTokenExpiringSoon = () => {
  const exp = jwtExpiryMs(getAccessToken());
  if (!exp) return true;
  return Date.now() + TERM_FETCHER_CONFIG.tokenExpiryBufferMs > exp;
};

const updateStoredToken = (newToken) => {
  const directKeys = ["accessToken", "itk:accessToken", "token:accessToken", "auth.accessToken", "access_token"];

  for (const store of [localStorage, sessionStorage]) {
    for (const key of directKeys) {
      if (store.getItem(key)) {
        store.setItem(key, newToken);
        return true;
      }
    }
  }

  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      const raw = key ? store.getItem(key) : null;
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.accessToken === "string") {
          parsed.accessToken = newToken;
          store.setItem(key, JSON.stringify(parsed));
          return true;
        }
        if (typeof parsed?.access_token === "string") {
          parsed.access_token = newToken;
          store.setItem(key, JSON.stringify(parsed));
          return true;
        }
      } catch {}
    }
  }

  return false;
};

// ─── Token Refresh ───────────────────────────

const resolveApiBase = async () => {
  if (window.__termFetcherApiBase) return window.__termFetcherApiBase;

  try {
    const res = await fetch("/assets/config.json", {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (res.ok) {
      const config = await res.json();
      const rootUrl =
        config?.rootUrl ??
        config?.apiRootUrl ??
        config?.apiUrl ??
        config?.generatedApiRootUrl;

      if (typeof rootUrl === "string" && rootUrl.startsWith("http")) {
        window.__termFetcherApiBase = rootUrl.replace(/\/+$/, "");
        return window.__termFetcherApiBase;
      }
    }
  } catch {}

  window.__termFetcherApiBase = "https://api.insurancetoolkits.com";
  return window.__termFetcherApiBase;
};

const tryRefreshAtEndpoint = async (endpoint, refreshToken) => {
  for (const bodyKey of ["refresh", "refresh_token"]) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ [bodyKey]: refreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        const newToken = data.access || data.accessToken || data.access_token || data.token;
        if (newToken && isValidJwt(newToken)) {
          _capturedToken = newToken;
          updateStoredToken(newToken);
          _refreshEndpoint = endpoint;
          return true;
        }
      }
    } catch {}
  }

  return false;
};

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    console.warn("  No refresh token found in storage.");
    return false;
  }

  const apiBase = await resolveApiBase();

  if (_refreshEndpoint) {
    if (await tryRefreshAtEndpoint(_refreshEndpoint, refreshToken)) {
      console.log(`  Token refreshed via cached endpoint`);
      return true;
    }
  }

  const endpoints = [
    `${apiBase}/api/token/refresh/`,
    `${apiBase}/token/refresh/`,
    `${apiBase}/auth/token/refresh/`,
    `${apiBase}/api/auth/refresh/`,
    `${apiBase}/auth/refresh/`,
    `${apiBase}/api/v1/auth/refresh/`,
    `${apiBase}/jwt/refresh/`,
    `${apiBase}/api/v1/token/refresh/`,
  ];

  for (const endpoint of endpoints) {
    if (endpoint === _refreshEndpoint) continue;
    if (await tryRefreshAtEndpoint(endpoint, refreshToken)) {
      console.log(`  Token refreshed via ${endpoint}`);
      return true;
    }
  }

  console.warn("  Could not refresh token via any known endpoint.");
  return false;
};

const ensureValidToken = async () => {
  if (!isTokenExpiringSoon()) return true;

  console.log("  Token expiring soon, attempting refresh...");

  if (await refreshAccessToken()) {
    console.log(`  New token expires at: ${getTokenExpirationIso()}`);
    return true;
  }

  if (_capturedToken) {
    const exp = jwtExpiryMs(_capturedToken);
    if (exp && exp > Date.now() + 60000) {
      console.log("  Using token captured from app");
      return true;
    }
  }

  return false;
};

// ─── Fetch Interceptor ──────────────────────

const setupFetchInterceptor = () => {
  if (window.__termFetcherInterceptorActive) return;

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (/token|auth|login|refresh/i.test(url) && !/quoter/i.test(url)) {
        const cloned = response.clone();
        const data = await cloned.json().catch(() => null);
        if (data) {
          const token = data.access || data.accessToken || data.access_token || data.token;
          if (token && isValidJwt(token)) {
            const exp = jwtExpiryMs(token);
            const currentExp = jwtExpiryMs(getAccessToken());
            if (exp && (!currentExp || exp > currentExp)) {
              _capturedToken = token;
              updateStoredToken(token);
              console.log("  Captured fresh token from app request");
            }
          }
        }
      }
    } catch {}

    try {
      const headers = args[1]?.headers;
      if (headers) {
        const authHeader = headers.Authorization || headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.slice(7);
          const exp = jwtExpiryMs(token);
          const currentExp = jwtExpiryMs(getAccessToken());
          if (exp && exp > Date.now() && (!currentExp || exp > currentExp)) {
            _capturedToken = token;
          }
        }
      }
    } catch {}

    return response;
  };

  window.__termFetcherInterceptorActive = true;
};

// ─── State Persistence ──────────────────────

const saveStateToDisk = (state, { force = false } = {}) => {
  const now = Date.now();
  const checkpointDelta = state.nextIndex - (state.lastCheckpointIndex || 0);
  const timeDelta = now - (state.lastCheckpointAt || 0);

  if (
    !force &&
    checkpointDelta < TERM_FETCHER_CONFIG.checkpointEvery &&
    timeDelta < TERM_FETCHER_CONFIG.checkpointMinIntervalMs
  ) {
    return;
  }

  try {
    const serializable = {
      selectedCarrier: state.selectedCarrier,
      nextIndex: state.nextIndex,
      total: state.total,
      allQuotes: state.allQuotes,
      skippedCombos: state.skippedCombos,
      targetCombos: TERM_FETCHER_CONFIG.targetCombos,
      targetLabel: TERM_FETCHER_CONFIG.targetLabel,
      preferredCarrier: TERM_FETCHER_CONFIG.preferredCarrier,
      stateAbbreviation: TERM_FETCHER_CONFIG.state,
      savedAt: now,
    };
    localStorage.setItem(
      TERM_FETCHER_CONFIG.stateStorageKey,
      JSON.stringify(serializable),
    );

    state.lastCheckpointAt = now;
    state.lastCheckpointIndex = state.nextIndex;
  } catch {}
};

const loadStateFromDisk = () => {
  try {
    const raw = localStorage.getItem(TERM_FETCHER_CONFIG.stateStorageKey);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (Date.now() - saved.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(TERM_FETCHER_CONFIG.stateStorageKey);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
};

const clearSavedState = () => {
  localStorage.removeItem(TERM_FETCHER_CONFIG.stateStorageKey);
};

const applySavedTargetConfig = (savedState) => {
  if (!savedState) return;

  if (savedState.stateAbbreviation) {
    TERM_FETCHER_CONFIG.state = savedState.stateAbbreviation;
  }
  if (Array.isArray(savedState.targetCombos) && savedState.targetCombos.length) {
    TERM_FETCHER_CONFIG.targetCombos = savedState.targetCombos
      .map(normalizeCombo)
      .filter(validateCombo);
  }
  if (typeof savedState.targetLabel === "string") {
    TERM_FETCHER_CONFIG.targetLabel = savedState.targetLabel;
  }
  if (typeof savedState.preferredCarrier === "string") {
    TERM_FETCHER_CONFIG.preferredCarrier = savedState.preferredCarrier;
  }
};

// ─── Request & Response Utilities ────────────

const getQuoteUrl = async () => `${await resolveApiBase()}/quoter/`;

const parseJsonSafely = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
};

const carrierNameFromCompany = (company) => {
  const match = String(company || "").match(/^([^(]+)/);
  return match ? match[1].trim() : String(company || "").trim();
};

const buildPayload = ({ faceAmount, sex, term, age, tobacco }) => ({
  faceAmount,
  sex,
  term,
  state: TERM_FETCHER_CONFIG.state,
  age,
  tobacco,
  paymentType: TERM_FETCHER_CONFIG.paymentType,
  underwritingItems: [],
  toolkit: "TERM",
});

const buildCombinations = () => {
  if (
    Array.isArray(TERM_FETCHER_CONFIG.targetCombos) &&
    TERM_FETCHER_CONFIG.targetCombos.length > 0
  ) {
    return TERM_FETCHER_CONFIG.targetCombos.map((combo) => ({ ...combo }));
  }

  const combinations = [];
  for (const sex of TERM_FETCHER_CONFIG.genders) {
    for (const tobacco of TERM_FETCHER_CONFIG.tobaccos) {
      for (const term of TERM_FETCHER_CONFIG.terms) {
        for (const age of TERM_FETCHER_CONFIG.ages) {
          for (const faceAmount of TERM_FETCHER_CONFIG.faceAmounts) {
            combinations.push({ sex, tobacco, term, age, faceAmount });
          }
        }
      }
    }
  }
  return combinations;
};

window.setTermFetcherTargets = (combos, metadata = {}) => {
  if (!Array.isArray(combos) || combos.length === 0) {
    throw new Error("setTermFetcherTargets requires a non-empty combo array.");
  }

  const normalizedCombos = combos.map(normalizeCombo).filter(validateCombo);
  if (!normalizedCombos.length) {
    throw new Error("No valid target combos were provided.");
  }

  const previousStorageKey = TERM_FETCHER_CONFIG.stateStorageKey;
  const nextStorageKey =
    metadata.stateStorageKey ||
    `__termFetcherState_${sanitizeStorageKey(
      metadata.label || metadata.carrierName || "term_targets",
    )}`;

  localStorage.removeItem(previousStorageKey);
  localStorage.removeItem(nextStorageKey);

  TERM_FETCHER_CONFIG.targetCombos = normalizedCombos;
  TERM_FETCHER_CONFIG.targetLabel = String(metadata.label || "").trim();
  TERM_FETCHER_CONFIG.preferredCarrier = String(
    metadata.carrierName || TERM_FETCHER_CONFIG.preferredCarrier || "",
  ).trim();
  TERM_FETCHER_CONFIG.state = String(
    metadata.state || TERM_FETCHER_CONFIG.state,
  ).trim().toUpperCase();
  TERM_FETCHER_CONFIG.stateStorageKey = nextStorageKey;

  window.termFetcherState = createFreshRunState();

  console.log(
    `  Loaded ${normalizedCombos.length.toLocaleString()} DB-derived target combination${normalizedCombos.length === 1 ? "" : "s"}.`,
  );
  if (TERM_FETCHER_CONFIG.targetLabel) {
    console.log(`  Target label: ${TERM_FETCHER_CONFIG.targetLabel}`);
  }
  if (TERM_FETCHER_CONFIG.preferredCarrier) {
    console.log(
      `  Preferred carrier: ${TERM_FETCHER_CONFIG.preferredCarrier}. Run selectConfiguredCarrier().`,
    );
  } else {
    console.log(
      '  Carrier not preset. Run selectCarrierByName("Carrier Name") or selectCarrier(N).',
    );
  }

  return TERM_FETCHER_CONFIG;
};

window.clearTermFetcherTargets = () => {
  TERM_FETCHER_CONFIG.targetCombos = null;
  TERM_FETCHER_CONFIG.targetLabel = "";
  TERM_FETCHER_CONFIG.preferredCarrier = "";
  resetRunState();
  console.log("  Cleared DB-derived target combos. Fallback matrix is active.");
};

const formatComboLabel = ({ sex, tobacco, term, age, faceAmount }) =>
  `${sex}/${tobacco}/${term}yr/age${age}/$${faceAmount.toLocaleString()}`;

const sameProfileWithoutFaceAmount = (left, right) =>
  left &&
  right &&
  left.sex === right.sex &&
  left.tobacco === right.tobacco &&
  left.term === right.term &&
  left.age === right.age;

const sameTermProfile = (left, right) =>
  left &&
  right &&
  left.sex === right.sex &&
  left.tobacco === right.tobacco &&
  left.term === right.term;

const getNextProfileIndex = (combinations, startIndex) => {
  const current = combinations[startIndex];
  let nextIndex = startIndex + 1;

  while (
    nextIndex < combinations.length &&
    sameProfileWithoutFaceAmount(current, combinations[nextIndex])
  ) {
    nextIndex += 1;
  }

  return nextIndex;
};

const getNextTermProfileIndex = (combinations, startIndex) => {
  const current = combinations[startIndex];
  let nextIndex = startIndex + 1;

  while (
    nextIndex < combinations.length &&
    sameTermProfile(current, combinations[nextIndex])
  ) {
    nextIndex += 1;
  }

  return nextIndex;
};

const mapQuoteRow = (quote, combo) => ({
  carrier: carrierNameFromCompany(quote.company),
  company: quote.company,
  plan_name: quote.plan_name,
  tier_name: quote.tier_name,
  monthly: Number.parseFloat(quote.monthly),
  yearly: Number.parseFloat(quote.yearly),
  face_amount: combo.faceAmount,
  state: TERM_FETCHER_CONFIG.state,
  gender: combo.sex,
  age: combo.age,
  term_years: combo.term,
  tobacco: combo.tobacco,
});

const getErrorText = (body) =>
  String(body?.error || body?.detail || body?.rawText || "");

const isAccessDenied400 = (status, body) =>
  status === 400 &&
  /do not have access to this toolkit|account is not active|credentials were not provided/i.test(
    getErrorText(body),
  );

const isAuthError = (status, body) => status === 401 || status === 403;

const requestQuote = async (payload) => {
  const token = getAccessToken();
  if (!token) {
    throw new Error("No access token found. Make sure you are logged in.");
  }

  const url = await getQuoteUrl();
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await parseJsonSafely(response);
  return { response, body, url };
};

// ─── CSV ─────────────────────────────────────

const csvEscape = (value) => {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const downloadCsv = (rows, filename) => {
  if (!rows.length) {
    console.warn("  No rows available to download.");
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ─── Run State ───────────────────────────────

const createFreshRunState = () => ({
  startedAt: Date.now(),
  running: false,
  selectedCarrier: SELECTED_CARRIER,
  nextIndex: 0,
  total: 0,
  allQuotes: [],
  skippedCombos: [],
  lastFailure: null,
  lastCheckpointAt: 0,
  lastCheckpointIndex: 0,
});

const resetRunState = () => {
  window.termFetcherState = createFreshRunState();
  clearSavedState();
  return window.termFetcherState;
};

const getRunState = () => window.termFetcherState || resetRunState();

// ─── Debug & Partial Download ────────────────

window.debugTermFetcher = async () => {
  const refreshToken = getRefreshToken();
  const combinations = buildCombinations();
  const snapshot = {
    page: window.location.href,
    apiBase: await resolveApiBase(),
    speedProfile: TERM_FETCHER_CONFIG.speedProfile,
    requestDelayMs: TERM_FETCHER_CONFIG.requestDelayMs,
    batchPauseEvery: TERM_FETCHER_CONFIG.batchPauseEvery,
    batchPauseMs: TERM_FETCHER_CONFIG.batchPauseMs,
    targetComboCount: combinations.length,
    targetLabel: TERM_FETCHER_CONFIG.targetLabel || "",
    preferredCarrier: TERM_FETCHER_CONFIG.preferredCarrier || "",
    tokenFound: Boolean(getAccessToken()),
    tokenExpiresAt: getTokenExpirationIso(),
    tokenExpiringSoon: isTokenExpiringSoon(),
    refreshTokenFound: Boolean(refreshToken),
    refreshEndpoint: _refreshEndpoint || "not discovered yet",
    interceptorActive: Boolean(window.__termFetcherInterceptorActive),
    selectedCarrier: SELECTED_CARRIER || "",
    currentRequest: getRunState().nextIndex,
    collectedQuotes: getRunState().allQuotes.length,
    savedState: Boolean(loadStateFromDisk()),
  };

  console.table(snapshot);
  return snapshot;
};

window.downloadPartialTermCsv = () => {
  const state = getRunState();
  const carrierSafe = (state.selectedCarrier || "unknown").replace(/\s+/g, "_");
  downloadCsv(
    state.allQuotes,
    `term_rates_partial_${TERM_FETCHER_CONFIG.state}_${carrierSafe}.csv`,
  );
};

window.setTermFetcherSpeed = (profileName = "balanced") => {
  const config = applySpeedProfile(profileName);
  const combinations = buildCombinations();
  const totalRequests = getRunState().total || combinations.length;
  const plannedSleepMinutes = Math.ceil(estimatePlannedSleepMs(combinations) / 60000);

  console.log(`  Speed profile set to: ${config.speedProfile}`);
  console.log(
    `  requestDelayMs=${config.requestDelayMs}, batchPauseEvery=${config.batchPauseEvery}, batchPauseMs=${config.batchPauseMs}, pauseBetweenTermsMs=${config.pauseBetweenTermsMs}`,
  );
  console.log(
    `  Planned sleep floor for ${totalRequests.toLocaleString()} requests: ~${plannedSleepMinutes}m`,
  );

  return config;
};

// ─── Main Discovery ─────────────────────────

const discoverCarriers = async () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Term Life Rate Fetcher v3 - Auto-Refresh (${TERM_FETCHER_VERSION})`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Check for saved state from previous run
  const savedState = loadStateFromDisk();
  if (savedState && savedState.nextIndex > 0) {
    applySavedTargetConfig(savedState);
    console.log(`\n  Found saved progress from a previous run!`);
    console.log(`  Carrier: ${savedState.selectedCarrier}`);
    console.log(`  Progress: ${savedState.nextIndex}/${savedState.total} (${Math.round((savedState.nextIndex / savedState.total) * 100)}%)`);
    console.log(`  Collected: ${savedState.allQuotes.length} quotes`);
    console.log(`\n  To resume: resumeTermFetcher()`);
    console.log(`  To start fresh: clearTermFetcherState()\n`);

    SELECTED_CARRIER = savedState.selectedCarrier;
    window.termFetcherState = {
      ...createFreshRunState(),
      selectedCarrier: savedState.selectedCarrier,
      nextIndex: savedState.nextIndex,
      total: savedState.total,
      allQuotes: savedState.allQuotes,
      skippedCombos: savedState.skippedCombos,
      lastCheckpointAt: savedState.savedAt || 0,
      lastCheckpointIndex: savedState.nextIndex || 0,
    };
  }

  // Set up interceptor early
  setupFetchInterceptor();

  // Avoid probing guessed refresh endpoints on paste. Those 404/401 responses
  // are noisy in DevTools and provide little value until a refresh is needed.
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    console.log("  Refresh token found - auto-refresh enabled when needed");
  } else {
    console.log("  No refresh token found - will rely on interceptor + manual resume");
  }

  console.log(`  Token expires at: ${getTokenExpirationIso()}`);
  if (TERM_FETCHER_CONFIG.targetLabel) {
    console.log(`  Target set: ${TERM_FETCHER_CONFIG.targetLabel}`);
  }
  if (TERM_FETCHER_CONFIG.preferredCarrier) {
    console.log(`  Preferred carrier: ${TERM_FETCHER_CONFIG.preferredCarrier}`);
  }
  console.log("  Fetching one live sample quote to discover carriers for this session...\n");

  try {
    const sampleCombo = buildCombinations()[0] || {
      faceAmount: 170000,
      sex: "Male",
      term: "10",
      age: 25,
      tobacco: "None",
    };
    const { response, body } = await requestQuote(
      buildPayload(sampleCombo),
    );

    if (!response.ok) {
      console.error(
        `  Sample quote failed with HTTP ${response.status}:`,
        body?.error || body?.detail || body?.rawText || body,
      );
      return;
    }

    if (!body?.quotes?.length) {
      console.error("  No quotes returned from sample request.", body);
      return;
    }

    const carrierSet = new Set();
    body.quotes.forEach((quote) => {
      const carrier = carrierNameFromCompany(quote.company);
      if (carrier) carrierSet.add(carrier);
    });

    AVAILABLE_CARRIERS = Array.from(carrierSet).sort();

    console.log("  Carriers returned by this live sample quote:\n");
    AVAILABLE_CARRIERS.forEach((carrier, index) => {
      console.log(`  ${index + 1}. ${carrier}`);
    });
    console.log(
      "\n  Note: this is not a full database list. It only reflects carriers returned by one live Insurance Toolkits quote in your current session.",
    );

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (savedState && savedState.nextIndex > 0) {
      console.log("  To resume previous run: resumeTermFetcher()");
      console.log("  To pick a new carrier:  selectCarrier(N)");
    } else {
      console.log("  To select a carrier: selectCarrier(1)");
    }
    if (TERM_FETCHER_CONFIG.preferredCarrier) {
      console.log(
        `  To use the configured carrier: selectConfiguredCarrier()`,
      );
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (error) {
    console.error("  Error discovering carriers:", error.message);
  }
};

// ─── Main Fetch Loop ─────────────────────────

const fetchAllRates = async ({ resume = false } = {}) => {
  if (!SELECTED_CARRIER) {
    console.error("  No carrier selected.");
    return [];
  }

  const combinations = buildCombinations();
  let state = getRunState();

  if (!resume || state.selectedCarrier !== SELECTED_CARRIER) {
    state = resetRunState();
  }

  state.selectedCarrier = SELECTED_CARRIER;
  state.total = combinations.length;
  state.running = true;

  const plannedSleepMinutes = Math.ceil(estimatePlannedSleepMs(combinations) / 60000);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Carrier: ${SELECTED_CARRIER}`);
  console.log(`  State: ${TERM_FETCHER_CONFIG.state}`);
  console.log(`  Total Requests: ${state.total.toLocaleString()}`);
  if (TERM_FETCHER_CONFIG.targetLabel) {
    console.log(`  Target set: ${TERM_FETCHER_CONFIG.targetLabel}`);
  }
  console.log(`  Speed profile: ${TERM_FETCHER_CONFIG.speedProfile}`);
  console.log(`  Planned sleep floor: ~${plannedSleepMinutes}m`);
  console.log(`  Starting At: ${(state.nextIndex + 1).toLocaleString()}`);
  console.log(`  Token expires at: ${getTokenExpirationIso()}`);
  console.log(`  Refresh token: ${getRefreshToken() ? "found" : "not found"}`);
  console.log(`  Refresh endpoint: ${_refreshEndpoint || "on-demand"}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  for (
    let index = state.nextIndex;
    index < combinations.length;
    index = state.nextIndex
  ) {
    const combo = combinations[index];
    const label = formatComboLabel(combo);
    let authRetries = 0;

    while (true) {
      // ── Proactive token check before each request ──
      if (isTokenExpiringSoon()) {
        console.log("  Token expiring soon, refreshing proactively...");
        const refreshed = await ensureValidToken();
        if (!refreshed) {
          // Token refresh failed — save state and pause
          state.running = false;
          saveStateToDisk(state, { force: true });
          console.warn("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.warn("  TOKEN EXPIRED - Could not auto-refresh");
          console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.warn("  State saved. To continue:");
          console.warn("  1. Click around in the app (triggers token refresh)");
          console.warn("  2. Run: resumeTermFetcher()");
          console.warn("  OR: Refresh the page, re-paste script, run: resumeTermFetcher()");
          console.warn(`  Progress: ${state.nextIndex}/${state.total} | Collected: ${state.allQuotes.length}`);
          console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
          window.fetchedRates = state.allQuotes;
          window.skippedCombos = state.skippedCombos;
          return state.allQuotes;
        }
      }

      try {
        const { response, body, url } = await requestQuote(buildPayload(combo));

        if (response.ok) {
          const carrierQuotes = (body?.quotes || [])
            .filter(
              (quote) =>
                carrierNameFromCompany(quote.company) === SELECTED_CARRIER ||
                String(quote.company || "").includes(SELECTED_CARRIER),
            )
            .map((quote) => mapQuoteRow(quote, combo));

          state.allQuotes.push(...carrierQuotes);
          state.nextIndex = index + 1;
          break;
        }

        // ── Auth error (401, 403, or access-denied 400) ──
        if (isAuthError(response.status, body)) {
          authRetries += 1;
          state.lastFailure = {
            when: new Date().toISOString(),
            status: response.status,
            combo,
            error: getErrorText(body) || null,
            url,
            tokenExpiresAt: getTokenExpirationIso(),
          };

          console.warn(`  Auth error (HTTP ${response.status}) at ${label}`);
          console.warn(`  ${getErrorText(body) || "No error message"}`);

          if (authRetries > TERM_FETCHER_CONFIG.maxAuthRetries) {
            state.running = false;
            saveStateToDisk(state, { force: true });
            console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.error("  AUTH FAILED after all retries. State saved.");
            console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.error("  Refresh the page, re-paste script, run: resumeTermFetcher()");
            console.error(`  Progress: ${state.nextIndex}/${state.total} | Collected: ${state.allQuotes.length}`);
            window.fetchedRates = state.allQuotes;
            window.skippedCombos = state.skippedCombos;
            window.termFetcherLastFailure = state.lastFailure;
            return state.allQuotes;
          }

          // Attempt token refresh
          console.log(`  Attempting token refresh (${authRetries}/${TERM_FETCHER_CONFIG.maxAuthRetries})...`);
          const refreshed = await ensureValidToken();

          if (refreshed) {
            console.log("  Token refreshed, retrying request...");
            await sleep(TERM_FETCHER_CONFIG.authRetryPauseMs);
            continue;
          }

          // Refresh failed — wait and hope interceptor captures a token
          console.warn(`  Refresh failed. Waiting ${Math.round(TERM_FETCHER_CONFIG.authRetryPauseMs / 1000)}s before retry...`);
          await sleep(TERM_FETCHER_CONFIG.authRetryPauseMs * 3);
          continue;
        }

        if (isAccessDenied400(response.status, body)) {
          const errorText = getErrorText(body);
          if (TERM_FETCHER_CONFIG.skipBlockOnAccessDenied400) {
            const previousCombo = combinations[index - 1];
            const atStartOfAgeBlock = !sameProfileWithoutFaceAmount(previousCombo, combo);
            const nextIndex = atStartOfAgeBlock
              ? getNextTermProfileIndex(combinations, index)
              : getNextProfileIndex(combinations, index);
            const skippedCount = nextIndex - index;

            console.warn(
              atStartOfAgeBlock
                ? `  Access-denied 400 at ${label}; skipping ${skippedCount} combination${skippedCount === 1 ? "" : "s"} from this age onward for the current gender/tobacco/term.`
                : `  Access-denied 400 at ${label}; skipping ${skippedCount} combination${skippedCount === 1 ? "" : "s"} in this age/profile block.`,
            );
            if (errorText) {
              console.warn(`  ${errorText}`);
            }
            for (let skipIndex = index; skipIndex < nextIndex; skipIndex += 1) {
              state.skippedCombos.push(formatComboLabel(combinations[skipIndex]));
            }
            state.nextIndex = nextIndex;
          } else {
            console.warn(
              `  Access-denied 400 at ${label}; skipping only this combination.`,
            );
            if (errorText) {
              console.warn(`  ${errorText}`);
            }
            state.skippedCombos.push(label);
            state.nextIndex = index + 1;
          }
          break;
        }

        // ── Rate limit ──
        if (response.status === 429) {
          console.warn(`  Rate limited at ${label}. Pausing ${Math.round(TERM_FETCHER_CONFIG.batchPauseMs / 1000)}s...`);
          await sleep(TERM_FETCHER_CONFIG.batchPauseMs);
          continue;
        }

        // ── Normal 400 (invalid combination) ──
        if (response.status === 400) {
          state.skippedCombos.push(label);
          state.nextIndex = index + 1;
          break;
        }

        // ── Other errors ──
        console.warn(`  HTTP ${response.status} at ${label}:`, body?.error || body?.rawText || body);
        state.nextIndex = index + 1;
        break;
      } catch (error) {
        console.warn(`  Exception at ${label}: ${error.message}`);
        await sleep(TERM_FETCHER_CONFIG.batchPauseMs);
      }
    }

    if (!state.running) break;

    // ── Batch pause + progress ──
    if (state.nextIndex % TERM_FETCHER_CONFIG.batchPauseEvery === 0) {
      const elapsedSeconds = (Date.now() - state.startedAt) / 1000;
      const requestsPerSecond = state.nextIndex / Math.max(elapsedSeconds, 1);
      const remainingSeconds =
        (state.total - state.nextIndex) / Math.max(requestsPerSecond, 0.001);

      console.log(
        `Progress: ${state.nextIndex}/${state.total} (${Math.round(
          (state.nextIndex / state.total) * 100,
        )}%) | Collected: ${state.allQuotes.length} | Skipped: ${state.skippedCombos.length} | ETA: ${Math.ceil(
          remainingSeconds / 60,
        )}m`,
      );

      // Save state to disk every batch
      saveStateToDisk(state);

      console.log(
        `  Batch pause: ${Math.round(TERM_FETCHER_CONFIG.batchPauseMs / 1000)}s...`,
      );
      await sleep(TERM_FETCHER_CONFIG.batchPauseMs);
    } else {
      await sleep(TERM_FETCHER_CONFIG.requestDelayMs);
    }

    // ── Term boundary pause ──
    const nextCombo = combinations[state.nextIndex];
    const currentCombo = combinations[index];
    if (nextCombo && currentCombo && nextCombo.term !== currentCombo.term) {
      console.log(
        `  Completed ${currentCombo.sex} ${currentCombo.tobacco} ${currentCombo.term}yr`,
      );
      await sleep(TERM_FETCHER_CONFIG.pauseBetweenTermsMs);
    }
  }

  state.running = false;
  clearSavedState();
  window.fetchedRates = state.allQuotes;
  window.skippedCombos = state.skippedCombos;

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Done! ${state.allQuotes.length} rates fetched for ${SELECTED_CARRIER}`);
  console.log(`  Skipped ${state.skippedCombos.length} invalid combinations.`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const carrierSafe = SELECTED_CARRIER.replace(/\s+/g, "_");
  const filename = `term_rates_${TERM_FETCHER_CONFIG.state}_${carrierSafe}.csv`;
  downloadCsv(state.allQuotes, filename);
  console.log(`  CSV downloaded: ${filename}`);

  return state.allQuotes;
};

// ─── Public API ──────────────────────────────

window.selectCarrier = (number) => {
  if (!AVAILABLE_CARRIERS.length) {
    console.error("  No carriers available yet. Wait for discovery to finish.");
    return;
  }

  const index = number - 1;
  if (index < 0 || index >= AVAILABLE_CARRIERS.length) {
    console.error(`  Invalid number. Choose 1-${AVAILABLE_CARRIERS.length}.`);
    return;
  }

  SELECTED_CARRIER = AVAILABLE_CARRIERS[index];
  resetRunState();
  console.log(`\n  Selected: ${SELECTED_CARRIER}`);
  console.log("  Starting rate fetch...\n");
  fetchAllRates({ resume: false });
};

window.selectCarrierByName = (carrierName) => {
  const normalizedName = String(carrierName || "").trim();
  if (!normalizedName) {
    console.error("  selectCarrierByName requires a carrier name.");
    return;
  }

  SELECTED_CARRIER = normalizedName;
  resetRunState();
  console.log(`\n  Selected: ${SELECTED_CARRIER}`);
  console.log("  Starting rate fetch...\n");
  return fetchAllRates({ resume: false });
};

window.selectConfiguredCarrier = () => {
  if (!TERM_FETCHER_CONFIG.preferredCarrier) {
    console.error("  No preferred carrier is configured in the active target set.");
    return;
  }

  return window.selectCarrierByName(TERM_FETCHER_CONFIG.preferredCarrier);
};

window.resumeTermFetcher = () => {
  // Try to restore from localStorage if no in-memory state
  const state = getRunState();
  if (state.nextIndex === 0) {
    const saved = loadStateFromDisk();
    if (saved) {
      applySavedTargetConfig(saved);
      SELECTED_CARRIER = saved.selectedCarrier;
      window.termFetcherState = {
        ...createFreshRunState(),
        selectedCarrier: saved.selectedCarrier,
        nextIndex: saved.nextIndex,
        total: saved.total,
        allQuotes: saved.allQuotes,
        skippedCombos: saved.skippedCombos,
        lastCheckpointAt: saved.savedAt || 0,
        lastCheckpointIndex: saved.nextIndex || 0,
      };
      console.log(`  Restored state from localStorage: ${saved.nextIndex}/${saved.total}`);
    }
  }

  console.log("  Resuming from the last saved request index...\n");
  return fetchAllRates({ resume: true });
};

window.clearTermFetcherState = () => {
  clearSavedState();
  resetRunState();
  console.log("  Saved state cleared. Ready for a fresh run.");
};

// ─── Start ───────────────────────────────────
discoverCarriers();
```

## Recovery Flow

If the script ever stops due to an auth error:

**Option A — Quick resume (if console is still open):**
1. Click around in the InsuranceToolkits app (triggers the app's own token refresh)
2. Run `resumeTermFetcher()` in the console

**Option B — After page refresh:**
1. Refresh the page
2. Re-paste the script
3. It will detect saved state and show: "Found saved progress from a previous run!"
4. Run `resumeTermFetcher()`

**Option C — Start over:**
1. Run `clearTermFetcherState()` or just `selectCarrier(N)` again

## Debugging

```javascript
debugTermFetcher()   // Shows token status, refresh capability, progress
downloadPartialTermCsv()  // Save collected rows at any time
```

## How the Token Refresh Works

The script tries multiple strategies in order:

1. **Proactive check** — Before every request, checks if the JWT `exp` claim is within 2 minutes of now
2. **Refresh token** — Searches localStorage/sessionStorage for a refresh token, then tries common Django REST Framework refresh endpoints (`/api/token/refresh/`, `/token/refresh/`, etc.)
3. **Fetch interceptor** — Monkey-patches `window.fetch` to passively capture fresh tokens from any auth-related requests the app makes in the background
4. **Auth error retry** — If a 401/403 comes back, attempts refresh and retries up to 5 times
5. **Graceful pause** — If all refresh attempts fail, saves state to localStorage and stops with clear resume instructions
