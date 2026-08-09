// Intentionally minimal. The renderer (your React app) talks to Supabase
// directly over HTTPS, exactly like it does in the browser — it doesn't need
// any privileged Node/Electron APIs, so nothing is exposed here. Keeping
// nodeIntegration off and contextIsolation on (set in main.js) is what keeps
// the desktop app as safe as the website.
