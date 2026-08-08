import { base44 } from '@/api/base44Client';

export const ROLES = {
  admin: 'System Administrator',
  observer: 'Election Observer',
  polling_assistant: 'Polling Assistant',
};

export const DEFAULT_THEME = {
  primary_color: '#1F365C',
  secondary_color: '#637D97',
  accent_color: '#D4A437',
};

// station helpers — the active station is stored per-PC in localStorage by the
// polling assistant so voters (who never log in) inherit that session.
const STATION_KEY = 'ballotos-station';

export function getStation() {
  try { return JSON.parse(localStorage.getItem(STATION_KEY)); } catch { return null; }
}

export function setStation(station) {
  localStorage.setItem(STATION_KEY, JSON.stringify(station));
}

export function clearStation() {
  localStorage.removeItem(STATION_KEY);
}

export function can(user, capability) {
  const role = user?.ems_role || 'admin';
  const map = {
    admin: ['manage', 'results', 'reports', 'logs', 'users'],
    observer: ['logs'],
    polling_assistant: ['station'],
  };
  return (map[role] || []).includes(capability);
}

export async function getActiveElection() {
  const active = await base44.entities.Election.filter({ is_active: true }, '-created_date', 1);
  if (active.length) return active[0];
  const any = await base44.entities.Election.list('-created_date', 1);
  return any[0] || null;
}

export async function logAudit(action, category = 'system', details = '', election_id = null) {
  const me = await base44.auth.me().catch(() => null);
  return base44.entities.AuditLog.create({
    action,
    category,
    details,
    election_id: election_id || undefined,
    actor: me?.full_name || me?.email || 'system',
  });
}

export function parseDelimited(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const delim = (text.split('\n')[0].split('\t').length > text.split('\n')[0].split(',').length) ? '\t' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const clean = rows.filter(r => r.some(v => String(v).trim() !== ''));
  if (!clean.length) return { headers: [], rows: [] };
  return { headers: clean[0].map(h => h.trim()), rows: clean.slice(1) };
}

export function applyTheme(election) {
  const root = document.documentElement;
  root.style.setProperty('--ems-primary', election?.primary_color || DEFAULT_THEME.primary_color);
  root.style.setProperty('--ems-secondary', election?.secondary_color || DEFAULT_THEME.secondary_color);
  root.style.setProperty('--ems-accent', election?.accent_color || DEFAULT_THEME.accent_color);
}