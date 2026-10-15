# 长期维护与发布 SOP

## 1. 三个位置，各自负责什么

1. **原项目目录**：ChatGPT、Codex 或其他工具继续在原位置生成 HTML。工作与题库使用私有仓库或仅本地备份，按项目独立提交、迭代。
2. **发布仓库**：`silver2tranger-art/Song-history`。当前沿用已有仓库与 GitHub Secrets，增加 `library/` 管理门户和已审核的公开副本。原宋史文件仍在根目录。
3. **COS/CDN**：只接收构建生成的 `dist/` 中的清单对象。不要在控制台手改网页；否则下次发布会覆盖。

建议常用固定本地目录 `D:\04_AIProjects\Song-history` 作为发布工作区。开始前 `git pull --ff-only`。本机路径映射放 `.local/sources.json`，被 Git 忽略；换电脑只重建映射，不改变项目 URL。

不要直接编辑 ChatGPT 项目镜像中的 `sources/` 文件；它们是只读参考。发布器可读取一个稳定输出目录，但不要把被自动替换的参考目录当作源码仓库。

## 2. 命名和 manifest

项目 id 采用 2–48 位小写英文、数字、连字符，如 `song`、`energy-notes`、`english-practice`。URL 为 `/分区/id/`：`history`、`work`、`family`。id 和 URL 发布后保持稳定；中文标题可修改。文件名区分大小写，资源路径尽量相对当前页面，避免引用本机盘符。

把 `library/examples/publish.private.json` 复制到**原项目**作为 `publish.json`，或放到发布仓库的 `.local/manifests/`。清单中：

- `visibility` 默认 `PRIVATE`；只有审核后的公开版本才标记 `PUBLIC`。
- `status` 为 `PUBLISHED`；撤回用专门命令记录 `WITHDRAWN`。
- `version` 每次发布递增，例如 `1.0.0` → `1.0.1` 或日期版本 `2026.10.15-1`。
- `updated` 用 `YYYY-MM-DD`；`title`、`description`、`tags` 都会公开。
- `entry` 为真正入口，可为 `index.html` 或 `review.html`。
- `files` 明确列出文件或**专用于公开网页的资源子目录**，例如 `["review.html", "assets/"]`；不能写 `.`、通配符或整个项目根目录。
- `assets/` 会递归发布，请勿混放内部附件。允许 PDF 等网页附件，不代表其内容经过审核。
- `source: repository-root` 仅原宋史项目使用；新项目省略此字段。

不要把密码、客户名、内部目录或其他备注加在清单里。未知字段会被拒绝。

## 3. 第一次登记来源（仅本机，不上传）

在发布仓库目录执行，替换为自己的实际路径：

```powershell
node library/tools/manage.mjs register energy-notes `
  --source 'D:\MyProjects\energy\output' `
  --manifest 'D:\MyProjects\energy\publish.json'
```

`--source` 是网页与资源所在目录，`--manifest` 可以在另一目录。原项目无需移动。移动本地文件夹后用同命令加 `--replace` 更新映射。

## 4. 每次发布：先保留源码，再审核副本

1. 在原项目完成内容和测试，建议先提交原项目 Git。不要在公开发布仓库中处理内部原始资料。
2. 更新 manifest 的版本和日期。确认公开范围后，将该公开版本清单设为 `PUBLIC`。
3. 发布仓库先同步远端，生成本地待审核副本：

```powershell
git pull --ff-only
node library/tools/manage.mjs stage energy-notes
```

4. 检查 `.local/staging/energy-notes/content/`：页面正文、隐藏 DOM、脚本内嵌数据、图片、PDF、下载附件以及外部请求。需要网络资源或 fetch 的页面，用本地 HTTP 服务预览。密钥扫描只能发现部分常见密钥，不能判断公司机密、客户授权或题库版权。
5. 审核的是这个固定副本。之后原项目继续编辑，不会改变本次副本。确认允许公开后：

```powershell
node library/tools/manage.mjs publish energy-notes --approve-public --push
```

6. 脚本检查工作区和 Git 更新冲突，复制副本，更新公开目录，构建，提交本项目变更并推送。GitHub 自动发布，无需手工上传或手工刷新缓存。
7. 在 GitHub Actions 查看 `Publish personal library to Tencent` 成功，并打开对应网址。没有 `--push` 时仅本地提交，检查 `git show` 后自行 `git push`。

**冲突处理**：不强制推送。远端有新提交、工作区有未提交文件、路径重名或版本重复时会停止；先处理 Git 冲突，再重新 stage 和审核。发布器不会把其他项目的未提交改动顺手提交。异常退出后如遗留 `.local/publisher.lock`，先确认没有发布进程运行，再删除这个本地锁文件。

## 5. 宋史的兼容维护

继续在原宋史工作区编辑根目录 `index.html` 和 `images/`，正常 `git add`、`git commit`、`git push` 即可触发新流程；这是已明确公开的既有项目。较大变更建议更新 `library/catalog.json` 中的版本、日期和说明。宋史内容交互规则仍按根目录 `AGENTS.md`。

门户的源文件在 `library/site/`，模板在 `library/tools/build.mjs`。不要直接修改 `dist/`，它每次重新生成。

## 6. 撤回、回滚、改名

```powershell
node library/tools/manage.mjs withdraw energy-notes --confirm-withdraw --push
```

撤回后：门户不再列出该项目；CI 根据上次发布对象记录删除该项目源站文件；刷新两个域名的 HTTP/HTTPS 缓存；失败则工作流保持失败，需要重跑。再次公开需新的版本和完整审核。

撤回不等于保密：公开 Git 历史、他人下载和浏览器旧缓存可能仍留存。误发敏感信息时应立即撤回并吊销暴露密钥，检查两域名和 COS 直连；再按 GitHub 官方流程处理敏感 Git 历史。不要用 `robots.txt`、隐藏链接或前端口令充当权限保护。

回滚使用 Git 正常的 `git revert <错误提交>` 并推送，重新走部署与缓存刷新。不要重跑旧提交覆盖新提交，CI 会跳过已经落后于 main 的排队版本。回滚可能重新公开已经撤回的资料，执行前检查目录和内容差异。

改标题直接改 metadata。改 URL 不自动执行；新建新 id 后明确处理旧路径迁移。旧路径若曾含敏感内容，不要通过重定向继续泄露。

## 7. 多项目与私有区

每个原项目可有自己的 Git 仓库和发布清单。发布器只复制 `files` 白名单，不移动源码；公开副本随中央仓库 Git 留档。中央仓库是线上网页的唯一写入来源，避免多个 CI 同时写同一个 COS 路径。不要再运行旧的“整个目录上传”脚本。

工作、客户资料和家人题库默认只做本地/私有仓库维护。当前不自动读取题库仓库。未来私有区应使用独立私有桶、服务端登录鉴权和受控下载；源站也必须防绕过。私有 COS 加公开 CDN 并不自动形成私有区。身份验证上线前，所有 PRIVATE 项目都不能进入公共构建。

## 8. 本地检验

```powershell
node --test library/tests/*.test.mjs
python -m unittest discover -s library/tests -p 'test_*.py'
node library/tools/build.mjs
git diff --check
```

正式发布只在 main 上运行，Pull Request 仅验证，不使用云端密钥。CI 串行部署，当前构建使用 Git 提交号标识，不增加额外内容哈希、版本冻结或复杂门禁。
