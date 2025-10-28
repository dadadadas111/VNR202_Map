# VNR202 Digital History Map

An interactive web map that visualizes key milestones in the history of the Communist Party of Vietnam. Built as a course project for VNR202 by team SE1823-NET, the site combines a Leaflet-powered map with curated historical events to make exploring Vietnam's revolutionary history more accessible.

## Project highlights
- **Timeline filtering** – Switch between major historical periods (1930–1945, 1945–1975, 1975–present) to focus on the events that matter for each era.
- **Province exploration** – Click any province on the map to read contextual information and view related events in the side panel.
- **Event catalog** – Browse a structured list of significant events drawn from `events.json`, with space to expand into richer multimedia storytelling in the future.
- **Modular UI panels** – Reusable UI components (`ui-panels.js`, `map-actions.js`) keep the main map script lean and easy to maintain.

## Repository structure
- `index.html` – The entry point that wires up the layout, Leaflet map, and UI panels.
- `style.css` – Styling for the application shell, panels, and responsive layout.
- `script.js` – Main client-side logic for loading data, wiring events, and updating the map.
- `map-actions.js` and `ui-panels.js` – Helper modules for map interactions and panel behavior.
- `events.json` – Source dataset describing historical milestones (name, year, province, description).
- `vietnam.geojson` – Geospatial boundaries for Vietnam's provinces.
- `FUTURE_TASKS.md` – Long-term roadmap items to guide continued development.

## Getting started
1. Clone the repository:
   ```bash
   git clone https://github.com/dadadadas111/VNR202_Map.git
   cd VNR202_Map
   ```
2. Open `index.html` in your browser. No build step is required; all assets are static.
3. Explore the map, select eras, and click provinces to see their historical highlights.

## Development tips
- Use a lightweight static server (for example, `npx serve` or VS Code's Live Server extension) to avoid cross-origin issues when loading JSON files locally.
- Add new events by editing `events.json`. Each event can include `name`, `year`, `province`, `description`, and optional metadata for richer storytelling.
- Update province shapes or metadata by replacing `vietnam.geojson` with an authoritative dataset.

## Future roadmap
Planned enhancements are tracked in [`FUTURE_TASKS.md`](FUTURE_TASKS.md) and include:
- Attaching image galleries to events.
- Supporting community-contributed event submissions backed by a server API.
- Expanding province-level details with richer contextual information.

---
Made with ❤️ by Team 5 (SE1823-NET) for the VNR202 course.
