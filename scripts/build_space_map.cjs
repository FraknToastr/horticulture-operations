const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'src/shared/vendor/space-map');
fs.mkdirSync(out, { recursive: true });
async function build() {
  await esbuild.build({ entryPoints: [path.join(root, 'src/shared/space-map/renderer.mjs')], outfile: path.join(out, 'renderer.js'), bundle: true, format: 'iife', globalName: 'UOSSpaceGPU', target: 'es2022', minify: true, legalComments: 'eof' });
  await esbuild.build({ entryPoints: [path.join(root, 'src/shared/space-map/tree-worker.mjs')], outfile: path.join(out, 'tree-worker.js'), bundle: true, format: 'esm', target: 'es2022', minify: true, legalComments: 'eof' });
  await esbuild.build({ entryPoints: [path.join(root, 'src/shared/space-map/tree-loader.mjs')], outfile: path.join(out, 'tree-loader.js'), bundle: true, format: 'esm', target: 'es2022', minify: true, legalComments: 'eof' });
  // Local-file pages cannot import ES modules or start file:// workers in Edge.
  // Classic script loading supplies the loader and worker source lazily; all
  // geometry processing still executes inside a dedicated Blob worker.
  await esbuild.build({ entryPoints: [path.join(root, 'src/shared/space-map/tree-loader.mjs')], outfile: path.join(out, 'tree-loader-file.js'), bundle: true, format: 'iife', globalName: 'UOSSpaceTreeLayers', target: 'es2022', minify: true, legalComments: 'eof' });
  const worker = await esbuild.build({ entryPoints: [path.join(root, 'src/shared/space-map/tree-worker.mjs')], write: false, bundle: true, format: 'iife', target: 'es2022', minify: true, legalComments: 'eof' });
  fs.writeFileSync(path.join(out, 'tree-worker-source.js'), 'globalThis.UOSSpaceTreeWorkerSource=' + JSON.stringify(worker.outputFiles[0].text) + ';\n');
  for (const [name, file] of [['three', 'LICENSE'], ['earcut', 'LICENSE'], ['esbuild', 'LICENSE.md']]) fs.copyFileSync(path.join(root, 'node_modules', name, file), path.join(out, name + '-LICENSE.txt'));
}
build().catch(error => { console.error(error); process.exitCode = 1; });
