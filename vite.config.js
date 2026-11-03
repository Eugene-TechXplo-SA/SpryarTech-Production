import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;
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
      const vars = json ? JSON.parse(json) : {};
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
