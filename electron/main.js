// Electron main process. Creates the app window and loads the React build.
// This is an "online wrapper": the UI ships inside the installer and opens
// instantly, but data (elections, votes, users, ...) still comes from your
// live Supabase project over the internet — same backend as the website.
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

// In dev, load Vite's dev server so you get hot reload. In a packaged app,
// load the built index.html straight off disk.
const isDev = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5173';

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: 'BallotOS',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Open any external link (e.g. links inside the app pointing elsewhere)
  // in the system browser instead of inside the Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
