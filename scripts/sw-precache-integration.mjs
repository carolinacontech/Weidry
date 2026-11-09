// Integración de Astro: al terminar el build, inyecta en dist/sw.js la lista
// de archivos a precachear y una versión basada en su contenido. Así la app
// completa (programa, guía, ilustraciones, fuentes) funciona sin conexión.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])),
  );
  return files.flat();
}

export function swPrecache() {
  return {
    name: 'sw-precache',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = (await walk(root))
          .map((f) => relative(root, f).split(sep).join('/'))
          .filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.startsWith('.'))
          // Subconjuntos de fuentes que no se usan en español: se descargan solo si hicieran falta.
          .filter((f) => !/(cyrillic|greek|vietnamese)/.test(f));
        const hash = createHash('sha256');
        for (const f of files.sort()) {
          hash.update(f);
          hash.update(await readFile(join(root, f)));
        }
        const version = hash.digest('hex').slice(0, 12);
        const urls = files.map((f) => (f === 'index.html' ? '/' : '/' + f.replace(/index\.html$/, '')));
        const swPath = join(root, 'sw.js');
        let sw = await readFile(swPath, 'utf8');
        sw = sw
          .replace('self.__PRECACHE_MANIFEST__ = [];', `self.__PRECACHE_MANIFEST__ = ${JSON.stringify(urls)};`)
          .replace("'__SW_VERSION__'", `'${version}'`);
        await writeFile(swPath, sw);
        logger.info(`sw.js: ${urls.length} archivos precacheados (versión ${version})`);
      },
    },
  };
}
