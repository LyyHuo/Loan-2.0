# គណនាកម្ចី – Loan Calculator (v2.1.0)

Car loan calculator in Khmer and English. Plain HTML, CSS and JavaScript, no build step.

## Run locally
Open `index.html` in a browser. Or serve the folder:

    python3 -m http.server 8000

Then open http://localhost:8000

## Deploy to GitHub Pages
1. Create a repository and push this folder to it (the `index.html` must be at the root).
2. In the repo go to Settings > Pages, choose "Deploy from a branch", branch `main`, folder `/ (root)`, then Save.
3. The site appears at https://YOUR-USERNAME.github.io/REPO-NAME/

## Structure
- `index.html` – page markup
- `css/style.css` – all styles (light and dark themes, animations, splash, sticky header)
- `js/app.js` – calculator, schedule with show more, reports, history, language and theme, downloads, scroll effects
- `fonts/` – Kantumruy Pro (Khmer and Latin, weights 300–700), bundled so it works offline
- `vendor/bootstrap/` – Bootstrap 5.3.3 JS bundle (used for the collapsible schedule)
- `img/`, `favicon.ico` – icons

## Features
- Flat and fixed loans; down payment in $ or %; term in years or months; monthly or annual rate (default 0.77% monthly)
- Thousands separators while typing
- Payment schedule with Show more / Show less
- Download the schedule as CSV, Excel (.xlsx, coloured, with formulas and loan information) or PDF
- Copyable reports for 5–7 years and 1–7 years
- Saved history in the browser (up to 30 entries)
- Light and dark mode, Khmer and English
- Splash screen, scroll animations, sticky header

## Notes
- Saved history and the theme and language choice are stored in the browser (localStorage), per device.
- The Excel file uses the Khmer OS font; the computer must have it installed or Excel will substitute another font.
- The PDF pages are images, so their text can't be selected.

Developed by LyyHuo (Ly Huo).
