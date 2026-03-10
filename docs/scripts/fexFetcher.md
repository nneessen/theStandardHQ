# Whole Life / Final Expense Rate Fetcher - Interactive Carrier Selection

## Interactive Script - FEX

**How it works:**

1. Fetches a sample quote to see available carriers
2. Shows you a numbered list of carriers in the console
3. You type a number to select the carrier
4. Script fetches ALL rates for that carrier only
5. Re-reads auth token on every request (survives token refresh mid-run)
6. Detects access-denied responses and pauses/retries instead of skipping
7. Supports resume after interruption with `resumeFexFetcher()`
8. Partial CSV download with `downloadPartialFexCsv()`

**What it fetches:**

- Ages: 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85
- Genders: Male, Female
- Tobacco: None, Tobacco
- Face Amounts: $10k, $15k, $20k, $25k, $30k, $35k, $40k, $45k, $50k, $100k, $150k
- Coverage Type: Level only (can be changed in CONFIG)

**Stats:**

- 528 API requests (12 ages × 2 genders × 2 tobacco × 11 faces)
- ~8-10 minutes with conservative rate limiting (600ms delays + pauses)

## How to Use

1. Navigate to: https://app.insurancetoolkits.com/fex/quoter
2. Open DevTools Console (F12)
3. Copy/paste the ENTIRE script below
4. Press Enter
5. **Wait** for the carrier list to appear
6. **Type** `selectCarrier(1)` (or 2, 3, etc.) to pick a carrier
7. Script runs automatically
8. CSV downloads when done
9. If it stops, run `resumeFexFetcher()` to continue
10. Run `downloadPartialFexCsv()` to save progress at any time

**Note:** You may see red 400 errors and "message channel closed" warnings in console - this is NORMAL. The script handles these automatically and continues running. Don't stop the script!

## Script

```javascript
// ============================================
// FINAL EXPENSE RATE FETCHER - HARDENED
// ============================================

let AVAILABLE_CARRIERS = [];
let SELECTED_CARRIER = null;

const FEX_CONFIG = {
  state: "IL",
  faceAmounts: [
    5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000,
    16000, 17000, 18000, 19000, 20000, 21000, 22000, 23000, 24000, 25000,
  ],
  ages: [
    46, 47, 48, 49, 51, 52, 53, 54, 56, 57, 58, 59, 61, 62, 63, 64, 66, 67,
    68, 69, 71, 72, 73, 74, 76, 77, 78, 79, 82, 82, 83, 84,
  ],
  genders: ["Male", "Female"],
  tobaccos: ["None", "Tobacco"],
  coverageType: "Graded/Modified", // "Level", "Graded/Modified", or "Guaranteed"
  requestDelayMs: 600,
  batchPauseEvery: 50,
  batchPauseMs: 5000,
  pauseBetweenAgeGroupsMs: 3000,
  accessDeniedPauseMs: 90000,
  maxAccessDeniedRetries: 3,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const getAccessToken = () => {
  const directKeys = [
    "accessToken",
    "itk:accessToken",
    "token:accessToken",
    "auth.accessToken",
  ];

  for (const store of [localStorage, sessionStorage]) {
    for (const key of directKeys) {
      const value = store.getItem(key);
      if (value) return value;
    }
  }

  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      const raw = key ? store.getItem(key) : null;
      if (!raw) continue;

      if (key && /token/i.test(key) && raw.split(".").length === 3) {
        return raw;
      }

      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.accessToken === "string") return parsed.accessToken;
        if (typeof parsed?.access_token === "string")
          return parsed.access_token;
      } catch {
        // Ignore non-JSON storage entries
      }
    }
  }

  return null;
};

const getTokenExpirationIso = () => {
  const token = getAccessToken();
  const decoded = decodeJwtPayload(token);
  return decoded?.exp
    ? new Date(decoded.exp * 1000).toISOString()
    : "unknown";
};

const resolveApiBase = async () => {
  if (window.__fexFetcherApiBase) return window.__fexFetcherApiBase;

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
        window.__fexFetcherApiBase = rootUrl.replace(/\/+$/, "");
        return window.__fexFetcherApiBase;
      }
    }
  } catch {
    // Fall through to hard-coded default
  }

  window.__fexFetcherApiBase = "https://api.insurancetoolkits.com";
  return window.__fexFetcherApiBase;
};

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

const parseNum = (s) => {
  if (!s) return 0;
  return parseFloat(String(s).replace(/,/g, ""));
};

const isAccessDeniedResponse = (status, body) =>
  status === 400 &&
  /do not have access to this toolkit|account is not active/i.test(
    String(body?.error || body?.rawText || ""),
  );

const csvEscape = (value) => {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const downloadCsv = (rows, filename) => {
  if (!rows.length) {
    console.warn("⚠️ No rows available to download.");
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

const requestQuote = async (payload) => {
  const token = getAccessToken();
  if (!token) {
    throw new Error(
      "No access token found. Make sure you are logged in and the page is fully loaded.",
    );
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

const buildCombinations = () => {
  const combinations = [];

  for (const sex of FEX_CONFIG.genders) {
    for (const tobacco of FEX_CONFIG.tobaccos) {
      for (const age of FEX_CONFIG.ages) {
        for (const faceAmount of FEX_CONFIG.faceAmounts) {
          combinations.push({ sex, tobacco, age, faceAmount });
        }
      }
    }
  }

  return combinations;
};

const createFreshRunState = () => ({
  startedAt: Date.now(),
  running: false,
  selectedCarrier: SELECTED_CARRIER,
  nextIndex: 0,
  total: 0,
  allQuotes: [],
  skippedCombos: [],
  lastFailure: null,
});

const resetRunState = () => {
  window.fexFetcherState = createFreshRunState();
  return window.fexFetcherState;
};

const getRunState = () => window.fexFetcherState || resetRunState();

const formatComboLabel = ({ sex, tobacco, age, faceAmount }) =>
  `${sex}/${tobacco}/age${age}/$${faceAmount.toLocaleString()}`;

window.debugFexFetcher = async () => {
  const snapshot = {
    page: window.location.href,
    apiBase: await resolveApiBase(),
    tokenFound: Boolean(getAccessToken()),
    tokenExpiresAt: getTokenExpirationIso(),
    selectedCarrier: SELECTED_CARRIER || "",
    currentRequest: getRunState().nextIndex,
    collectedQuotes: getRunState().allQuotes.length,
  };

  console.table(snapshot);
  return snapshot;
};

window.downloadPartialFexCsv = () => {
  const state = getRunState();
  const carrierSafe = (state.selectedCarrier || "unknown").replace(/\s+/g, "_");
  downloadCsv(
    state.allQuotes,
    `fex_partial_${FEX_CONFIG.state}_${carrierSafe}.csv`,
  );
};

const discoverCarriers = async () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Final Expense Rate Fetcher - Hardened");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 Fetching sample quote to discover carriers...");
  console.log(`🔐 Token expires at: ${getTokenExpirationIso()}\n`);

  try {
    const { response, body } = await requestQuote({
      faceAmount: 25000,
      coverageType: "Level",
      sex: "Male",
      state: FEX_CONFIG.state,
      age: 65,
      tobacco: "None",
      feet: "",
      inches: "",
      weight: "",
      paymentType: "Bank Draft/EFT",
      underwritingItems: [],
      toolkit: "FEX",
    });

    if (!response.ok) {
      console.error(
        `❌ Sample quote failed with HTTP ${response.status}:`,
        body?.error || body?.rawText || body,
      );
      return;
    }

    if (!body?.quotes?.length) {
      console.error("❌ No quotes returned from sample request.", body);
      return;
    }

    const carrierSet = new Set();
    body.quotes.forEach((quote) => {
      const carrier = carrierNameFromCompany(quote.company);
      if (carrier) carrierSet.add(carrier);
    });

    AVAILABLE_CARRIERS = Array.from(carrierSet).sort();

    console.log("✅ Available carriers:\n");
    AVAILABLE_CARRIERS.forEach((carrier, index) => {
      console.log(`  ${index + 1}. ${carrier}`);
    });

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("👉 To select a carrier, type:");
    console.log("   selectCarrier(1)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (error) {
    console.error("❌ Error discovering carriers:", error.message);
  }
};

const fetchAllRates = async ({ resume = false } = {}) => {
  if (!SELECTED_CARRIER) {
    console.error("❌ No carrier selected.");
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

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🎯 Carrier: ${SELECTED_CARRIER}`);
  console.log(`📍 State: ${FEX_CONFIG.state}`);
  console.log(`📦 Coverage Type: ${FEX_CONFIG.coverageType}`);
  console.log(`📈 Total Requests: ${state.total.toLocaleString()}`);
  console.log(`▶ Starting At Request: ${(state.nextIndex + 1).toLocaleString()}`);
  console.log(`🔐 Token expires at: ${getTokenExpirationIso()}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  for (let index = state.nextIndex; index < combinations.length; index++) {
    const combo = combinations[index];
    const label = formatComboLabel(combo);
    let accessDeniedAttempts = 0;

    while (true) {
      try {
        const { response, body, url } = await requestQuote({
          faceAmount: combo.faceAmount,
          coverageType: FEX_CONFIG.coverageType,
          sex: combo.sex,
          state: FEX_CONFIG.state,
          age: combo.age,
          tobacco: combo.tobacco,
          feet: "",
          inches: "",
          weight: "",
          paymentType: "Bank Draft/EFT",
          underwritingItems: [],
          toolkit: "FEX",
        });

        if (response.ok) {
          const carrierQuotes = (body?.quotes || [])
            .filter(
              (quote) =>
                carrierNameFromCompany(quote.company) === SELECTED_CARRIER ||
                String(quote.company || "").includes(SELECTED_CARRIER),
            )
            .map((quote) => ({
              face_amount: combo.faceAmount,
              company: quote.company,
              plan_name: quote.plan_name,
              tier_name: quote.tier_name,
              coverage_type: FEX_CONFIG.coverageType,
              monthly: parseNum(quote.monthly),
              yearly: parseNum(quote.yearly),
              state: FEX_CONFIG.state,
              gender: combo.sex,
              age: combo.age,
              term_years: "",
              tobacco: combo.tobacco,
            }));

          state.allQuotes.push(...carrierQuotes);
          state.nextIndex = index + 1;
          break;
        }

        if (isAccessDeniedResponse(response.status, body)) {
          accessDeniedAttempts += 1;
          state.lastFailure = {
            when: new Date().toISOString(),
            status: response.status,
            combo,
            error: body?.error || body?.rawText || null,
            url,
            tokenExpiresAt: getTokenExpirationIso(),
          };

          console.warn(`⚠️ Access-denied 400 at ${label}`);
          console.warn(body?.error || body?.rawText || body);

          if (accessDeniedAttempts > FEX_CONFIG.maxAccessDeniedRetries) {
            state.running = false;
            console.error(
              "❌ Still getting the toolkit-access 400 after retries. Stopping.",
            );
            console.log("Run debugFexFetcher() for a quick auth snapshot.");
            console.log(
              "Run downloadPartialFexCsv() to save the rows collected so far.",
            );
            window.fetchedRates = state.allQuotes;
            window.skippedCombos = state.skippedCombos;
            window.fexFetcherLastFailure = state.lastFailure;
            return state.allQuotes;
          }

          console.warn(
            `⏸️ Waiting ${Math.round(
              FEX_CONFIG.accessDeniedPauseMs / 1000,
            )} seconds, then retrying (${accessDeniedAttempts}/${FEX_CONFIG.maxAccessDeniedRetries})...`,
          );
          await sleep(FEX_CONFIG.accessDeniedPauseMs);
          continue;
        }

        if (response.status === 429) {
          console.warn(
            `⚠️ Rate limited at ${label}. Pausing 15 seconds...`,
          );
          await sleep(15000);
          continue;
        }

        if (response.status === 400) {
          state.skippedCombos.push(label);
          state.nextIndex = index + 1;
          break;
        }

        console.warn(
          `⚠️ HTTP ${response.status} at ${label}:`,
          body?.error || body?.rawText || body,
        );
        state.nextIndex = index + 1;
        break;
      } catch (error) {
        console.warn(`⚠️ Exception at ${label}: ${error.message}`);
        await sleep(FEX_CONFIG.batchPauseMs);
      }
    }

    if (!state.running) break;

    if (state.nextIndex % FEX_CONFIG.batchPauseEvery === 0) {
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

      console.log(
        `⏸️ Batch pause: ${Math.round(
          FEX_CONFIG.batchPauseMs / 1000,
        )} seconds...`,
      );
      await sleep(FEX_CONFIG.batchPauseMs);
    } else {
      await sleep(FEX_CONFIG.requestDelayMs);
    }

    const nextCombo = combinations[state.nextIndex];
    const currentCombo = combinations[index];
    if (
      nextCombo &&
      currentCombo &&
      nextCombo.age !== currentCombo.age
    ) {
      console.log(
        `✓ Completed ${currentCombo.sex} ${currentCombo.tobacco} age ${currentCombo.age}`,
      );
      await sleep(FEX_CONFIG.pauseBetweenAgeGroupsMs);
    }
  }

  state.running = false;
  window.fetchedRates = state.allQuotes;
  window.skippedCombos = state.skippedCombos;

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(
    `✅ Done! ${state.allQuotes.length} rates fetched for ${SELECTED_CARRIER}`,
  );
  console.log(
    `⚠️ Skipped ${state.skippedCombos.length} combinations that returned normal 400s.`,
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const carrierSafe = SELECTED_CARRIER.replace(/\s+/g, "_");
  const filename = `fex_${FEX_CONFIG.coverageType.toLowerCase().replace(/\//g, "_")}_${FEX_CONFIG.state}_${carrierSafe}.csv`;
  downloadCsv(state.allQuotes, filename);
  console.log(`📁 CSV downloaded: ${filename}`);

  return state.allQuotes;
};

window.selectCarrier = (number) => {
  if (!AVAILABLE_CARRIERS.length) {
    console.error("❌ No carriers available yet. Wait for discovery to finish.");
    return;
  }

  const index = number - 1;
  if (index < 0 || index >= AVAILABLE_CARRIERS.length) {
    console.error(`❌ Invalid number. Choose 1-${AVAILABLE_CARRIERS.length}.`);
    return;
  }

  SELECTED_CARRIER = AVAILABLE_CARRIERS[index];
  resetRunState();
  console.log(`\n✅ Selected: ${SELECTED_CARRIER}`);
  console.log("🚀 Starting rate fetch...\n");
  fetchAllRates({ resume: false });
};

window.resumeFexFetcher = () => {
  console.log("🔁 Resuming from the last saved request index...\n");
  return fetchAllRates({ resume: true });
};

discoverCarriers();
```

## Example Usage

After pasting the script, you'll see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Final Expense Rate Fetcher - Interactive Mode
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Fetching sample quote to discover carriers...

✅ Available Carriers:

  1. Americo
  2. Mutual of Omaha
  3. UHL
  4. Sentinel Security
  5. Foresters
  ... (etc)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 To select a carrier, type:
   selectCarrier(1)  // Replace 1 with your carrier number
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then you type in the console:

```javascript
selectCarrier(2); // Picks Mutual of Omaha
```

And it starts fetching!

## Troubleshooting

**Carrier list doesn't appear:**

- Refresh page and try again
- Check you're logged into Insurance Toolkits
- Run `debugFexFetcher()` to check token status

**Script stops mid-run:**

- Run `resumeFexFetcher()` to continue from where it left off
- Run `downloadPartialFexCsv()` to save what's been collected so far

**Can't find selectCarrier function:**

- Make sure you pasted the ENTIRE script
- Try typing `window.selectCarrier(1)` instead

**Want to start over with different carrier:**

- Refresh the page
- Paste script again
- Pick new carrier

**Rate limiting errors:**

- Script uses 600ms delays + 5s pauses every 50 requests
- If still issues, increase `requestDelayMs` in FEX_CONFIG

## What I Would Need If This Still Stops

If the script hits access-denied 400s, provide these from DevTools:

1. The output of `debugFexFetcher()`
2. One successful request from the Network tab (headers + payload + response)
3. The first failing request from the Network tab
4. Whether the normal UI quote form still works manually after the script fails
