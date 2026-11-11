# Vinay J: portfolio

Personal portfolio of Vinay J, SAP CAP (Java) developer, with an interactive sample project.

**Live site:** https://vinay72368.github.io/portfolio/

## What is in here

| Path | What it is |
|---|---|
| `index.html` | The portfolio page |
| `project.html` | **CAP Store**: an interactive sample CAP Java + UI5 project with a guided tour, a code browser and an API playground |
| `sample-cap-java/` | The real project source: CDS model, CAP Java handlers, UI5 app, tests and MTA descriptor (see its own README to run it) |
| `ui.js`, `sim.js` | A JavaScript copy of the store and its rules, so the demo runs in the browser (a static site cannot run Java) |
| `tools/build-explorer.js` | Rebuilds `project-files.js`, the bundle behind the code browser. Run `node tools/build-explorer.js` after changing anything in `sample-cap-java/` |

It is a plain static site: no build step, no framework. Open `index.html` in a browser, or serve the folder with any static server.

The sample project (`sample-cap-java/`) is a generic demo and free to reuse.
