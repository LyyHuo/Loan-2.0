# គណនាកម្ចី – Loan Calculator (v2.0.0)

Car loan calculator in Khmer / English. Plain HTML, CSS and JavaScript — no build step.

## Run
Open `index.html` in a browser. Or serve the folder:

    python3 -m http.server 8000   # then open http://localhost:8000

Works fully offline: the font and Bootstrap JS are bundled.

## Structure
- `index.html` – page markup
- `css/style.css` – all styles (light + dark theme, animations, splash)
- `js/app.js` – calculator, reports, history, language and theme toggle, scroll effects
- `fonts/` – Kantumruy Pro (Khmer + Latin, weights 300–700, woff2)
- `vendor/bootstrap/` – Bootstrap 5.3.3 bundle (used for the schedule collapse)
- `img/`, `favicon.ico` – app icons

## Features
Flat and fixed loans, down payment ($ and %), term in years/months, monthly or annual rate (default 0.77% monthly),
payment schedule, copyable reports (5–7 and 1–7 years), saved history (browser localStorage), light/dark mode,
Khmer/English toggle, splash screen, scroll animations.

Developed by LyyHuo.
