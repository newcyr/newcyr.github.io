# 课程表 JSON 格式 SDK 文档

本文档描述「班级管理小师」课程表 / 设置文件的 JSON 结构，用于手动编辑、批量生成或第三方工具导出后导入。

- 文件编码：UTF-8
- 字段命名：**camelCase**（如 `advanceMinutes`）
- 时间格式：24 小时制 `"HH:mm"`（如 `"08:00"`）
- 一份 JSON 即完整配置，导入后会整体替换当前配置
- 程序读取时兼容字段大小写不敏感、`//` 注释与尾随逗号；但建议输出标准 JSON，便于其它工具解析

---

## 1. schemaVersion 版本号

| 项目 | 说明 |
| --- | --- |
| 当前版本 | `1` |
| 字段类型 | number（整数） |
| 缺省行为 | 缺失或 ≤ 0 时按 `1` 处理 |
| 过高版本 | 大于 `1` 时**拒绝导入**，提示「schemaVersion=N 高于当前程序支持的版本（1），请升级应用。」 |
| 升级策略 | 仅在发生**不兼容变更**（字段重命名、语义变化、删除必填字段）时递增；新增可选字段不改变版本号 |
| 向后兼容 | 同一版本内新增的可选字段，旧程序会忽略；缺失的可选字段使用默认值 |

导入后程序会回写 `schemaVersion: 1`，因此导出文件始终为当前版本。

---

## 2. 字段说明

### 2.1 根对象

| 字段名 | 类型 | 必填 | 取值或枚举 | 说明 | 示例 |
| --- | --- | --- | --- | --- | --- |
| `schemaVersion` | number | 是 | 当前为 `1` | 结构版本号，大于 1 将被拒绝导入 | `1` |
| `subjects` | string[] | 是 | 非空字符串数组 | 科目列表；课程条目中的科目若不存在会自动加入 | `["语文","数学"]` |
| `defaultAdvanceMinutes` | number | 否 | 0 – 180 的整数 | 新建条目 / 手动填充使用的默认提前分钟数，超范围自动截断 | `1` |
| `ringtonePath` | string | 否 | 绝对路径或空字符串 | 自定义铃声（.mp3/.wav）路径；为空时使用内置铃声 | `"D:\\铃声\\上课铃.mp3"` |
| `timetables` | Timetable[] | 是 | 至少 1 张 | 多张课程表集合，导入时为空会自动创建「课程表A」 | 见 2.2 |
| `weekMapping` | string[7] | 是 | 每项为某个 `timetable.id` | 周几 → 课程表映射，**长度必须为 7**，下标 0=周一 … 6=周日；无效 id 会回退到第一张课程表 | `["tt-a","tt-a","tt-a","tt-a","tt-a","tt-a","tt-b"]` |
| `alarms` | AlarmItem[] | 否 | 可为空数组 | 独立闹钟，与课程条目无关 | 见 2.4 |
| `seewoAccounts` | SeewoAccount[] | 否 | 可为空数组 | 按科目配置的希沃账号 | 见 2.5 |
| `seewoLoginEnabled` | bool | 否 | `true` / `false` | 课程提醒触发后是否按科目自动登录希沃，默认 `true` | `true` |
| `startWithWindows` | bool | 否 | `true` / `false` | 是否开机自启（写入 HKCU Run），默认 `true` | `true` |

### 2.2 Timetable（课程表）

| 字段名 | 类型 | 必填 | 取值或枚举 | 说明 | 示例 |
| --- | --- | --- | --- | --- | --- |
| `id` | string | 是 | 全局唯一，建议 `tt-` 前缀 | 课程表标识，被 `weekMapping` 引用；重复或为空时自动重新生成 | `"tt-a"` |
| `name` | string | 是 | 任意文本 | 课程表显示名称，为空时自动命名为「课程表」 | `"课程表A（周一至周六）"` |
| `entries` | CourseEntry[] | 是 | 可为空数组 | 上课条目集合，导入后按时间升序排序 | 见 2.3 |

### 2.3 CourseEntry（上课条目）

> 每节课**只有上课时间，没有下课时间**；提前 N 分钟开始响铃。

| 字段名 | 类型 | 必填 | 取值或枚举 | 说明 | 示例 |
| --- | --- | --- | --- | --- | --- |
| `time` | string | 是 | `"HH:mm"`（00:00–23:59） | 上课时间；非法值导入后回退为 `"08:00"` | `"08:00"` |
| `subject` | string | 是 | 建议在 `subjects` 中 | 科目名称；若不在 `subjects` 中会被自动加入 | `"语文"` |
| `advanceMinutes` | number | 否 | 0 – 180 的整数 | 本节提前响铃分钟数，默认 `1`，超范围自动截断 | `2` |
| `note` | string | 否 | 任意文本，可为空 | 备注，仅作记录，不影响提醒 | `"开学第一课"` |

### 2.4 AlarmItem（独立闹钟）

| 字段名 | 类型 | 必填 | 取值或枚举 | 说明 | 示例 |
| --- | --- | --- | --- | --- | --- |
| `id` | string | 是 | 唯一，建议 `alarm-` 前缀 | 闹钟标识；为空时自动生成 | `"alarm-1"` |
| `time` | string | 是 | `"HH:mm"` | 闹钟时间，非法值回退 `"08:00"` | `"07:20"` |
| `label` | string | 是 | 任意文本 | 全屏提醒中「这节课是：」后面显示的名称 | `"到校提醒"` |
| `enabled` | bool | 否 | `true` / `false` | 是否启用，默认 `true` | `false` |
| `advanceMinutes` | number | 否 | 0 – 180 的整数 | 提前响铃分钟数，默认 `0` | `0` |

### 2.5 SeewoAccount（希沃账号）

| 字段名 | 类型 | 必填 | 取值或枚举 | 说明 | 示例 |
| --- | --- | --- | --- | --- | --- |
| `subject` | string | 是 | 科目名称 | 与课程条目 `subject` **完全一致**才会匹配自动登录 | `"语文"` |
| `account` | string | 是 | 希沃账号（手机号 / 账号名） | 登录账号 | `"13800000000"` |
| `password` | string | 否 | 明文或 `"dpapi:..."` 密文 | 本地落盘时以 DPAPI 密文 `"dpapi:..."` 保存；**导出 JSON 默认不含密码（空字符串）**；导入时程序会自动尝试解密 | `""` |

> 安全说明：DPAPI 密文与当前 Windows 用户绑定，复制到其它电脑后无法解密，需重新填写。

---

## 3. 完整示例

以下示例可直接保存为 `classmanager-课程表.json` 并导入：周一至周六使用课程表 A，周日使用课程表 B；含提前分钟数、一个闹钟与一个希沃账号。

```json
{
  "schemaVersion": 1,
  "subjects": ["语文", "数学", "英语", "德法", "地理", "政治", "生物"],
  "defaultAdvanceMinutes": 1,
  "ringtonePath": "D:\\铃声\\上课铃.mp3",
  "timetables": [
    {
      "id": "tt-a",
      "name": "课程表A（周一至周六）",
      "entries": [
        { "time": "08:00", "subject": "语文", "advanceMinutes": 2, "note": "开学第一课" },
        { "time": "08:55", "subject": "数学", "advanceMinutes": 1, "note": "" },
        { "time": "09:50", "subject": "英语", "advanceMinutes": 1, "note": "" },
        { "time": "10:45", "subject": "德法", "advanceMinutes": 1, "note": "" },
        { "time": "11:40", "subject": "地理", "advanceMinutes": 1, "note": "" },
        { "time": "14:00", "subject": "政治", "advanceMinutes": 1, "note": "" },
        { "time": "14:55", "subject": "生物", "advanceMinutes": 1, "note": "" }
      ]
    },
    {
      "id": "tt-b",
      "name": "课程表B（周日）",
      "entries": [
        { "time": "08:30", "subject": "数学", "advanceMinutes": 1, "note": "" },
        { "time": "09:40", "subject": "英语", "advanceMinutes": 1, "note": "" },
        { "time": "10:50", "subject": "语文", "advanceMinutes": 1, "note": "" }
      ]
    }
  ],
  "weekMapping": ["tt-a", "tt-a", "tt-a", "tt-a", "tt-a", "tt-a", "tt-b"],
  "alarms": [
    { "id": "alarm-1", "time": "07:20", "label": "到校提醒", "enabled": true, "advanceMinutes": 0 }
  ],
  "seewoAccounts": [
    { "subject": "语文", "account": "13800000000", "password": "" }
  ],
  "seewoLoginEnabled": true,
  "startWithWindows": true
}
```

---

## 4. 手动填写与 JSON 字段对照

设置页中的每一项都与 JSON 字段一一对应，手动填写后保存的内容与导入 JSON 完全等价。

| 设置页位置 / 操作 | JSON 字段 | 对应关系 |
| --- | --- | --- |
| 课程表列表 → 新建 / 删除 / 重命名 | `timetables[].id`、`timetables[].name` | 每张表一项；改名只改 `name`，`id` 不变 |
| 课程条目表格（时间 / 科目 / 提前(分钟) / 备注） | `timetables[].entries[]` | 每行对应一个 `CourseEntry` |
| 周几下拉框（周一至周日） | `weekMapping[0..6]` | 第 i 个下拉框写 `weekMapping[i]`，值为课程表 `id` |
| 科目管理（新增 / 删除） | `subjects` | 列表顺序与数组顺序一致；删除科目会同时删除其希沃账号 |
| 「上课条目默认提前分钟数」 | `defaultAdvanceMinutes` | 仅影响「按默认分钟数填充提前量」 |
| 闹钟表格（时间 / 名称 / 启用 / 提前(分钟)） | `alarms[]` | 每行一个 `AlarmItem` |
| 铃声路径输入框 / 选择 / 清空 | `ringtonePath` | 清空即为内置铃声 |
| 「闹钟触发后自动执行希沃登录」复选框 | `seewoLoginEnabled` | 勾选为 `true` |
| 「开机自动启动」复选框 | `startWithWindows` | 勾选会写入 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` |
| 希沃账号表格（科目 / 账号 / 密码） | `seewoAccounts[]` | 密码在内存中为明文，保存时加密 |
| 「导出 JSON…」 | 全部字段 | 默认导出不含密码（`password` 为空） |
| 「导入 JSON…」 | 全部字段 | 整体替换并立即保存、重新调度 |

---

## 5. 常见错误

| 错误现象 | 原因 | 处理方式 |
| --- | --- | --- |
| 提示「时间格式错误」 | `time` 不是 `HH:mm`，如 `8:00`、`08：00` 以外的写法、`25:00` | 改为两位小时 + 冒号 + 两位分钟，如 `"08:00"`；小时 00–23、分钟 00–59 |
| 周几对应课程表错乱 / 某天无课 | `weekMapping` 长度不是 7 | 必须提供 7 项，下标 0 起依次为周一至周日；缺失项会补空并回退到第一张课程表 |
| 导入失败：`schemaVersion=2 高于当前程序支持的版本（1）` | 文件来自更高版本程序 | 升级应用，或将 `schemaVersion` 改为 `1` 并移除不认识的字段 |
| 课程表 id 冲突 | 两张表 `id` 相同或为空 | 保证每个 `timetables[].id` 唯一（建议 `tt-a`、`tt-b`），程序也会自动重新生成 |
| 闹钟 id 冲突 | 多个闹钟 `id` 重复 | 使用不同 `id`，建议 `alarm-1`、`alarm-2` |
| 导入后提前量变大 / 变小 | 超出 0–180 被截断 | 填写 0–180 之间的整数 |
| 导入后科目丢失 | `subject` 与 `subjects` 不一致但为空 | `subject` 不能为空；非空科目会被自动补进 `subjects` |
| 希沃不自动登录 | `subject` 与课程条目科目不完全一致，或 `password` 为空 | 保证科目文字一致（含空格差异需去除），并重新在设置页填写密码 |
| JSON 解析失败 | 使用了注释、尾随逗号以外的非法语法，或括号不匹配 | 用 JSON 校验工具检查；建议不要手写注释 |

---

## 6. 导入 / 导出方式

1. 右键托盘图标 →「打开设置」（或双击托盘图标）。
2. 在设置页底部点击 **「导入 JSON…」**，选择 `.json` 文件。
3. 导入成功后立即保存并重新计算提醒；失败会弹出具体原因，原配置不受影响。
4. 点击 **「导出 JSON…」** 可生成 `classmanager-课程表.json`，**默认不包含密码明文**。

> 本地实际配置文件为 `%APPDATA%\ClassManager\config.json`，由程序自动维护，不建议直接编辑；如需手改，请先退出程序再操作。
