# Privacy Policy — TallyShot

**Effective date:** set on launch day
**Last updated:** 4 October 2026
**Publisher:** Reece Shaw (United Kingdom)
**Contact:** {{CONTACT_EMAIL}}

This is the privacy policy for **TallyShot**, an app for iPhone and Android that scans receipts and product barcodes and tracks expenses on your device.

This policy is written to reflect what TallyShot actually does, not boilerplate. If anything below stops being true, we will update this page and change the "Last updated" date.

---

## 1. What we collect

**TallyShot does not require an account.** You do not give us an email, password, name or phone number to use the app.

The app stores the following data **on your device only**:

- Receipt photos you take or import
- Receipt details you save (merchant, date, amounts, line items, category, notes, payment method, tax-deductible flag)
- Your settings (region, tax mode, currency, theme, AI scan counter, scanner preferences)
- Any ingredients or allergens you choose to flag in Settings, so scans can highlight them. This list never leaves your device; matching happens locally
- A cache of product barcodes you have scanned and the product details found for them
- Your scan history: the products you have scanned and when

This data lives in a database and image files in the app's private storage. **We do not have a server-side copy of any of it.**

---

## 2. What gets sent to third parties (and what doesn't)

**AI receipt reading.** When you tap **Scan**, TallyShot sends the **receipt photo** (resized and compressed) and a short **prompt** describing your tax mode to our **Cloudflare Worker proxy**, which forwards it to **Anthropic's Claude API** for text extraction and returns the result to your phone. The Worker **does not log or store** the image, the prompt or the result. Anthropic's handling is governed by the [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy).

**Barcode lookups.** When you scan a product barcode, TallyShot sends **only the barcode digits** to free public product databases: the **Open Food Facts** family ([privacy policy](https://world.openfoodfacts.org/privacy)) and **UPCitemdb** ([terms](https://www.upcitemdb.com/wp/docs/main/terms-of-service/)). If no database knows the product, you can optionally ask our AI proxy for a best guess, which again sends only the digits.

**Ingredient photos.** Only if you tap **"Photograph the ingredients"** is a photo of the pack sent to our AI proxy to be read, with the same handling as receipt photos.

**Subscriptions.** If you subscribe to TallyShot Pro, payment is handled entirely by **Apple (App Store)** or **Google (Google Play)**. We never see your card details. We use **RevenueCat** to check whether your subscription is active. RevenueCat receives an anonymous app user ID, your purchase receipts, and basic device and app information (such as OS version and app version), and does not receive your receipts, photos or expense data. See the [RevenueCat Privacy Policy](https://www.revenuecat.com/privacy).

**App updates.** TallyShot checks Expo's update service (EAS Update) for bug-fix updates. That request includes technical details such as the app version, platform and update channel, and no personal or receipt data. See the [Expo Privacy Policy](https://expo.dev/privacy).

**No advertising, analytics or tracking SDKs** are included, and we do not track you across other companies' apps or websites.

If you use the app offline (for example, manual receipt entry), no data leaves your device.

---

## 3. Where data is stored and for how long

| Data | Where | Retention |
|---|---|---|
| Receipt photos and records, settings, scan history, product cache | Your device | Until you delete them or uninstall the app |
| AI extraction request | Cloudflare Worker → Anthropic Claude API | Not stored by us. Anthropic's retention policy applies to the request |
| Barcode lookup (digits only) | Open Food Facts / UPCitemdb | Standard web-server handling by those services; no personal data attached |
| Subscription status | Apple / Google, and RevenueCat | As set out in their policies, for as long as needed to provide the subscription |

Uninstalling TallyShot removes everything stored on your device.

---

## 4. Your rights

Under UK data protection law you have rights to access, correct and delete your personal data. Because your data stays on your device, you can exercise most of them directly:

- **View, edit or delete any receipt** in the app
- **Delete all data** in one tap (Settings → Delete all data)
- **Export your data** as CSV or PDF (Settings → Export receipts)
- **Avoid AI processing entirely** by using manual entry

Manage or cancel a subscription in your **Apple ID settings** (iPhone) or the **Google Play Store → Subscriptions** (Android). For anything else, email us at the address at the top of this page. You can also complain to the UK Information Commissioner's Office (ico.org.uk).

---

## 5. Children

TallyShot is not directed at children under 13, and we do not knowingly collect data from children.

---

## 6. Permissions

- **Camera:** to photograph receipts and scan barcodes, only while the Scan screen is open.
- **Photos:** only when you tap "Choose from Gallery", through the system photo picker. The app does not get general access to your library.
- **Internet:** for AI extraction, barcode lookups and subscription checks.

TallyShot does **not** request location, microphone, contacts or phone-state access.

---

## 7. Security

All traffic to our proxy uses **HTTPS**. The Anthropic API key lives only on the server and never on your device. Local data sits in the app's private, sandboxed storage.

---

## 8. Changes to this policy

If we change this policy, we will update the "Last updated" date. Material changes, such as adding a new third-party service, will be noted in the app's release notes.

---

## 9. Contact

Questions about this policy or your data: **{{CONTACT_EMAIL}}**
