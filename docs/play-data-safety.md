# Google Play Data Safety form — TallyShot answers

This is your fill-in script for Play Console → App content → **Data safety**.
Every answer below maps to actual code paths. Read once, then transcribe into the form.

---

## Section 1: Data collection and security

### Does your app collect or share any of the required user data types?

> **Yes — but only "App activity" (Other user-generated content: receipt photos and details), and only via your AI extraction proxy. Nothing is stored server-side.**

### Is all of the user data collected by your app encrypted in transit?

> **Yes.** All network traffic uses HTTPS / TLS. Receipt images are sent to the Cloudflare Worker over HTTPS and forwarded to Anthropic over HTTPS.

### Do you provide a way for users to request that their data be deleted?

> **Yes.** Settings → "Delete all data" wipes the SQLite database and the receipts/ image directory. Uninstalling the app also removes everything (no server-side copy exists).

---

## Section 2: Data types collected

For each row below: tick **Collected**, choose how it's used, mark whether it's **Optional**, **Shared**, **Encrypted in transit**, and answer "Can be deleted?" (always **Yes** for us).

### Personal info

| Data type | Collected? | Reasoning |
|---|---|---|
| Name | **No** | We never ask for one |
| Email address | **No** | No accounts |
| User IDs | **No** | No accounts |
| Address | **No** | — |
| Phone number | **No** | — |
| Race & ethnicity | **No** | — |
| Political/religious beliefs | **No** | — |
| Sexual orientation | **No** | — |
| Other info | **No** | — |

### Financial info

| Data type | Collected? | Reasoning |
|---|---|---|
| User payment info | **No** | We never see card numbers |
| Purchase history | **No** | We track receipts as user-generated content (different category — see App activity) |
| Credit score | **No** | — |
| Other financial info | **No** | — |

### Health & fitness — All No

### Messages — All No

### Photos and videos

| Data type | Collected? | Used for | Optional | Shared | Encrypted | Deletable |
|---|---|---|---|---|---|---|
| **Photos** | **Yes** | App functionality (receipt scanning) | **Optional** (user can manually enter instead) | **Not shared** with third parties for their own purposes. Sent to Cloudflare/Anthropic ONLY to perform extraction; not retained by them | **Yes** (HTTPS) | **Yes** |
| Videos | **No** | — | — | — | — | — |

> **Important wording for the form:** Photos are processed by Anthropic's Claude API for the sole purpose of returning the structured receipt data. Anthropic does not use them for training. We do not log them on our Worker.

### Audio files — All No

### Files and docs — No (we don't read user docs)

### Calendar — No

### Contacts — No

### App activity

| Data type | Collected? | Used for | Optional | Shared | Encrypted | Deletable |
|---|---|---|---|---|---|---|
| **Other user-generated content** (receipt fields: merchant, date, amounts, line items, category, notes, payment method, tax-deductible flag) | **Yes** | App functionality | **Optional** (user types or AI extracts) | **Not shared** | **Yes** in transit (only sent during AI extraction) | **Yes** |
| App interactions | **No** | — | — | — | — | — |
| In-app search history | **No** | — | — | — | — | — |
| Installed apps | **No** | — | — | — | — | — |
| Other actions | **No** | — | — | — | — | — |

### Web browsing — All No

### App info and performance

| Data type | Collected? |
|---|---|
| Crash logs | **No** (no crash reporter installed yet) |
| Diagnostics | **No** |
| Other app info | **No** |

> If/when you add Sentry: change Crash logs → Yes, Diagnostics → Yes, mark as App Functionality / Analytics. Until then, **No.**

### Device or other IDs

| Data type | Collected? |
|---|---|
| Device or other IDs | **No** (we don't read advertising ID, no analytics SDK) |

---

## Section 3: Data sharing

The form asks per data type whether you "share" it (transfer to a third party).

> **Photos and "Other user-generated content"**: NOT shared. The Cloudflare Worker and Anthropic API process the data on your behalf to perform the requested function (extraction) but do not retain or use it for their own purposes. Per Google's definition this is **service-provider processing** and is **not** "sharing".

> If asked to disclose service providers in the form's free-text: list "Anthropic, PBC (AI extraction)" and "Cloudflare, Inc. (request proxy)".

---

## Section 4: Security practices

| Question | Answer |
|---|---|
| Is your data encrypted in transit? | **Yes** (HTTPS for all network calls) |
| Do you follow the Families Policy? | **No** (the app is for adults; not directed at children under 13) |
| Has your app been independently validated against a global security standard? | **No** |
| Do you provide a way for users to request data deletion? | **Yes** (in-app: Settings → Delete all data; also uninstalling) |

---

## Section 5: Final summary the form will display to users

This is what the form will show on your store listing — verify before publishing:

- ✓ This app collects: **Photos**, **Other user-generated content**
- ✓ Data is encrypted in transit
- ✓ You can request that data be deleted

---

## Notes for future updates

If you add any of these features, update the form first:
- **Sentry / crash reporting** → Crash logs + Diagnostics = Yes
- **RevenueCat / subscriptions** → "User payment info" = Yes (collected by Google Play, not by you, but disclose)
- **Cloud sync (Supabase)** → User IDs = Yes; review every section
- **Bank sync (TrueLayer)** → Financial info = Yes; full re-review
- **Push notifications** → Add to "App functionality"
- **Analytics SDK of any kind** → Most fields change; full re-review
