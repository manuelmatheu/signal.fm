# signal.fm

A passive music discovery web app. signal.fm builds a living feed of tracks you haven't heard yet, driven by what you already love.

## How it works

Five discovery signals feed your personalized stream:

- **Artist similarity** -- explore artists related to your favourites (via Last.fm)
- **Track similarity** -- find tracks that sound like what you love (via Last.fm)
- **New releases** -- fresh music from artists in your seed pool (via Spotify)
- **Deep cuts** -- lesser-known tracks from artists you love (positions 11-30 on Last.fm)
- **Last.fm picks** -- personalized recommendations via your Last.fm listening history (optional)

As you listen, like, and skip, the feed adapts in real time. Liked tracks boost their artist's weight and spawn new discovery branches. Skipped tracks gently deprioritize.

## Setup

1. Clone the repo
2. Set your Spotify Client ID and Last.fm API key in `js/config.js`
3. Add your deployment URL as a redirect URI in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
4. Deploy to Vercel (recommended -- required for the Last.fm picks proxy to work)

### Local development

```bash
# Vercel CLI (recommended -- runs serverless functions)
npx vercel dev

# Plain static server (Last.fm picks signal will be unavailable)
python3 -m http.server 8000
# or
npx serve .
```

Then visit `http://localhost:3000` (Vercel) or `http://localhost:8000` (plain) and connect your Spotify account.

## Stack

- Vanilla JS -- no framework, no build step, no bundler
- [Spotify Web API](https://developer.spotify.com/documentation/web-api/) + [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/)
- [Last.fm API](https://www.last.fm/api)
- CSS custom properties for dark/light theme
- Vercel serverless function (`api/lfm-station.js`) as a CORS proxy for Last.fm personalized picks

## Optional: Last.fm integration

Connect your Last.fm account via the "Connect Last.fm" button in the signal filters. This enables:

- **Seed enrichment** -- your Last.fm scrobble history is merged into the seed pool
- **Last.fm picks signal** -- personalized recommendations from Last.fm's station engine

The picks signal uses Last.fm's internal web player station endpoint, proxied through a Vercel serverless function to bypass CORS restrictions.

## Deployment

Deploy to Vercel for full functionality (the Last.fm picks proxy requires a serverless runtime).

- **Vercel** (recommended): connect repo, auto-deploys from `main`
- **GitHub Pages / Netlify / static hosts**: all signals work except Last.fm picks (no serverless runtime)

Remember to add each deployment URL as a redirect URI in your Spotify app settings.
