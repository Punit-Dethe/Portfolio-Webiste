# Portfolio – Playful Desk UI

A static portfolio that mimics a playful desktop with docked icons and stacked sticky notes.

## Files
- `index.html` – structure
- `styles.css` – layout, colors, halftone background, comic borders
- `script.js` – small interactions (hover raise, keyboard nudge)

## Preview
Just open `index.html` in your browser.

Or serve locally (optional):
- Python 3: `python -m http.server 8000` and open http://localhost:8000/
- Node (serve): `npx serve .`

## Customize
- Change your name in the top bar inside `index.html` (`.brand-name`).
- Update left dock link targets and labels.
- Edit note text inside `.notes`.
- Adjust positions/angles by tweaking inline CSS variables on each note (`--x`, `--y`, `--r`).

## Accessibility
- Semantic landmarks (header, aside, main, nav)
- Keyboard: focus a note and use arrow keys to nudge (hold Shift for larger steps)
