import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;

/*
  Public address this build is served from. Share-preview tags (og:image etc.) must be
  absolute URLs that actually resolve, so they use this origin. Set SITE_URL explicitly,
  or it is picked up from the host's build environment (Vercel, Netlify, Cloudflare Pages).
  Canonical links always point at the production domain.
*/
const PRODUCTION_URL = 'https://www.spryartech.co.za';
const env = process.env;
const withProtocol = host => (host ? (/^https?:\/\//.test(host) ? host : `https://${host}`) : '');
const SITE_URL = (
  env.SITE_URL ||
  withProtocol(env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL) ||
  env.URL ||            // Netlify
  env.CF_PAGES_URL ||   // Cloudflare Pages
  PRODUCTION_URL
).replace(/\/+$/, '');
const GLOBAL_VARS = { site: SITE_URL, production: PRODUCTION_URL };
const pages = ['index', 'about', 'services', 'industries', 'case-studies', 'csi', 'careers', 'contact', 'privacy'];

/*
  Minimal HTML partials:
    <!-- @include partials/header.html -->
    <!-- @include partials/page-hero.html {"title": "About"} -->
  JSON vars fill {{name}} placeholders inside the partial. Includes can nest.
*/
function htmlIncludes() {
  const INCLUDE = /<!--\s*@include\s+([\w/.-]+)(?:\s+(\{[\s\S]*?\}))?\s*-->/g;
  const render = (html, depth = 0) => {
    if (depth > 8) throw new Error('html-includes: includes nested too deeply');
    return html.replace(INCLUDE, (_, file, json) => {
      const vars = { ...GLOBAL_VARS, ...(json ? JSON.parse(json) : {}) };
      const part = readFileSync(resolve(root, file), 'utf8')
        .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
      return render(part, depth + 1);
    });
  };
  return {
    name: 'html-includes',
    transformIndexHtml: { order: 'pre', handler: html => render(html) },
    handleHotUpdate({ file, server }) {
      if (file.includes('/partials/')) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  plugins: [htmlIncludes()],
  // own port so it never collides with other local Vite projects on 5173
  server: { port: 5273, strictPort: true },
  preview: { port: 5274, strictPort: true },
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map(p => [p, resolve(root, `${p}.html`)])),
    },
  },
});
