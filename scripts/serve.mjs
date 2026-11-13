import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url)), port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  try { const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname),target=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
    if(!target.startsWith(root)||requested.includes('\\')) {res.writeHead(403);res.end();return;}
    const body=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  } catch { res.writeHead(404);res.end('Not found'); }
});
server.listen(port,'127.0.0.1',()=>console.log(`FitCard: http://127.0.0.1:${port}`));
