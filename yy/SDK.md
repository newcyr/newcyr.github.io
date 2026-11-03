# NEWCYR 应用中心 · 接入 SDK

本下载中心是**纯静态、零构建**的：页面只读取 `apps/` 目录里的 JSON。
新增应用不需要改 HTML / CSS / JS，只需要「一份配置 + 一个 APK」。
本文件即接入说明（SDK）。

- 线上地址：<https://newcyr.github.io/yy/>
- 配置目录：`/yy/apps/`
- 站点仓库：`newcyr/newcyr.github.io`（GitHub Pages，分支 `main`）

---

## 1. 目录结构

```
yy/
├── index.html                  # 下载中心页面（无需修改）
├── app.css / ui.css / app.js  # 页面样式与逻辑（无需修改）
├── SDK.md                      # 本文件
├── apps/                       # ★ 应用配置目录
│   ├── index.json              # 应用清单（新增应用时加 id）
│   ├── config.json             # 站点信息 + 镜像线路 + 通用知识
│   ├── _template.json          # 应用配置模板
│   ├── tq.json                 # 拾墨
│   └── todox.json              # TodoX
├── tq/                         # 应用文件与下载页
│   ├── index.html
│   ├── shimo-1.0.0.apk
│   └── ...
└── todox/
    ├── index.html
    ├── icon.png
    └── todox-1.0.0.apk
```

约定：

- 每个应用一个 `apps/<id>.json`，`id` 与文件名一致，使用小写字母、数字、短横线。
- 安装包路径 `file` 相对 `/yy/` 写，例如 `tq/shimo-1.0.0.apk`。
- 应用下载页 `page` 相对 `/yy/` 写，例如 `tq/`（末尾斜杠）。
- 图标 `icon` 相对 `/yy/` 写，例如 `todox/icon.png`；留空则用 `iconText` 生成字母图标。

---

## 2. 三步新增应用

### 第一步：复制模板

```bash
cp yy/apps/template.json yy/apps/demo.json
```

把 `demo.json` 里的字段改成新应用的信息，尤其是：

- `id`：必须与文件名一致（`demo`）
- `name`、`tagline`、`description`
- `file`：APK 相对 `/yy/` 的路径
- `page`：下载页相对 `/yy/` 的路径
- `sizeBytes`：APK 的精确字节数（用于镜像大文件判断与统计）
- `checksum.value`：APK 的 SHA-256

### 第二步：加入清单

编辑 `yy/apps/index.json`，把新 id 追加到 `apps` 数组：

```json
{
  "version": 1,
  "apps": ["tq", "todox", "demo"]
}
```

清单顺序不影响页面显示；卡片默认按 `updated` 倒序，可用 `order` 微调。

### 第三步：上传 APK 与下载页，推送

```bash
# APK 放在与应用同名的目录，文件名建议带版本号
cp demo-1.0.0.apk yy/demo/demo-1.0.0.apk

git add yy/apps yy/demo
git commit -m "feat(yy): add Demo app"
git push origin main
```

GitHub Pages 构建完成后（通常数十秒），刷新 <https://newcyr.github.io/yy/> 即可看到新应用；
页面每次加载都会重新请求 `apps/index.json` 与各应用 JSON（`cache: no-cache`），无需重新构建页面。

---

## 3. 应用配置字段

完整示例见 `yy/apps/template.json`。

### 必填

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一标识，须与 JSON 文件名、目录名一致 |
| `name` | string | 应用显示名 |
| `tagline` | string | 一句话简介，显示在卡片与详情顶部 |
| `description` | string | 2–3 句完整介绍，用于卡片与详情 |
| `version` | string | 版本号，如 `1.2.0` |
| `file` | string | APK 路径，相对 `/yy/`，如 `demo/demo-1.0.0.apk` |
| `category` | string | 分类，页面筛选芯片自动生成 |
| `updated` | string | 更新日期 `YYYY-MM-DD`，用于排序与展示 |
| `sizeBytes` | number | APK 字节数，用于总大小统计与镜像限制判断 |

### 推荐

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `size` | string | 人类可读体积，如 `12.3 MB`；缺省由 `sizeBytes` 计算 |
| `os` | string | 系统要求，如 `Android 8.0+` |
| `platform` | string | 平台，默认 `Android` |
| `channel` | string | 通道，如 `稳定版` |
| `vendor` | string | 开发者 / 团队（可选，当前页面未展示） |
| `page` | string | 应用下载页，相对 `/yy/`，如 `demo/` |
| `icon` | string | 图标路径，相对 `/yy/`；留空用字母图标 |
| `iconText` | string | 图标回落字符（1 个字） |
| `accent` | string | 卡片强调色，如 `#0b5cff` |
| `featured` | boolean | 是否精选（当前用于排序预留） |
| `order` | number | 同日更新时的排序权重，越小越靠前 |
| `released` | string | 首次发布日 |
| `tags` | string[] | 标签，卡片展示前 4 个 |
| `keywords` | string[] | 检索关键词（别名、英文名、用户可能输入的说法） |
| `highlights` | object[] | 功能亮点：`{ "title": "...", "desc": "..." }` |
| `faq` | object[] | 应用问答：`{ "q": "...", "a": "..." }`，会进入全局检索 |
| `checksum` | object | `{ "algo": "SHA-256", "value": "..." }`，详情页可一键复制 |
| `links` | object | 预留链接集合；下载页请用顶层 `page` |

### 检索是如何生效的

页面会把以下字段加入检索索引：

- 应用：`name`、`latin`、`tagline`、`description`、`category`、`tags`、`keywords`、`highlights`、`faq`
- 应用问答：每条 `faq` 同时作为“知识”结果
- 站点知识：`config.json` 中的 `knowledge`

所以把用户会搜的词写进 `keywords`，把安装/使用问题写进 `faq`，检索命中率最高。
中文按子串匹配，英文不区分大小写；多关键词用空格分隔，要求全部命中。

---

## 4. 镜像线路配置

`apps/config.json` 中的 `repo` 与 `mirrors` 决定下载地址的拼接方式。
页面默认自带 5 条线路，用户可在右上角「线路」中切换，选择保存在 `localStorage`。

```json
{
  "repo": {
    "owner": "newcyr",
    "name": "newcyr.github.io",
    "branch": "main",
    "basePath": "yy"
  },
  "defaultMirror": "direct",
  "mirrors": [
    {
      "id": "direct",
      "name": "本站直连",
      "kind": "origin",
      "desc": "GitHub Pages 官方线路，稳定可靠",
      "limitMB": 0
    },
    {
      "id": "jsdelivr",
      "name": "jsDelivr CDN",
      "kind": "template",
      "url": "https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}",
      "desc": "全球 CDN 节点，小文件下载更快",
      "limitMB": 20
    }
  ]
}
```

模板占位符：

| 占位符 | 值 |
| --- | --- |
| `{owner}` | `repo.owner` |
| `{repo}` | `repo.name` |
| `{branch}` | `repo.branch` |
| `{basePath}` | `repo.basePath`（这里是 `yy`） |
| `{path}` | `basePath + "/" + app.file`，例如 `yy/tq/shimo-1.0.0.apk` |

规则：

- `kind: "origin"`：直接以当前站点 `/yy/` 为基址访问 `file`，不需要 `url`。
- `kind: "template"`：按 `url` 模板替换占位符。
- `limitMB`：单文件大小上限；`0` 表示不限。若当前线路不支持正在下载的文件，页面会自动回退到 `direct` 并提示。
- 新增线路只需追加对象，无需改 JS；`id` 唯一即可。
- 镜像只是改变下载地址，请确保镜像确实同步本仓库（jsDelivr / raw / Statically 直接读取 GitHub；ghproxy 为代理）。

也可替换为自己的 CDN，例如：

```json
{
  "id": "my-cdn",
  "name": "自建 CDN",
  "kind": "template",
  "url": "https://cdn.example.com/yy/{path}",
  "desc": "自建加速节点",
  "limitMB": 0
}
```

---

## 5. 校验与发布检查

### 计算 SHA-256

```bash
# macOS
shasum -a 256 yy/demo/demo-1.0.0.apk

# Linux
sha256sum yy/demo/demo-1.0.0.apk

# Windows（cmd）
certutil -hashfile yy\demo\demo-1.0.0.apk SHA256
```

把结果填入 `checksum.value`。详情页提供「复制」按钮，方便用户比对。

### 获取精确字节数

```bash
stat -c '%s' yy/demo/demo-1.0.0.apk   # Linux
stat -f '%z' yy/demo/demo-1.0.0.apk   # macOS
```

### 提交前自检

1. JSON 语法：
   ```bash
   python3 -m json.tool yy/apps/demo.json > /dev/null
   python3 -m json.tool yy/apps/index.json > /dev/null
   python3 -m json.tool yy/apps/config.json > /dev/null
   ```
2. 路径存在且大小写一致（GitHub Pages 区分大小写）：
   ```bash
   ls -l yy/demo/demo-1.0.0.apk yy/demo/index.html
   ```
3. 本地预览（必须通过 HTTP，`file://` 无法 fetch JSON）：
   ```bash
   cd /path/to/newcyr.github.io
   python3 -m http.server 8080
   # 打开 http://localhost:8080/yy/
   ```
4. 在页面中检查：卡片出现、检索命中、详情抽屉数据正确、快速下载 URL 正确、镜像切换后 URL 正确。

### 更新已有应用

1. 上传新 APK，例如 `yy/demo/demo-1.1.0.apk`；
2. 修改 `apps/demo.json` 的 `version`、`file`、`size`、`sizeBytes`、`updated`、`checksum`，按需更新 `faq`；
3. 旧的 APK 可以保留（历史直链不失效）或删除（会 404）。建议保留至少一个上一个版本；
4. 推送到 `main`，无需改 `index.json`。

---

## 6. 常见问题排查

| 现象 | 排查 |
| --- | --- |
| 卡片不出现 | `index.json` 是否包含该 id；`apps/<id>.json` 是否同名；JSON 是否合法 |
| 页面显示“应用清单加载失败” | 是否用 `file://` 打开；`apps/config.json`、`index.json` 是否可访问 |
| 图标 404 | `icon` 路径是否相对 `/yy/`；文件名大小写是否正确 |
| 下载 404 | `file` 路径是否相对 `/yy/`；APK 是否已提交并推送 |
| 镜像下载 404 | 镜像是否同步了最新提交；`repo.branch` 是否为 `main`；大文件是否被 jsDelivr 限制（≤ 20 MB） |
| 新配置没生效 | 浏览器缓存；强制刷新，或确认 Pages 构建完成 |
| APK 超过 100 MB | GitHub 普通文件上限 100 MB；更大文件请使用 Releases 或自建 CDN，并在 `mirrors` 中配置 |

---

## 7. 设计约束（修改页面时）

- 页面是纯静态 HTML/CSS/JS，无框架、无构建、无外部依赖；新增应用不应改动页面代码。
- API 请求全部使用相对路径（`apps/...`），以保证在 `/yy/` 子目录部署时可用。
- 所有配置文本在渲染前经过 HTML 转义；请不要在 JSON 中放未经信任的 HTML。
- 页面不含统计、广告或第三方追踪脚本；新增应用时也请勿加入远程追踪代码。
- 下载按钮会同步创建 `<a download>` 并立即点击，以保留用户手势，避免被浏览器拦截。

---

## 8. 最小示例

`apps/demo.json`：

```json
{
  "id": "demo",
  "name": "Demo",
  "latin": "DEMO",
  "tagline": "一分钟接入下载中心。",
  "description": "示例应用，用于验证接入流程。",
  "version": "1.0.0",
  "platform": "Android",
  "os": "Android 8.0+",
  "updated": "2026-11-03",
  "size": "12.3 MB",
  "sizeBytes": 12897485,
  "file": "demo/demo-1.0.0.apk",
  "page": "demo/",
  "category": "示例",
  "tags": ["示例", "接入"],
  "keywords": ["demo", "示例"],
  "highlights": [{ "title": "零构建", "desc": "只读取 JSON，不改页面代码。" }],
  "faq": [{ "q": "如何更新？", "a": "替换 file 与 version 后推送即可。" }],
  "checksum": { "algo": "SHA-256", "value": "..." }
}
```

`apps/index.json`：

```json
{ "version": 1, "apps": ["tq", "todox", "demo"] }
```

完成。刷新 <https://newcyr.github.io/yy/> 即可看到卡片、检索结果与下载入口。
