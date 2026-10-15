import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT,assert,readJSON,writeJSON,validateProject,validateCatalog,collectFiles,checkText,projectRoot,inRoot} from './core.mjs';
import {build} from './build.mjs';
const args=process.argv.slice(2), command=args.shift(), id=args.shift();
const option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const has=name=>args.includes(name);
const local=path.join(ROOT,'.local'); fs.mkdirSync(local,{recursive:true});
const registryFile=path.join(local,'sources.json'), catalogFile=path.join(ROOT,'library/catalog.json');
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const clean=()=>assert(git('status','--porcelain')==='', '发布仓库有未提交改动。请先处理，不会自动覆盖或暂存其他文件。');
function stage() {
  const item=readJSON(registryFile)[id]; assert(item,'项目未注册');
  const p=validateProject(readJSON(item.manifest)); assert(p.id===id,'manifest id 与登记 id 不一致');
  assert(p.status==='PUBLISHED','请使用 withdraw 命令撤回');
  const previous=validateCatalog(readJSON(catalogFile)).projects.find(x=>x.id===id);
  if(previous) assert(previous.path===p.path,'已发布路径不可更名');
  const files=collectFiles(item.source,p.files); assert(files.has(p.entry),'入口未列入 files');
  const snapshot=path.join(local,'staging',id); fs.rmSync(snapshot,{recursive:true,force:true});
  for(const [name,source] of files) {
    const bytes=fs.readFileSync(source); checkText(name,bytes);
    const dest=inRoot(path.join(snapshot,'content'),name); fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
  }
  writeJSON(path.join(snapshot,'project.json'),p);
  writeJSON(path.join(snapshot,'review.json'),{baseCommit:git('rev-parse','HEAD'),created:new Date().toISOString(),files:[...files.keys()]});
  console.log(`待审核副本：${snapshot}\n${files.size} 个文件。请检查 content/${p.entry}、附件和页面源码。\n审核通过后执行 publish <id> --approve-public --push。`);
}
function publish() {
  assert(has('--approve-public'),'公开发布必须明确添加 --approve-public，确认已审核待发布副本'); clean();
  if(has('--push')) {git('fetch','origin','main');git('merge','--ff-only','origin/main');}
  const snapshot=path.join(local,'staging',id), p=validateProject(readJSON(path.join(snapshot,'project.json')));
  const review=readJSON(path.join(snapshot,'review.json'));
  assert(review.baseCommit===git('rev-parse','HEAD'),'审核期间发布仓库已有新提交，请重新 stage 并审核，防止覆盖更新');
  const catalog=validateCatalog(readJSON(catalogFile)), previous=catalog.projects.find(x=>x.id===id);
  if(previous) {
    assert(previous.path===p.path,'已发布路径不可更名');
    assert(previous.version!==p.version,'更新内容必须增加 version');
    assert(previous.source===p.source,'不能切换项目的发布来源');
  }
  const dest=projectRoot(p), staged=collectFiles(path.join(snapshot,'content'),p.files);
  assert(staged.has(p.entry),'待发布副本缺少入口');
  const changed=[];
  const old=previous&&fs.existsSync(dest)?collectFiles(dest,previous.files):new Map();
  // Remove only explicitly declared prior files, never the repository root.
  for(const [name,file] of old) if(!staged.has(name)){fs.unlinkSync(file);changed.push(path.relative(ROOT,file));}
  for(const [name,file] of staged) {
    const target=inRoot(dest,name), bytes=fs.readFileSync(file);checkText(name,bytes);
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);changed.push(path.relative(ROOT,target));
  }
  catalog.projects=catalog.projects.filter(x=>x.id!==id).concat(p);validateCatalog(catalog);writeJSON(catalogFile,catalog);build();
  git('add','--','library/catalog.json',...changed);git('commit','-m',`发布 ${id} ${p.version}（已审核公开副本）`);
  if(has('--push')) git('push','origin','HEAD:main');
  console.log(`已提交公开版本 ${p.version}${has('--push')?'，GitHub Actions 将自动部署':'；尚未推送，可检查 git show 后 git push'}。`);
}
function withdraw() {
  assert(has('--confirm-withdraw'),'撤回必须添加 --confirm-withdraw'); clean();
  if(has('--push')) {git('fetch','origin','main');git('merge','--ff-only','origin/main');}
  const catalog=validateCatalog(readJSON(catalogFile)), p=catalog.projects.find(x=>x.id===id); assert(p,'没有该公开项目');
  p.status='WITHDRAWN';p.updated=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
  writeJSON(catalogFile,catalog);build();git('add','--','library/catalog.json');git('commit','-m',`撤回公开项目 ${id}`);
  if(has('--push')) git('push','origin','HEAD:main');
  console.log('已记录撤回。部署会删除已记录的源站对象并刷新新旧域名缓存；Git 历史和他人下载的副本不会消失。');
}
let lock;
try {
  assert(/^[a-z][a-z0-9-]{1,47}$/.test(id||''),'用法：node library/tools/manage.mjs register|stage|publish|withdraw <id> [选项]');
  lock=fs.openSync(path.join(local,'publisher.lock'),'wx');
  if(command==='register') {
    const source=option('--source'),manifest=option('--manifest');assert(source&&manifest,'需要 --source 绝对路径 --manifest 绝对路径');
    assert(path.isAbsolute(source)&&path.isAbsolute(manifest),'登记必须使用绝对路径');
    assert(fs.statSync(source).isDirectory()&&fs.statSync(manifest).isFile(),'来源目录或清单不存在');
    const p=readJSON(manifest);assert(p.id===id,'manifest id 不一致');
    const registry=fs.existsSync(registryFile)?readJSON(registryFile):{};
    assert(!registry[id]||has('--replace'),'已登记，更新映射需 --replace');
    registry[id]={source:path.resolve(source),manifest:path.resolve(manifest)};writeJSON(registryFile,registry);
    console.log(`已登记 ${id}（${p.visibility||'PRIVATE'}），原文件留在原项目。`);
  } else if(command==='stage') stage(); else if(command==='publish') publish(); else if(command==='withdraw') withdraw(); else throw new Error('未知命令');
}catch(error){console.error(error.message);process.exitCode=1;}
finally{if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(path.join(local,'publisher.lock'));}}
