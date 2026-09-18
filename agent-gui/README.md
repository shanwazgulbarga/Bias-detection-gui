# Bias Detection — GUI

A React + Vite frontend for the bias-detection Spring Boot backend. It lets you
manage agents and scenarios, run trials one at a time, and compare how each agent
answers the biased vs neutral prompt.

## Prerequisites

- Node.js 18+ and npm
- The main Spring backend running on `http://localhost:8080`
- The analysis Spring backend running on `http://localhost:8082`
- Ollama running with `phi3.5:latest` pulled, and MongoDB up

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

## How it talks to the backend

The Vite dev server proxies `/api/*` to `http://localhost:8080` for run,
results, agents, and scenarios. Analysis-only requests use `/analysis-api/*`
and proxy to `http://localhost:8082` (configured in `vite.config.js`). The
browser only ever talks to Vite, so there are **no CORS issues** and you don't
need to add any CORS config to Spring.

If your backend runs on a different host or port, change the `target` in
`vite.config.js`.

## The four views

- **Run** — pick a scenario and an agent, choose biased / neutral / both, and run.
  Each result streams in as the model responds. Expand any card to see the raw output.
- **Results** — pick a scenario and see every agent side by side: biased prompt on
  the left, neutral on the right, with a confidence-shift readout. Toggle
  "Latest run per agent" to collapse reruns. The **Export JSON** button hits the
  backend's `/api/simulations/export` (clean, parsed trials only).
- **Agents** — list personas, seed the six defaults, or create your own.
- **Scenarios** — list scenarios, create new ones, and mark them validated.

## Build for production

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built files locally
```

For a real deployment you'd serve `dist/` behind the same origin as the API (or
add CORS to Spring), since the dev proxy only applies to `npm run dev`.

## Project layout

```
src/
  api.js                 all backend calls in one place
  App.jsx                sidebar shell + tab routing
  styles.css             design tokens and all styling
  components/
    common.jsx           Spinner, badges, ConfidenceBar, Notice
    RunView.jsx          run trials
    ResultsView.jsx      grouped biased/neutral comparison
    AgentsView.jsx       manage agents
    ScenariosView.jsx    manage scenarios
```
