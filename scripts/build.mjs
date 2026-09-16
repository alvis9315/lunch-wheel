import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const [html, css, core, catalog, reviews, accountUI, reviewUI, app] = await Promise.all(['index.html', 'styles.css', 'core.js', 'catalog.js', 'reviews.js', 'account-ui.js', 'review-ui.js', 'app.js'].map(file => readFile(path.join(root, 'src', file), 'utf8')));
const [leafletJs,leafletCss]=await Promise.all(['leaflet.js','leaflet.css'].map(file=>readFile(path.join(root,'vendor',file),'utf8')));
const suggestionsUI=await readFile(path.join(root,'src','suggestions-ui.js'),'utf8');
const output = html.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + leafletCss.replaceAll('url(images/','url(https://unpkg.com/leaflet@1.9.4/dist/images/') + '\n</style><style>\n'+css + '\n</style>')
  .replace('<script src="core.js"></script><script src="app.js"></script>', () => '<script>\n'+leafletJs+'\n</script><script>\n' + core + '\n' + catalog + '\n' + reviews + '\n' + accountUI + '\n' + reviewUI + '\n'+suggestionsUI+'\n' + app + '\n</script>');
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist', 'Index.html'), output, 'utf8');
await writeFile(path.join(root,'dist','Code.gs'),catalog+'\n'+reviews+'\n'+await readFile(path.join(root,'apps-script','Identity.gs'),'utf8')+'\n'+await readFile(path.join(root,'apps-script','Code.gs'),'utf8')+'\n'+await readFile(path.join(root,'apps-script','Suggestions.gs'),'utf8'),'utf8');
await copyFile(path.join(root,'apps-script','appsscript.json'),path.join(root,'dist','appsscript.json'));
console.log('Built dist/Index.html, dist/Code.gs, dist/appsscript.json (no runtime package dependencies).');
