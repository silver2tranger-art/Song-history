import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,SECTIONS,assert,readJSON,writeJSON,validateCatalog,collectFiles,checkText,projectRoot,html as h} from './core.mjs';

const sectionText={history:'沿着时间与地图，重访历史，也收藏日常的好奇。',work:'记录技术探索与专题研究，沉淀值得再次翻阅的知识。',family:'为家人的学习与练习，留一处安静、专注的空间。'};
function card(p) {
  return `<article class="item" data-search="${h([p.title,p.description,...p.tags].join(' ').toLocaleLowerCase())}">${p.id==='song'?'<a class="item-cover" href="/history/song/"><img src="/history/song/images/share-cover.jpg" alt="宋代历史长卷" loading="lazy"></a>':''}<div class="item-body"><div class="item-meta">${h(SECTIONS[p.section])} &nbsp; / &nbsp; ${h(p.updated)}</div><h3><a href="/${h(p.path)}">${h(p.title)}</a></h3><p>${h(p.description)}</p><div class="tags">${p.tags.map(t=>`<span class="tag">${h(t)}</span>`).join('')}</div><a class="item-link" href="/${h(p.path)}"><span>打开资料</span><span aria-hidden="true">↗</span></a></div></article>`;
}
function page(section, projects, release) {
  const home=!section, title=home?'个人网页资料库':SECTIONS[section];
  const selected=projects.filter(p=>home||p.section===section);
  const nav=[['','总首页'],...Object.entries(SECTIONS)];
  const summary=home?'把兴趣、工作与生活里的积累，整理成可以随时重访的网页。':sectionText[section];
  const canonical=`https://tztzxg.xyz/${section?section+'/':''}`;
  const empty=section==='family'?'学习资料保留在私人空间。这里暂未开放公开题库。':section==='work'?'公开研究将陆续整理。内部工作文件与客户资料保留在私人空间。':'新的资料正在整理中。';
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(title)} · 拾页</title><meta name="description" content="${h(summary)}"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${h(title)} · 拾页"><meta property="og:description" content="${h(summary)}"><meta property="og:url" content="${canonical}"><meta name="site-release" content="${h(release)}"><link rel="stylesheet" href="/assets/library.css"><script src="/assets/search.js" defer></script></head>
<body><a class="skip" href="#main">跳到主要内容</a><header><div class="wrap topbar"><a class="brand" href="/" aria-label="拾页 · 总首页"><span class="seal">拾</span><span>拾页<small>A PERSONAL LIBRARY</small></span></a><nav aria-label="主导航">${nav.map(([key,label])=>`<a href="/${key?key+'/':''}"${(key===(section||''))?' aria-current="page"':''}>${label}</a>`).join('')}</nav></div></header>
<main id="main" class="wrap"><section class="hero"><div><p class="eyebrow">${home?'NOTES, CURIOSITY & EVERYDAY LIFE':`COLLECTION / ${section.toUpperCase()}`}</p><h1>${home?'让每一份积累，<br>都有一处归所。':h(title)}</h1><p class="intro">${h(summary)}</p></div><div class="book-art" aria-hidden="true"><span>史与远方</span><span>知与实践</span><span>学与生活</span></div></section>
${home?`<section class="section-grid" aria-label="三个独立分区">${Object.entries(SECTIONS).map(([key,label],i)=>`<a class="section-card" href="/${key}/"><span class="number">0${i+1} / COLLECTION</span><h2>${label}</h2><p>${sectionText[key]}</p><div class="card-bottom"><span>${projects.filter(p=>p.section===key).length?projects.filter(p=>p.section===key).length+' 项公开资料':'公开资料待整理'}</span><span class="arrow" aria-hidden="true">↗</span></div></a>`).join('')}</section>`:''}
${selected.length?`<section aria-labelledby="catalog-title"><div class="catalog-heading"><div><h2 id="catalog-title">${home?'最近整理':'分区资料'}</h2><p>随时打开，接着上次的好奇。</p></div><label class="search"><input id="search" type="search" placeholder="搜索标题、主题或关键词" aria-label="搜索公开资料"></label></div><div class="items">${selected.sort((a,b)=>b.updated.localeCompare(a.updated)).map(card).join('')}</div><p id="results-count" class="results-count" aria-live="polite">显示 ${selected.length} 项公开资料</p><p id="no-results" hidden>没有找到相关资料，试试其他关键词。</p></section>`:`<section class="empty"><h2>留给下一份积累</h2><p>${empty}</p><a class="back" href="/">← 返回总首页</a></section>`}
<aside class="note"><strong>一份持续生长的个人收藏。</strong><span>这里只展示适合公开分享的内容。</span></aside></main><footer><div class="wrap footer-inner"><span>拾页 · 个人网页资料库</span><span><a href="https://tztzxg.xyz/">tztzxg.xyz</a> &nbsp; / &nbsp; 兴趣 · 工作 · 家人</span></div></footer></body></html>`;
}
export function build(root=ROOT) {
  const catalog=validateCatalog(readJSON(path.join(root,'library/catalog.json')));
  const dist=path.join(root,'dist');
  assert(path.dirname(dist)===path.resolve(root),'构建目录越界');
  fs.rmSync(dist,{recursive:true,force:true}); fs.mkdirSync(dist,{recursive:true});
  const release=process.env.GITHUB_SHA||'local-preview';
  const keys=[];
  const write=(key,data)=>{const dest=path.join(dist,key);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);keys.push(key);};
  const visible=catalog.projects.filter(p=>p.status==='PUBLISHED');
  for(const p of visible) {
    const files=collectFiles(projectRoot(p,root),p.files);
    assert(files.has(p.entry), `${p.id} 的 entry 不在 files 中`);
    for(const [name,source] of files){const bytes=fs.readFileSync(source);checkText(name,bytes);write(p.path+name,bytes);}
    if(p.entry!=='index.html') write(p.path+'index.html',`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${h(p.entry)}"><a href="${h(p.entry)}">打开资料</a>`);
  }
  write('assets/library.css',fs.readFileSync(path.join(root,'library/site/style.css')));
  write('assets/search.js',fs.readFileSync(path.join(root,'library/site/search.js')));
  write('index.html',page('',visible,release));
  for(const section of Object.keys(SECTIONS)) write(section+'/index.html',page(section,visible,release));
  write('404.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面未找到 · 拾页</title><link rel="stylesheet" href="/assets/library.css"><main class="wrap hero"><div><p class="eyebrow">404 / NOT FOUND</p><h1>这一页暂时不在书架上。</h1><p>链接可能已失效，或资料已撤回。</p><a class="back" href="/">返回资料库 →</a></div></main></html>');
  const urls=['',...Object.keys(SECTIONS).map(s=>s+'/'),...visible.map(p=>p.path)];
  write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>https://tztzxg.xyz/${h(url)}</loc></url>`).join('')}</urlset>`);
  write('robots.txt','User-agent: *\nAllow: /\nSitemap: https://tztzxg.xyz/sitemap.xml\n');
  const state={release,keys:keys.sort(),projects:catalog.projects.map(p=>({id:p.id,path:p.path,status:p.status,version:p.version}))};
  writeJSON(path.join(root,'.build/deploy-plan.json'),state);
  console.log(`构建完成：${visible.length} 个公开项目，${keys.length} 个文件。`);
  return state;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) build();
