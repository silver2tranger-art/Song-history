# 拾页 · 个人网页资料库

主站：https://tztzxg.xyz/ 。兴趣与历史 `/history/`、工作与技术 `/work/`、家人学习 `/family/`。

宋史项目继续在仓库根目录的 `index.html`、`images/` 独立维护；线上路径仍为 `/history/song/`。网站总首页由 `library/` 生成，因此没有改写原宋史页面。

## 本地预览

需要 Node.js 22 或更新版本，无须安装前端依赖。

```powershell
node library/tools/build.mjs
node library/tools/preview.mjs
```

打开 `http://127.0.0.1:4173/`。

## 日常更新

在各自项目文件夹完成 HTML 后，按 [维护 SOP](library/docs/维护SOP.md) 登记、生成待审核副本、批准公开。工具复制发布所需文件，不搬走原项目，不递归同步整个工作目录。

```powershell
node library/tools/manage.mjs stage energy-notes
node library/tools/manage.mjs publish energy-notes --approve-public --push
```

第二条命令表示你已审核**待发布副本**，允许向公开 GitHub 仓库和公网发布。不能对未审核资料使用它。

GitHub `main` 更新后，自动测试 → 构建公开清单 → 上传 COS → 删除撤回/过时对象 → 刷新主域名与旧域名缓存 → 验证线上内容。工作流红色表示尚未完成，不能仅凭上传步骤成功判断上线。

## 私有资料

本仓库为公开仓库。公司/客户资料、题库、内部附件、原始调研素材和本地路径不得提交到这里。`PRIVATE` 清单只放在原私有项目或本机 `.local/`。脚本明确拒绝将其导入。家人/工作分区入口不代表已经提供身份验证或私有托管。

详见 [云端运维说明](library/docs/云端运维.md)。
