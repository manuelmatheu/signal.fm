# signal.fm

A passive music discovery web app. signal.fm builds a living feed of tracks you haven't heard yet, driven by what you already love.

## How it works

Four discovery signals feed your personalized stream:

- **Artist similarity** -- explore artists related to your favourites (via Last.fm)
- **Track similarity** -- find tracks that sound like what you love (via Last.fm)
- **New releases** -- fresh music from artists in your seed pool (via Spotify)
- **Daily rotation** -- seed pool refreshes every 24 hours for variety

As you listen, like, and skip, the feed adapts in real time. Liked tracks boost their artist's weight and spawn new discovery branches. Skipped tracks gently deprioritize.

## Setup

1. Clone the repo
2. Set your Spotify Client ID in `js/config.js`
3. Add your deployment URL as a redirect URI in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
4. Serve the files (any static host works -- no build step needed)

### Local development

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then visit `http://localhost:8000` and connect your Spotify account.

## Stack

- Vanilla JS -- no framework, no build step, no bundler
- [Spotify Web API](https://developer.spotify.com/documentation/web-api/) + [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/)
- [Last.fm API](https://www.last.fm/api)
- CSS custom properties for dark/light theme

## Optional: Last.fm integration

Enter your Last.fm username in the sidebar to add scrobble history to your seed pool. This enriches discovery by including artists from your listening history beyond Spotify.

## Deployment

Deploy to any static host. The app auto-detects its redirect URI from `window.location`.

- **Vercel**: connect repo, auto-deploys from `main`
- **GitHub Pages**: enable in repo settings
- **Netlify**, **Cloudflare Pages**, etc.: drag and drop

Remember to add each deployment URL as a redirect URI in your Spotify app settings.
