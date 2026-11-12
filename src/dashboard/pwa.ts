import { useEffect, useState } from 'react';

/**
 * Progressive web app wiring for the hosted dashboard.
 *
 * The same index.html is also the Chrome extension's options page, so the
 * manifest, icons and service worker are only attached when the page is
 * served over http(s), never on chrome-extension://.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isWeb = typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

function addLink(rel: string, href: string, extra: Record<string, string> = {}) {
  if (document.head.querySelector(`link[rel="${rel}"]`)) return;
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  Object.entries(extra).forEach(([k, v]) => link.setAttribute(k, v));
  document.head.appendChild(link);
}

export function setupPwa(): void {
  if (!isWeb) return;

  addLink('manifest', '/manifest.webmanifest');
  addLink('icon', '/pwa/favicon-32.png', { type: 'image/png', sizes: '32x32' });
  addLink('apple-touch-icon', '/pwa/apple-touch-icon.png');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // show our own Install app button instead of the mini-infobar
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });

  // Production only: in dev the service worker would cache Vite's module graph
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err);
      });
    });
  }
}

/** Matches the browser and OS title bar to the Glacier canvas of the current theme. */
export function setThemeColor(dark: boolean): void {
  const color = dark ? '#0B1418' : '#F3F7F8';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
}

/** True when the browser offers installation; install() opens its install dialog. */
export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);

  useEffect(() => {
    const update = () => setCanInstall(!!deferredPrompt);
    listeners.add(update);
    update();
    return () => { listeners.delete(update); };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
    notify();
  };

  return { canInstall, install };
}
