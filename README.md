# ROYALE
npm install && npm run dev  |  Deploy: Netlify (netlify.toml liegt bei)
Neue Spiele: Eintrag in src/games/registry.js + Route in src/App.jsx.

## Supabase (Schritt 1)
1. supabase/schema.sql im Supabase SQL Editor ausführen.
2. Authentication: "Allow anonymous sign-ins" einschalten.
3. URL und Publishable Key stehen in src/supabase.js (oder als VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).
