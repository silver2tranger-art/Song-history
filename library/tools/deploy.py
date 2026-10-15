"""Publish declared public files only. Credentials come from environment."""
import json
import mimetypes
import os
from pathlib import Path
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
BUCKET = 'web-static-1474623368'
REGION = 'ap-nanjing'
DOMAINS = ('tztzxg.xyz', 'demo.tztzxg.xyz')
STATE_KEY = 'site-release.json'
ROOT_KEYS = {'index.html', '404.html', 'robots.txt', 'sitemap.xml', 'site-release.json',
             'history/index.html', 'work/index.html', 'family/index.html',
             'assets/library.css', 'assets/search.js'}


def managed(key, projects):
    if not isinstance(key, str) or '..' in key.split('/') or '\\' in key or key.startswith('/'):
        return False
    return key in ROOT_KEYS or any(key.startswith(p['path']) for p in projects)


def deletion_keys(previous, current):
    projects = previous.get('projects', []) + current['projects']
    for p in projects:
        section = p['path'].split('/')[0]
        if section not in ('history', 'work', 'family') or p['path'] != f"{section}/{p['id']}/" or not p['id'].replace('-', '').isalnum():
            raise ValueError('远端发布记录的路径无效')
    keys = set(previous.get('keys', [])) | set(previous.get('pending_delete', []))
    if not all(managed(k, projects) for k in keys):
        raise ValueError('远端发布记录包含管理范围之外的对象')
    # Known copies accidentally included by the former whole-repository uploader.
    keys.update('history/song/' + k for k in ('AGENTS.md', 'PROJECT_STATUS.md', '修改意见V1.docx'))
    return sorted(keys - set(current['keys']))


def main():
    from qcloud_cos import CosConfig, CosS3Client
    from qcloud_cos.cos_exception import CosServiceError
    from tencentcloud.common import credential
    from tencentcloud.cdn.v20180606 import cdn_client, models
    sid, skey = os.environ.get('TENCENT_SECRET_ID'), os.environ.get('TENCENT_SECRET_KEY')
    if not sid or not skey:
        raise RuntimeError('缺少 GitHub Secrets: TENCENT_SECRET_ID / TENCENT_SECRET_KEY')
    cos = CosS3Client(CosConfig(Region=REGION, SecretId=sid, SecretKey=skey, Scheme='https'))
    cdn = cdn_client.CdnClient(credential.Credential(sid, skey), '')
    plan = json.loads((ROOT / '.build/deploy-plan.json').read_text(encoding='utf-8'))
    if plan['release'] != os.environ['GITHUB_SHA']:
        raise RuntimeError('构建提交与部署提交不一致')
    if not all(managed(k, plan['projects']) for k in plan['keys']):
        raise RuntimeError('构建对象路径越界')
    try:
        previous = json.loads(cos.get_object(Bucket=BUCKET, Key=STATE_KEY)['Body'].get_raw_stream().read())
    except CosServiceError as error:
        if error.get_status_code() != 404: raise
        previous = {}
    remove = deletion_keys(previous, plan)

    def put(key, body, content_type):
        cos.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType=content_type,
                       CacheControl='no-cache, max-age=0, must-revalidate', ContentDisposition='inline')

    # Keep the union until success so a partial deploy can be retried and cleaned.
    pending = dict(plan, keys=sorted(set(plan['keys']) | set(previous.get('keys', []))), pending_delete=remove, state='deploying')
    put(STATE_KEY, json.dumps(pending).encode(), 'application/json')
    def order(key):
        return (2 if key in ROOT_KEYS else 1 if key.endswith(('.html', '.htm')) else 0, key)
    for key in sorted(plan['keys'], key=order):
        content_type = mimetypes.guess_type(key)[0] or 'application/octet-stream'
        if key.endswith('.js'): content_type = 'text/javascript'
        if key.endswith(('.html', '.css', '.js', '.json', '.txt', '.xml')): content_type += '; charset=utf-8'
        with (ROOT / 'dist' / key).open('rb') as body: put(key, body, content_type)
        print('Uploaded:', key)
    for key in remove:
        cos.delete_object(Bucket=BUCKET, Key=key)
        print('Removed old published copy:', key)

    req = models.PurgePathCacheRequest()
    req.from_json_string(json.dumps({'Paths': [f'{scheme}://{d}/' for d in DOMAINS for scheme in ('http', 'https')], 'FlushType': 'delete'}))
    task_id = cdn.PurgePathCache(req).TaskId
    task_ids = [task_id] if task_id else []
    if not task_ids: raise RuntimeError('CDN 未返回刷新任务 ID')
    print('CDN refresh tasks:', ', '.join(task_ids))
    deadline = time.monotonic() + 600
    pending_tasks = set(task_ids)
    while pending_tasks and time.monotonic() < deadline:
        for task_id in list(pending_tasks):
            query = models.DescribePurgeTasksRequest()
            query.from_json_string(json.dumps({'TaskId': task_id, 'Limit': 100}))
            tasks = cdn.DescribePurgeTasks(query).PurgeLogs or []
            if any(t.Status == 'fail' for t in tasks): raise RuntimeError('CDN 缓存刷新失败：' + task_id)
            if tasks and all(t.Status == 'done' for t in tasks): pending_tasks.remove(task_id)
        if pending_tasks: time.sleep(10)
    if pending_tasks: raise RuntimeError('CDN 刷新尚未完成，请在控制台确认后重跑工作流')
    for domain in DOMAINS:
        for route in ('', 'history/', 'work/', 'family/'):
            url = f'https://{domain}/{route}'
            for attempt in range(6):
                try:
                    with urllib.request.urlopen(url, timeout=25) as response: body = response.read().decode('utf-8')
                    if f'content="{plan["release"]}"' not in body: raise RuntimeError('仍是旧缓存')
                    break
                except Exception:
                    if attempt == 5: raise RuntimeError('上线验证失败：' + url) from None
                    time.sleep(10)
    for p in plan['projects']:
        if p['status'] == 'PUBLISHED':
            with urllib.request.urlopen(f'https://tztzxg.xyz/{p["path"]}', timeout=25) as response:
                if response.status != 200: raise RuntimeError('项目页面不可访问')
    complete = dict(plan, state='complete', purge_tasks=task_ids)
    put(STATE_KEY, json.dumps(complete, ensure_ascii=False).encode(), 'application/json')
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as out:
            out.write(f'部署成功：[总首页](https://tztzxg.xyz/)\n\n提交：`{plan["release"]}`\n\n上传 {len(plan["keys"])} 个文件；清理 {len(remove)} 个旧对象；两个域名缓存刷新完成。\n')
    print('Verified deployment: https://tztzxg.xyz/')


if __name__ == '__main__':
    try: main()
    except Exception as error:
        # Avoid dumping SDK request signatures in logs.
        print('Deployment failed:', type(error).__name__)
        if isinstance(error, RuntimeError): print(str(error))
        elif hasattr(error, 'get_error_code'): print('COS code:', error.get_error_code())
        elif hasattr(error, 'get_code'): print('Tencent API code:', error.get_code())
        raise SystemExit(1)
