# dsh-soul

[[English](./README.md) | 简体中文]

DeepSeek Harness 的人设卡插件。在设置页里用 Markdown 写卡片，按「会话 → 工作区 → 默认卡」的顺序解析出这一轮该用哪张，作为系统提示词的一个 section 注入。模型只能读，不能写。

一个独立插件：只读写 `soul` 这一个设置命名空间，不碰别的插件的命名空间，不落磁盘文件，也没有共享状态。

> [!IMPORTANT]
> **设计取舍（按约束代码的先后顺序）**
>
> 1. **存设置，不存文件。** 卡片就是 `soul` 命名空间里的普通设置值：跟随宿主的设置热更新、在设置 UI 里可见、沿用宿主的 revision 校验。不落数据目录，也不自创文件格式。
> 2. **一个 section，一个主人。** 提示词 section 叫 `dsh-soul:persona`——按包名收窄，而不是按功能起名。宿主遇到同名 section 会在 `apply()` 里直接抛错，所以 `soul:persona` 这种通用名字恰恰是最容易撞车、把整个插件带崩的那一个。
> 3. **每次只写最小的那一个键。** 会话选择只写 `sessions.<id>`，工作区选择只写 `workspaces.<path>`。整表写入会把下层配置复制进用户层，把用户没做过的选择钉死。
> 4. **宿主点头才算存上。** 写完之后拿新快照核对一遍；`mutate` 返回成功但值没变（非 volatile 路径、revision 冲突）会被当成失败报出来，草稿留在表单里。
> 5. **对模型只读。** `persona_read` 只是让 agent 能引用自己的人设；没有写入工具、没有接受卡片正文的路由，除了用户自己写进卡片的文字之外没有别的注入面。

## 你能拿到什么

| 界面 | 位置 | 作用 |
| --- | --- | --- |
| **设置卡** | 设置 → 插件 → *人设卡* | 卡片列表、编辑器（新建 / 重命名 / 改正文 / 删除 / 设为默认）、按工作区的选择、两个开关 |
| **会话切换器** | 聊天标题栏，每个会话一个 | 给「这个会话」指定卡片，或者把这个会话的人设关掉 |
| **新会话切换器** | 新会话页的选项区 | 发第一条消息之前就能选；保存期间占住输入框 |
| **`persona_read`** | agent 的工具列表 | 返回调用方会话生效的卡片（名字、正文，以及是哪一层选中的） |
| **提示词 section** | 系统提示词 `dsh-soul:persona` | 生效卡片的正文，每一轮重新解析 |

## 卡片是怎么选出来的

解析按 agent、在拼装提示词时进行，顺序如下：

| # | 层 | 键 | 说明 |
| --- | --- | --- | --- |
| 1 | 会话 | `sessions.<sessionId>` | `"none"` 表示关掉人设，**并终止查找**——说了关的会话不会掉到工作区卡片上去 |
| 2 | 工作区 | `workspaces.<path>` | 先按原样匹配，再按规范化路径做大小写不敏感匹配（同一个 Windows 目录在不同会话里大小写会不一样） |
| 3 | 默认 | `active` | 标了 默认 的那张卡 |
| — | — | — | 都没有：section 渲染成空字符串，宿主不会把它写进提示词 |

存下来的选择如果指向一张已经不存在的卡（或正文为空白的卡），按「没有选择」处理并继续往下找，而不是悄悄把默认卡压掉。设置卡里这种工作区行会保留显示并打上标记，方便清掉。

`skipSubagents`（默认开）让被委派的子会话不注入人设：子会话本来就继承父会话的提示词，再重复一遍既费 token 又糊掉边界。解析本身不受它影响——`persona_read` 和切换器看到的仍然是「这个会话本会注入什么」。

## 设置项

| 键 | 类型 | 默认 | 含义 |
| --- | --- | --- | --- |
| `cards` | `{ [名字]: markdown }` | `{}` | 卡片本体。空名字、空正文会被拒绝；`__proto__` 与 `prototype` 不能当名字 |
| `active` | `string` | `""` | 默认卡的名字 |
| `sessions` | `{ [sessionId]: 卡名 \| "none" }` | `{}` | 按会话的选择 |
| `workspaces` | `{ [路径]: 卡名 \| "none" }` | `{}` | 按工作区的选择 |
| `showPersonaSwitcher` | `boolean` | `true` | 是否在聊天标题栏和新会话页显示切换器 |
| `skipSubagents` | `boolean` | `true` | 是否跳过子会话的人设注入 |

全部是 volatile 的，设置页改了立刻生效，不用重启。

## 兼容性

- dsh `>=0.2.0-rc.2 <0.3.0-0`，并且在 `dsh.compatibility` 里逐个列出了 `0.2.1-rc.1` … `0.2.1-rc.5`
- Node `>=20.18`
- 客户端平台 `web`；包声明支持 `web` 与 `desktop` 两个 profile
- React 18 作为 peer（由宿主提供）

bundle patch（`cordis.patch.yml`）声明的加载器条目是 `id: soul`。这个 id **就是**设置命名空间：改名等于把所有已存的卡片弄丢。

## 值得知道的内部细节

设置卡背后是一个同源 `POST` 接口。`/api` 下的精确路由不过宿主的围栏，所以它们自己做检查：非 JSON 请求 `415`，跨站 `Origin`（包括 `Origin: null`，以及 `Sec-Fetch-Site` 声明跨站）`403`。判定同源用的是 `Origin` 的 host 与请求的 `Host` 头比较——**不是**与 `request.url` 比较：宿主在把请求交给路由之前会把 URL 重写成 `http://dsh.internal` 这个合成基址，拿 URL 比会把每一次真实调用都拒掉。完全没有 `Origin` 头的调用放行，那是本地脚本或桌面端的发法。

| 路由 | 用途 |
| --- | --- |
| `/api/soul/workspaces` | 列出宿主的工作区，让设置卡按标题显示 |

它返回 `{version: 1, …}`；版本对不上按「不可用」处理，不去猜。

设置卡是手写的 ModuleLoader bundle，样式全部取自宿主主题变量（`--dsw-alias-*`、`--dsw-radius-*`、`--dsw-focus-ring-*`），没有一个写死的颜色，所以明暗主题都不用兜底表。类名统一 `__sl_` 前缀：和别的插件共用类名，会让后加载的那个把前一个的样式也改掉。开关优先用宿主自带的 `Switch`（需要能 `require` 到 `@deepseek-ai/dsh-client-ui-primitives`），拿不到就渲染一个行为等价的自绘开关——手写 bundle 不能指望那个模块一定可 require。所有控件都是立刻写入，一个动作一批操作：不做整页保存栏，因为卡片列表上的草稿编辑器会把用户的意图弄丢。

## 开发

```bash
npm install --cache ./.npm-cache    # 本地缓存，避免沙箱去写 %LOCALAPPDATA%
npm test
```

`npm test` 在同一个进程里跑 110 个测试（`--experimental-test-isolation=none`：受限沙箱里测试运行器 fork 子进程会失败）：

- `persona.test.mjs` —— 解析顺序、`none` 哨兵值、过期与空白选择、路径规范化、子会话门
- `routes.test.mjs` —— 请求守卫（415 / 403 / 同源）、构建失败、版本信封
- `host-plugin.test.mjs` —— 用一个假宿主验证插件面：section 注册、工具 schema、工作区路由、重名行为
- `host-contract.test.mjs` —— 同样这些断言打真实的 `@deepseek-ai/cordis` + `dsh-system-prompt` + `dsh-tools`，包括 disposer 真的会注销
- `client-bundle.test.mjs` —— bundle 卫生：loader id、require、注入的服务、slot 元信息、中英词条对齐、没有死词条
- `client-settings.test.mjs` —— 用真组件驱动设置卡：新建、重命名（同一批）、两次点击删除、单键写入、被拒绝、只读
- `client-switcher.test.mjs` —— 会话切换器：三种状态、单键写入、隐藏、占住输入框

客户端测试把出货的 `client.js` 载入一个小型 hooks 运行时，而不是复制一份代码，所以断言打的就是真正发布出去的那个文件。

## 许可

MIT
