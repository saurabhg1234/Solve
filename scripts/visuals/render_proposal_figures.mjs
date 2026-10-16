/** Render generated SVG figures locally. Usage: node script.mjs <figure-dir> <playwright-module> [chromium-path] [scale=1] */
import {readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [directory,modulePath,executablePath,scaleArg]=process.argv.slice(2);
const scale=Number(scaleArg??1);if(!Number.isFinite(scale)||scale<.8||scale>3)throw new Error('Scale must be between 0.8 and 3');
if(!directory||!modulePath)throw new Error('Provide figure directory and installed Playwright module');
const root=resolve(directory),{chromium}=await import(pathToFileURL(resolve(modulePath)).href);
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','HOME','LANG','LC_ALL','TMPDIR','FONTCONFIG_PATH'].includes(k)));
const browser=await chromium.launch({headless:true,executablePath,env,args:['--no-sandbox']});
try{
 const page=await browser.newPage({deviceScaleFactor:scale});
 // Generated diagrams must remain entirely local and self-contained.
 await page.route('**/*',route=>route.abort());
 let count=0;
 for(const name of (await readdir(root)).filter(n=>n.endsWith('.svg')).sort()){
  const svg=await readFile(join(root,name),'utf8');
  const width=Number(svg.match(/<svg[^>]*width="([\d.]+)"/)?.[1]),height=Number(svg.match(/<svg[^>]*height="([\d.]+)"/)?.[1]);
  if(!(width>0&&width<=5000&&height>0&&height<=6000))throw new Error(`Invalid bounds: ${name}`);
  await page.setViewportSize({width:Math.ceil(width),height:Math.ceil(height)});
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">'+svg+'</body></html>');
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:join(root,name.replace(/\.svg$/,'.png'))});count++;
 }
 console.log(JSON.stringify({rendered:count,directory:root,scale}));
}finally{await browser.close();}
