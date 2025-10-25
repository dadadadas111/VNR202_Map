# Future tasks / Roadmap

These are longer-term tasks you've noted; saved here for reference.

## 1. Add `image_urls` to events
- Description: Extend `events.json` entries with an `image_urls` array containing URLs to images related to the event.
- Client-side: display thumbnails in the timeline and event popup/panel; allow image gallery viewing.
- Server-side: API to accept uploaded images (if implemented), store them and return stable URLs.
- Status: not-started

## 2. Community-contributed events (UI + server)
- Description: Add a "Contribute event" flow where visitors can submit events directly from the map site.
- Requirements:
  - Popup form: name, year, province (autocomplete), description, image URLs, contributor name.
  - Server (you will build): small web server with API endpoints to receive submissions and store them in MongoDB.
  - Server-side checks: rate limit by IP (max 10 submissions/day), simple spam checks, and optional email/name verification.
  - Display: when viewing the community events tab, show contributed events with an "added by <name>" label.
  - Moderation: optionally mark events as `pending` until approved by an admin endpoint.
- Status: not-started

## 3. Add detailed provinces metadata file
- Description: Create `provinces.json` (or similar) with richer info per province: long description, founding date, population, images, external links, short timeline, etc.
- Client-side: right panel should load and display this richer info when a province is selected.
- Status: not-started

## Notes and next steps
- I can implement client-side changes to support `image_urls` and the contributed-events form; you'll provide the server endpoint and schema, or I can stub the API and give you the spec.
- When you have the real `vietnam.geojson` and `provinces.json`, I'll wire them into the map and improve label/tooltip behavior.

---
Saved on: 2025-10-25
