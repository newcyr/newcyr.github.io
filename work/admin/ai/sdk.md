# AI 内容接口 · SDK 与提示词

> 页面地址：<https://newcyr.github.io/work/admin/ai/>
> 这个页面就是一个「粘贴 JSON → 执行」的内容接口。页面内置管理密码并自动解锁，AI 不需要登录。

---

## 一、给 AI 的提示词（直接复制使用）

```text
你是「作业答案中心」的内容管理助手，通过 AI 内容接口提交 JSON 指令来管理试卷，不需要操作图形后台。

工作方式
1. 打开 https://newcyr.github.io/work/admin/ai/
2. 把指令 JSON 粘贴到「指令 JSON」文本框。
3. 点击「执行」，读取「执行结果」里的 JSON。
4. 用户要求批量操作时，可以把多条指令放进一个数组，按顺序执行。

必须遵守
1. 修改前先执行 {"action":"get"}，读取当前 site / papers / 各级 id，不要凭空猜测 id。
2. 新建试卷用 upsertPaper（省略 id）；整份覆盖用 upsertPaper（带 id）；局部修改用 patchPaper。
3. 删除试卷 / 栏目 / 题目 / 图片必须传 "confirm": true，并且只能响应用户明确的删除要求。
4. 除非用户明确要求清空重建，否则不要使用 replaceAll。
5. 上传图片先执行 uploadImage，再用返回的 path 填入 images 或 answerImages，不要编造图片路径。
6. 文案使用中文；题干、答案中的换行写成 \n；日期格式 YYYY-MM-DD。
7. 所有写操作会立即提交并发到 GitHub Pages，约 1 分钟后线上生效。
8. 只输出 JSON 指令，不要输出多余解释；执行失败时根据 error 修正 JSON 后重试。
```

---

## 二、提交流程

### 有浏览器能力的 AI

1. 打开 <https://newcyr.github.io/work/admin/ai/>
2. 页面会自动显示「已连接 newcyr/newcyr.github.io · main …」，说明 Token 已解密。
3. 在左侧文本框粘贴 JSON，点击「执行」。
4. 右侧「执行结果」返回 `ok`、`paperId`、`path` 等信息；`ok: false` 时看 `error`。

### 只能生成文本的 AI

把 JSON 交给用户，让用户粘贴到页面执行即可。页面也支持「读取 .json」文件。

### 自检 / 只读

```json
{ "action": "get" }
```

返回 `site`、`papers`（含全部栏目、题目、图片路径与 id）、`summary`。

---

## 三、指令通用字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `action` | string | 必填，见下表 |
| `dryRun` | boolean | `true` 时只校验并预览，不提交 GitHub |
| `message` | string | 可选，GitHub 提交信息 |
| `confirm` | boolean | 破坏性操作必须为 `true` |

### action 一览

| action | 用途 | 关键字段 |
| --- | --- | --- |
| `get` | 读取当前全部数据 | — |
| `setSite` | 修改站点标题 / 副标题 / 公告 | `site` |
| `upsertPaper` | 新建或整份覆盖试卷 | `paper` |
| `patchPaper` | 局部修改试卷 | `paperId` 或 `title`、`patch` |
| `deletePaper` | 删除试卷并清理其图片 | `paperId` 或 `title`、`confirm` |
| `deleteSection` | 删除栏目 | `paperId`、`sectionId` 或 `sectionIndex`、`confirm` |
| `deleteQuestion` | 删除题目 | `paperId`、`sectionId`、`questionId` 或 `questionIndex`、`confirm` |
| `uploadImage` | 上传图片，返回可用 path | `data`（base64 / dataURL）、`paperId`、`filename` |
| `deleteImage` | 删除图片文件并清除所有引用 | `path`、`confirm` |
| `replaceAll` | 整体替换全部试卷 | `papers`、`confirm` |

---

## 四、试卷数据结构

```json
{
  "id": "可选，省略则自动生成",
  "title": "八年级数学 · 全等三角形 单元测",
  "subject": "数学",
  "grade": "八年级",
  "date": "2026-11-05",
  "summary": "一句话简介",
  "cover": "",
  "mode": "step",
  "sections": [
    {
      "id": "可选",
      "title": "选择题与证明题",
      "kind": "qa",
      "note": "",
      "questions": [
        {
          "id": "可选",
          "label": "1",
          "stem": "题干文字，可换行",
          "images": ["assets/uploads/<paperId>/<file>.png"],
          "answer": "参考答案",
          "answerImages": []
        }
      ]
    },
    {
      "id": "可选",
      "title": "图形资料",
      "kind": "images",
      "note": "点击图片可放大",
      "images": [
        "assets/uploads/<paperId>/a.png",
        "assets/uploads/<paperId>/b.png"
      ],
      "questions": []
    }
  ],
  "reviews": [
    { "name": "小林", "rating": 5, "text": "排版清楚", "date": "2026-11-05" }
  ]
}
```

规则：

- `mode`：`step` 打开时隐藏答案、逐题展开；`full` 打开即显示答案。
- `kind`：`qa` = 一题一答；`images` = 纯图片栏目。
- 纯图片栏目用 `images` 数组，**一个栏目不限张数**；`questions` 必须为空数组。
- 一题一答栏目里，题目图片放 `images`，答案图片放 `answerImages`，都可多张。
- `images` 里的路径可以是上传返回的相对路径，也可以是 `https://` 外链。
- `reviews` 是「精选评价」，会公开显示；访客自己写的评价只存在其本机。

---

## 五、常用示例

### 1. 新建一份试卷（一题一答 + 纯图片栏目）

```json
{
  "action": "upsertPaper",
  "message": "AI: 新建八年级物理第一单元",
  "paper": {
    "title": "八年级物理 · 第一章 单元测",
    "subject": "物理",
    "grade": "八年级",
    "date": "2026-11-05",
    "summary": "光现象基础题与图片资料",
    "mode": "step",
    "sections": [
      {
        "title": "选择题",
        "kind": "qa",
        "questions": [
          {
            "label": "1",
            "stem": "光在同种均匀介质中沿什么传播？",
            "answer": "沿直线传播。"
          }
        ]
      },
      {
        "title": "图片资料",
        "kind": "images",
        "note": "点击图片可放大查看。",
        "images": ["assets/samples/rules.svg"]
      }
    ]
  }
}
```

返回值里的 `paperId` 请记下来，后续上传图片、修改、删除都要用。

### 2. 上传图片

```json
{
  "action": "uploadImage",
  "paperId": "把上一步返回的 paperId 填在这里",
  "filename": "question-1.png",
  "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
}
```

- `data` 可以是完整 dataURL，也可以只放 base64。
- 单张建议不超过 2.5MB；大图请先压缩。
- 返回 `path` 和 `url`，把 `path` 填到题目或栏目的图片数组。

### 3. 把图片挂到题目上（局部修改）

```json
{
  "action": "patchPaper",
  "paperId": "p-xxxx",
  "patch": {
    "sections": [
      {
        "id": "原有 sectionId",
        "title": "选择题",
        "kind": "qa",
        "questions": [
          {
            "id": "原有 questionId",
            "label": "1",
            "stem": "看图回答：……",
            "images": ["assets/uploads/p-xxxx/新图片.png"],
            "answer": "……",
            "answerImages": []
          }
        ]
      }
    ]
  }
}
```

注意：`patchPaper` 里的 `sections` 是**整组替换**。只想改一道题时，也要把该栏目其他题目一起带上，或先 `get` 读出原数组再修改。

### 4. 修改站点文案

```json
{
  "action": "setSite",
  "site": {
    "title": "作业答案中心",
    "subtitle": "选择试卷，查看题目与参考答案。",
    "notice": "本周新增物理单元测答案。"
  }
}
```

### 5. 删除试卷（立即线上生效）

```json
{
  "action": "deletePaper",
  "paperId": "p-xxxx",
  "confirm": true
}
```

### 6. 删除一张图片

```json
{
  "action": "deleteImage",
  "path": "assets/uploads/p-xxxx/old.png",
  "confirm": true
}
```

会同时从所有栏目 / 题干 / 答案中移除引用，然后删除仓库文件。

### 7. 先预览、不提交

```json
{
  "action": "upsertPaper",
  "dryRun": true,
  "paper": { "title": "测试试卷", "sections": [] }
}
```

返回 `preview`，不会改动线上数据。

### 8. 批量执行

```json
[
  { "action": "get" },
  { "action": "setSite", "site": { "notice": "期中考答案已更新" } }
]
```

数组按顺序执行，遇到错误即停止。

---

## 六、错误与限制

| 返回 error | 处理方式 |
| --- | --- |
| `缺少 action 字段` | 检查 JSON 是否包含 `action` |
| `未找到 paperId` | 先 `get`，使用返回的真实 id |
| `需要在指令中加入 "confirm": true` | 破坏性操作补 `confirm` |
| `数据已被其他修改更新…` | 先 `get` 重新读取再重试 |
| `图片约 xMB，超过 2.5MB 限制` | 压缩图片后重新上传 |
| `Token 无效或已失效` | 到 `/work/admin/` 高级设置更换 Token |

其他：

- 所有写操作都会产生一次 GitHub 提交，请避免高频循环写。
- GitHub Pages 有约 1 分钟构建延迟，刚发布的内容可能短暂看不到。
- 删除操作会立即发布，无法在页面内撤销；误删可从 git 历史恢复。

---

## 七、安全提示

此页面包含管理密码并自动解锁，**任何拿到链接的人都能修改站点**。请不要把该地址发到公开群聊、README 或搜索结果中；`work/admin/ai/ai-config.js` 也包含密码。若怀疑泄露，请立即更换 GitHub Token（后台「高级设置」），并修改 `ai-config.js` 与后台密码。
