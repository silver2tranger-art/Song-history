import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './core.mjs';
const dist=path.join(ROOT,'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
http.createServer((req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1'), name=decodeURIComponent(url.pathname);
    let file=path.resolve(dist,'.'+name);
    if(!file.startsWith(dist+path.sep)&&file!==dist){res.writeHead(403);res.end();return;}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory()) {
      if(!name.endsWith('/')){res.writeHead(301,{Location:name+'/'+url.search});res.end();return;}
      file=path.join(file,'index.html');
    }
    const exists=fs.existsSync(file)&&fs.statSync(file).isFile();
    if(!exists) file=path.join(dist,'404.html');
    res.writeHead(exists?200:404,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(400);res.end('Bad request');}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173/'));
