# Dhara Alert
AI-based early warning and landslide risk monitoring for North-East India (Problem Statement 26001).

## Run it
```bash
npm run setup          # installs server + client
npm run dev            # API on :8787, web app on http://localhost:5173
# production: npm run build && npm start   (one process serves API + app on :8787)
npm test               # 11 tests: slope maths, thresholds, full engine run
npm run check:live     # confirms Open-Meteo + USGS respond with the expected shapes
```
Copy `.env.example` to `.env` to set `ADMIN_TOKEN` (authority tools) and optional Twilio keys for real SMS.

## What is real
| Part | How it works |
|---|---|
| Rainfall + soil moisture | Open-Meteo hourly data (7 days past, 4 days forecast) for all 25 sites, refreshed every 15 min |
| Terrain | Steepest gradient within 500 m from the 90 m DEM (Open-Meteo elevation), cached |
| Earthquakes | USGS feed, last 30 days; PGA by Fukushima-Tanaka attenuation feeds a pseudo-static kh |
| Stability | Infinite-slope Mohr-Coulomb Factor of Safety with pore pressure and seismic term |
| Rainfall trigger | Intensity-duration exceedance against the Caine (1980) threshold |
| Hazard Index | Logistic fusion of FS, rain, soil wetness, 7-day rain, shaking, citizen reports; 72 h forecast in 3 h steps |
| Alerts | Created on upward level crossing (Warning+) and on forecast Danger within 24 h; pushed live (SSE); SMS via Twilio when configured |
| Citizen reports | Photo/video + GPS, no account, rate-limited; offline queue (IndexedDB) sends when network returns; authority can verify/reject |
| Roads | Status from worst slope within 30 km, blocked-road reports, and authority overrides |
| Offline | Service worker caches app shell, last data snapshot and viewed map tiles |

## Be upfront in your submission
- **Soil strength is typical-by-rock-type, not surveyed.** Replace `GEOLOGY` in `server/data/sites.js` with GSI/state data per site.
- **Model weights are an expert prior** until you run `npm run train` on labelled events (CSV format in `server/ml/train.js`, e.g. NASA Global Landslide Catalog + Open-Meteo archive). Validation against history is the next step stated in your abstract. Do not claim accuracy until done.
- Site populations are approximate and only weight prioritisation. Road corridors are approximate alignments.
- **Languages:** English, Hindi, Assamese, Bengali, Nepali are complete; Mizo is a draft; Khasi and Meitei are empty (fall back to English). Add them in `shared/i18n.js` with a native speaker.
- SMS does nothing until Twilio keys are set; the UI says so.
- Satellite imagery is a basemap only; NDVI/InSAR/GPM feeds are future work.

## Deploy
The backend needs a persistent disk and long-lived connections (SSE), so Vercel serverless is a poor fit for the API. Use Render, Railway or Fly (build `npm run setup && npm run build`, start `npm start`, mount a volume at `server/data` and `server/uploads`). Vercel can host the static client if you point `/api` at the backend.
