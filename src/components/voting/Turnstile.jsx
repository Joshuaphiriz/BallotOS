import React, { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
let scriptPromise = null;

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

// Renders Cloudflare's Turnstile CAPTCHA widget and calls onVerify(token)
// once the visitor passes. The token is meaningless on its own — it's
// verified server-side (api/_lib/turnstile.js) before anything sensitive
// happens. If VITE_TURNSTILE_SITE_KEY isn't set, this renders nothing and
// onVerify is never called (calling code should handle that state).
export default function Turnstile({ onVerify, onExpire }) {
  const ref = useRef(null);
  const widgetId = useRef(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    let cancelled = false;
    if (!siteKey) return undefined;
    loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token) => onVerify(token),
        'expired-callback': () => onExpire && onExpire(),
      });
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* already gone */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) {
    return (
      <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
        Verification is not configured (VITE_TURNSTILE_SITE_KEY missing).
      </p>
    );
  }

  return <div ref={ref} className="flex justify-center" />;
}
