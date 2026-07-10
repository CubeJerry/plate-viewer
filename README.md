# Plate Viewer

A phone-friendly 96-well pipetting checklist.

The visible site is hosted by **GitHub Pages**. On a laptop, paste an 8 × 12 Excel range and create a short QR link. A **Cloudflare Worker** stores the plate layout in the private **R2** bucket. On the phone, wells can be ticked and unticked using large touch targets; tick state stays in that phone's browser.

## Preconfigured values

- Repository: `plate-viewer`
- Expected site: `https://cubejerry.github.io/plate-viewer/`
- Worker: `https://96-well-checklist-api.cjerry517.workers.dev`
- Worker name: `96-well-checklist-api`
- R2 binding: `PLATES`
- R2 bucket: `96-well-plates`

Nothing needs to be installed on the laptop.

## One-time deployment

### 1. Upload the repository

1. Create a GitHub repository named **`plate-viewer`**.
2. Upload the **contents** of this folder to the repository root. Do not upload only the unopened ZIP.
3. Commit to `main`.

### 2. Enable GitHub Pages

Open **Repository Settings → Pages** and choose:

```text
Source: Deploy from a branch
Branch: main
Folder: /docs
```

The resulting site should be:

```text
https://cubejerry.github.io/plate-viewer/
```

### 3. Replace the Cloudflare Worker starter

1. Open Cloudflare → **Workers & Pages → `96-well-checklist-api`**.
2. Select **Edit code**.
3. Replace the Hello World code with the complete contents of `worker/src/index.js`.
4. Deploy it.
5. Confirm the existing binding remains:

```text
Type:  R2 bucket
Name:  PLATES
Value: 96-well-plates
```

Then visit:

```text
https://96-well-checklist-api.cjerry517.workers.dev/health
```

It should return JSON containing `"ok": true` and `"r2Binding": true`.

### 4. Recommended R2 cleanup

In **R2 → `96-well-plates` → Settings → Object Lifecycle Rules**, add:

```text
Rule name: Delete old plate files
Prefix: plates/
Delete objects after: 30 days
```

Keep the bucket private. Do not enable its public development URL. R2 CORS is not needed because browsers communicate with the Worker rather than directly with R2.

## Daily use

1. Open the GitHub Pages site on the laptop.
2. In Excel, select the 8 × 12 plate contents only—no row or column headers.
3. Paste into Plate Viewer.
4. Select **Load plate** and inspect the preview.
5. Select **Create phone checklist**.
6. Scan the QR code.
7. Tap a well to tick it; tap again to untick it.

Top-left is always **A1**. Blank wells are inactive.

The phone provides:

- **Touch view** with large active-well buttons;
- **Plate view** preserving the full 8 × 12 spatial layout;
- optional hiding of completed wells;
- a **Keep awake** control on supported phone browsers;
- progress tracking and a completion state;
- local persistence after refresh;
- an offline fallback after the plate has been opened once on that phone.

## Excel parsing

- Up to 8 rows and 12 tab-separated columns are accepted.
- Short rows are padded with inactive blank wells.
- More than 8 rows or 12 columns is rejected to avoid accidental misalignment.
- Default display headers are A–H and 1–12.
- Headers can be hidden or replaced under **Optional headers and storage**.

## Configuration

The Worker URL is in `docs/config.js`.

CORS rules are at the top of `worker/src/index.js`. The supplied Worker is restricted to the exact GitHub Pages origin `https://cubejerry.github.io` plus local test addresses. If the site is later moved to another GitHub account or a custom domain, add that exact origin to `EXACT_ORIGINS` and redeploy.

## Privacy and security

- The R2 bucket stays private.
- No R2 credentials are exposed to the browser.
- Plate links use random unlisted IDs.
- Tick state is never uploaded; it remains in the phone's local storage.
- Do not store patient-identifiable, clinical, confidential, or otherwise sensitive information.
- CORS is not user authentication. This is intended as a lightweight personal/lab tool.

## QR generation

QR generation is self-contained. `docs/vendor/qr-lite.js` wraps the MIT-licensed QRCode for JavaScript encoder by Kazuhiko Arase. Its notice is preserved in `docs/vendor/QR-LICENSE.txt`.

## Validation

GitHub Actions checks the JavaScript syntax and tests the Worker create/load flow on each push.
