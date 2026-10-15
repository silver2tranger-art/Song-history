import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateCatalog,validateProject,collectFiles,checkText,ROOT,readJSON} from '../tools/core.mjs';
import {build} from '../tools/build.mjs';
const song=readJSON(path.join(ROOT,'library/catalog.json')).projects[0];
test('private/missing visibility cannot enter public catalog',()=>{
  for(const visibility of ['PRIVATE',undefined,'public']) assert.throws(()=>validateProject({...song,visibility}));
});
test('reject duplicate route, path traversal and new root sources',()=>{
  assert.throws(()=>validateCatalog({site:'https://tztzxg.xyz',projects:[song,song]}));
  assert.throws(()=>validateProject({...song,files:['../internal.html']}));
  assert.throws(()=>validateProject({...song,id:'another',path:'history/another/'}));
});
test('only allowlisted assets, no hidden files, symlinks or private keys',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'library-test-'));
  try{
    fs.writeFileSync(path.join(tmp,'index.html'),'<p>public</p>');fs.writeFileSync(path.join(tmp,'confidential.docx'),'private');
    assert.deepEqual([...collectFiles(tmp,['index.html']).keys()],['index.html']);
    assert.throws(()=>collectFiles(tmp,['confidential.docx']));assert.throws(()=>collectFiles(tmp,['.env']));
    assert.throws(()=>checkText('index.html',Buffer.from('AKID'+'a'.repeat(32))));
    fs.symlinkSync(tmp,path.join(tmp,'link'),'junction');assert.throws(()=>collectFiles(tmp,['link/']));
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('build keeps legacy song route but excludes repository/reference files',()=>{
  const plan=build();assert(plan.keys.includes('history/song/index.html'));
  for(const key of ['index.html','history/index.html','work/index.html','family/index.html']) assert(plan.keys.includes(key));
  assert(!plan.keys.some(k=>/AGENTS|PROJECT_STATUS|\.docx|\.git|publish\.json/.test(k)));
  for(const k of plan.keys.filter(x=>x.endsWith('.html'))){
    const text=fs.readFileSync(path.join(ROOT,'dist',k),'utf8');
    for(const match of text.matchAll(/(?:href|src)="(\/(?!\/)[^"?#]*)(?:[?#][^"]*)?"/g)){
      const target=path.join(ROOT,'dist',match[1]);const resolved=match[1].endsWith('/')?path.join(target,'index.html'):target;
      assert(fs.existsSync(resolved),`broken internal link: ${k} -> ${match[1]}`);
    }
  }
});
