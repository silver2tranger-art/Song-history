import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT,readJSON,writeJSON} from '../tools/core.mjs';

test('real CLI: private denied, review snapshot preserved, publish committed, withdrawal built',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'library-integration-')), repo=path.join(base,'publisher'),source=path.join(base,'original');
  try {
    fs.mkdirSync(repo);fs.mkdirSync(source);
    fs.cpSync(path.join(ROOT,'library'),path.join(repo,'library'),{recursive:true});
    fs.copyFileSync(path.join(ROOT,'.gitignore'),path.join(repo,'.gitignore'));
    fs.writeFileSync(path.join(repo,'index.html'),'<h1>Existing history</h1>');fs.mkdirSync(path.join(repo,'images'));
    fs.writeFileSync(path.join(repo,'images/share-cover.jpg'),'fixture');
    const run=(exe,args)=>execFileSync(exe,args,{cwd:repo,encoding:'utf8',stdio:'pipe'});
    const git=(...args)=>run('git',args);
    git('init','-b','main');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('add','.');git('commit','-m','initial');
    const manifest=path.join(source,'publish.json');
    const p={id:'demo',title:'Public sample',description:'Reviewed',section:'work',path:'work/demo/',visibility:'PRIVATE',status:'PUBLISHED',version:'1.0.0',updated:'2026-10-15',tags:[],entry:'index.html',files:['index.html']};
    writeJSON(manifest,p);fs.writeFileSync(path.join(source,'index.html'),'<h1>Reviewed version</h1>');
    const cli=(...args)=>run(process.execPath,['library/tools/manage.mjs',...args]);
    cli('register','demo','--source',source,'--manifest',manifest);
    assert.throws(()=>cli('stage','demo'));
    p.visibility='PUBLIC';writeJSON(manifest,p);cli('stage','demo');
    assert.throws(()=>cli('publish','demo'));
    fs.writeFileSync(path.join(source,'index.html'),'<h1>Unreviewed later edits</h1>');
    cli('publish','demo','--approve-public');
    assert.equal(fs.readFileSync(path.join(repo,'dist/work/demo/index.html'),'utf8'),'<h1>Reviewed version</h1>');
    assert.equal(git('status','--porcelain').trim(),'');
    cli('withdraw','demo','--confirm-withdraw');
    assert(!fs.existsSync(path.join(repo,'dist/work/demo/index.html')));
    assert.equal(readJSON(path.join(repo,'library/catalog.json')).projects.find(p=>p.id==='demo').status,'WITHDRAWN');
  } finally {fs.rmSync(base,{recursive:true,force:true});}
});
