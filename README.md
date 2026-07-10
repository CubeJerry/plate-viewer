# Plate Viewer

A phone-friendly 96-well pipetting checklist.

The visible site is hosted by **GitHub Pages**. On a laptop, paste an 8 × 12 Excel range and create a short QR link. A **Cloudflare Worker** stores the plate layout in the private **R2** bucket. On the phone, wells can be ticked and unticked using large touch targets; tick state stays in that phone's browser.


## Usage

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



QR generation is self-contained. `docs/vendor/qr-lite.js` wraps the MIT-licensed QRCode for JavaScript encoder by Kazuhiko Arase. Its notice is preserved in `docs/vendor/QR-LICENSE.txt`.

