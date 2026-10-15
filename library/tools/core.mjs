import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SECTIONS = {history: '兴趣与历史', work: '工作与技术', family: '家人学习'};
const allowed = new Set(['.html','.htm','.css','.js','.mjs','.json','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.woff','.woff2','.ttf','.mp3','.mp4','.webm','.pdf','.txt']);
export const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
export const writeJSON = (file, value) => {fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, JSON.stringify(value,null,2)+'\n');};
export function assert(ok, message) {if (!ok) throw new Error(message);}
export function relativeName(name) {
  assert(typeof name === 'string' && name.length && !name.includes('\\') && !name.includes('%') && !name.includes(':') && !name.startsWith('/'), '路径必须是相对路径并使用 /');
  assert(name.split('/').every(p => p !== '..' && p !== '.' && !p.startsWith('.')), `不允许隐藏文件或越界路径：${name}`);
  return name;
}
export function inRoot(root, name) {
  relativeName(name);
  const dest = path.resolve(root, name);
  assert(dest.startsWith(path.resolve(root)+path.sep), `路径越界：${name}`);
  return dest;
}
export function validateProject(p) {
  const fields=new Set(['id','title','description','section','path','visibility','status','version','updated','tags','entry','files','source']);
  assert(Object.keys(p).every(key=>fields.has(key)), 'manifest 存在未知字段；本地路径、内部备注不得进入公开元数据');
  assert(/^[a-z][a-z0-9-]{1,47}$/.test(p.id), 'id 应为 2–48 位小写英文、数字、连字符');
  assert(Object.hasOwn(SECTIONS,p.section), 'section 必须是 history、work 或 family');
  assert(p.visibility === 'PUBLIC', `${p.id}：PRIVATE 或未标记的内容禁止进入公开仓库`);
  assert(['PUBLISHED','WITHDRAWN'].includes(p.status), 'status 必须是 PUBLISHED 或 WITHDRAWN');
  assert(typeof p.title === 'string' && p.title.length > 0 && p.title.length <= 100, '缺少标题或标题过长');
  assert(typeof p.description === 'string' && p.description.length <= 500, 'description 无效');
  assert(/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(p.version), 'version 无效');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(p.updated), 'updated 应为 YYYY-MM-DD');
  assert(p.path === `${p.section}/${p.id}/`, '路径必须为 section/id/，发布后不可更名');
  assert(Array.isArray(p.tags) && p.tags.every(t=>typeof t==='string' && t.length<50), 'tags 无效');
  relativeName(p.entry);
  assert(/\.html?$/.test(p.entry), 'entry 必须是 HTML 文件');
  assert(Array.isArray(p.files) && p.files.length > 0, 'files 必须明确列出网页及资源，禁止整个目录同步');
  p.files.forEach(relativeName);
  assert(!p.files.some(f=>f === '' || f.includes('*')), 'files 不接受通配符');
  assert(!p.source || (p.id === 'song' && p.source === 'repository-root'), '仅已有宋史项目允许引用仓库根目录');
  return p;
}
export function validateCatalog(catalog) {
  assert(catalog.site === 'https://tztzxg.xyz', '主域名必须是 https://tztzxg.xyz');
  const ids=new Set(), paths=new Set();
  for (const p of catalog.projects) {
    validateProject(p);
    assert(!ids.has(p.id) && !paths.has(p.path), '项目 id 或发布路径冲突');
    ids.add(p.id); paths.add(p.path);
  }
  return catalog;
}
export function collectFiles(root, includes) {
  const files = new Map();
  const realRoot=fs.realpathSync(root);
  function walk(name) {
    const target=inRoot(root,name), st=fs.lstatSync(target);
    assert(!st.isSymbolicLink(), `不发布符号链接：${name}`);
    assert(fs.realpathSync(target).startsWith(realRoot+path.sep), `资源越界：${name}`);
    if (st.isDirectory()) {
      for (const child of fs.readdirSync(target).sort()) walk(`${name.replace(/\/$/,'')}/${child}`);
    } else {
      assert(allowed.has(path.extname(name).toLowerCase()), `非网页资源不发布：${name}`);
      assert(!/(^|\/)(?:credentials?|secrets?|passwords?|publish\.json)(\.|\/|$)/i.test(name), `可能包含敏感配置：${name}`);
      assert(st.size <= 50*1024*1024, `单文件超过 50 MB：${name}`);
      const key=name.replace(/\/$/,'');
      assert(![...files.keys()].some(k=>k.toLowerCase()===key.toLowerCase() && k!==key), '文件名大小写冲突');
      files.set(key,target);
    }
  }
  includes.forEach(walk);
  return files;
}
export function checkText(name, bytes) {
  if (!/\.(html?|css|m?js|json|txt|svg)$/i.test(name)) return;
  const text=bytes.toString('utf8');
  assert(!/(?:AKID[a-zA-Z0-9]{28,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{40,})/.test(text), `发现疑似密钥：${name}`);
}
export function projectRoot(p, root=ROOT) {return p.source==='repository-root' ? root : path.join(root,'library/content',p.id);}
export const html = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
