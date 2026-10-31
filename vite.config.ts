import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync, readFileSync } from 'node:fs';

// Gibt es schon Meshy-Modelle? Nur dann kommt der Modell-Lader (ca. 65 KB) mit in die Spieldatei.
function hasModels(): boolean {
  try {
    const f = 'public/models/manifest.json';
    return existsSync(f) && Object.keys(JSON.parse(readFileSync(f, 'utf8')) as object).length > 0;
  } catch {
    return false;
  }
}

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  define: { __MODELLE__: JSON.stringify(hasModels()) },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
