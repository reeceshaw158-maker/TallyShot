# Privacy Policy — TallyShot

**Effective date:** TBD (set on launch day)
**Last updated:** TBD
**Contact:** privacy@tallyshot.app *(replace with your actual email before publishing)*

This is the privacy policy for **TallyShot**, an Android app published by **[Your Name / Company]** that scans receipts and tracks expenses on your device.

This policy is written to reflect what TallyShot actually does, not boilerplate. If anything below stops being true, we will update this page and bump the "Last updated" date.

---

## 1. What we collect

**TallyShot does not require an account.** You do not give us an email, password, name, or phone number to use the app.

The app stores the following data **on your device only**:

- Receipt photos you take or import
- Receipt details you save (merchant, date, amounts, line items, category, notes, payment method, tax-deductible flag)
- Your settings (chosen region, tax mode, currency, theme, AI scan counter)

This data lives in a SQLite database in the app's private storage area and in image files in the app's private documents directory. **We do not have a server-side copy of any of it.**

---

## 2. What gets sent to a third party (and what doesn't)

When you tap **Scan** and the AI extraction runs, TallyShot sends:

- The **receipt photo** (resized to 1024px wide, JPEG quality 60%, base64 encoded)
- A **prompt** describing your tax mode (e.g. "GB / VAT inclusive") so the AI parses correctly

…to our **Cloudflare Worker proxy**. The Worker forwards the request to **Anthropic's Claude API** for text extraction, returns the structured result to your phone, and **does not log or store the image, the prompt, or the result**. Anthropic's data handling is governed by the [Anthropic API Usage Policy](https://www.anthropic.com/legal/aup) and [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy). At time of writing, Anthropic does not use API inputs to train models.

**No analytics, ads, tracking SDKs, crash reporters, or third-party libraries with their own data collection are bundled with the app.** No data is sent to us beyond the AI extraction call.

If you use the app fully offline (e.g. **manual receipt entry**), no data leaves your device at all.

---

## 3. Where data is stored and how long

| Data | Where | Retention |
|---|---|---|
| Receipt photos | Your device (`receipts/` directory in app private storage) | Until you delete the receipt or uninstall the app |
| Receipt records | Your device (SQLite: `tallyshot.db`) | Same as above |
| Settings | Your device (AsyncStorage: `tallyshot-app-store`) | Same as above |
| AI extraction request | Cloudflare Worker → Anthropic Claude API | Not stored by us. Anthropic's retention policy applies to the inference call (typically transient). |

Uninstalling TallyShot removes everything we stored.

---

## 4. Your rights

You can do all of the following without contacting us:

- **View, edit, or delete any receipt** at any time within the app
- **Delete all data** in one tap (Settings → Delete all data)
- **Export your data** as CSV or PDF (Settings → Export receipts)
- **Disable AI scanning entirely** by simply not using the Scan button — manual entry works offline

If you have a specific request that the app's UI doesn't satisfy (e.g. a question about what was sent in a particular API call), email us at the address at the top of this policy.

---

## 5. Children

TallyShot is not directed at children under 13. We do not knowingly collect any data from children. If a parent or guardian believes their child has used the app and wants any device data removed, see Section 4 — uninstalling the app removes everything.

---

## 6. Permissions

TallyShot requests the following Android permissions:

- **Camera** — to photograph receipts. Used only when you open the Scan screen. Photos are saved to the app's private storage on your device.
- **Internet** — required to send receipt photos to the AI extraction proxy. The app works offline for manual entry, list, search, filter, and export.

The app does **not** request:

- Location
- Microphone
- Contacts
- Phone state
- Photo library access (the system photo picker is used only when you explicitly tap "Choose from Gallery", and it does not give the app general access to your photos)

---

## 7. Security

- All network traffic to the Cloudflare Worker uses **HTTPS (TLS)**.
- The AI proxy authenticates calls to Anthropic with a server-side API key that never leaves the Worker. Your device never sees the Anthropic API key.
- Local storage is in the app's **private app data area**, which is sandboxed by Android and not readable by other apps.

---

## 8. Changes to this policy

If we change this policy, we will update the "Last updated" date and the new version will apply from that date. Material changes (e.g. adding a new third-party service or changing what data is sent) will be highlighted in a release-notes update.

---

## 9. Contact

Questions about this policy or about your data: **privacy@tallyshot.app** *(replace with your real address before publishing)*

---

*This policy was last reviewed and is accurate as of the date above. It describes the published version of TallyShot on Google Play.*
