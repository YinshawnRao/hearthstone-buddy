# 炉石 Buddy

炉石 Buddy（Hearthstone Buddy）是桌面陪伴：原创角色「澄」和你一起看炉石，用气泡说出下一手。她不操作鼠标，不注入游戏。

仓库地址目前仍是 `https://github.com/YinshawnRao/hs-coach`。计划中的 GitHub 名称是 `hearthstone-buddy`，远程仓库要等合并后再由维护者改名。npm 包已经是 `@hearthstone-buddy/desktop` 和 `@hearthstone-buddy/parser`。旧的 `%APPDATA%\hs-coach\config.json`（以及 macOS / Linux 上对应的 hs-coach 用户目录）会在新的 `hearthstone-buddy` 配置不存在时被读入，密钥不会写进仓库。

当前切片：启动器、Windows 启动交接、透明陪伴窗口、本地规则分析和可选语音适配。没有做出可下载的已签名安装包。`apps/desktop/electron-builder.yml` 只是未签名 Windows 配置，这次没有在 Windows 上打过包，也没有在真机上验证全屏覆盖。

产品计划在 `docs/product/`。澄的画和授权在 `docs/characters/cheng.md`。

炉石传说**对局参谋**仍然读取 Power.log，整理场面，再给出下一步建议。

Hearthstone decision coach. It reads the same Power.log Hearthstone Deck Tracker and Firestone use, builds a board, and asks a model what to play next.

这是桌面端的分析工具，不是外挂脚本。它**不会**移动鼠标、模拟点击或拖拽，也**不会**向炉石进程注入任何操作。

This build does not auto-play. It does not move the mouse, synthesize clicks or drags, or inject input into the Hearthstone process. Extending it into a bot would likely conflict with Blizzard’s Terms of Service. Don’t.

## 启动器与陪伴 / Launcher and companion

打开应用后先是启动器。可以选「澄」、填写模型和 Power.log、选择 `Hearthstone.exe` 或 `Battle.net.exe`，再点「启动炉石」或「只开陪伴（不启动炉石）」。

Windows 只会查看两个固定注册表项（炉石的 `InstallLocation` 和 Battle.net 的 `InstallPath`）以及默认的 Program Files 路径，不会扫描整块硬盘，也不会偷偷改 `log.config`。非 Windows 环境不会运行 `reg.exe`。找到 Battle.net 时使用 `battlenet://hs` 交接。登录发生在 Battle.net 自己的窗口。Buddy 不收集密码。启动失败会留在启动器上。成功只表示系统接受了请求，不表示对局已经开始。

macOS 会明确写「尚未在真机验证」，不会假装启动成功。

陪伴窗口是另一个透明、无边框、置顶的窗口。气泡先说下一手，再允许展开理由。安静模式不主动开口。同一局面不会反复朗读。场面变化会取消上一次语音。

语音默认关闭。`command` 后端需要你自己提供开源程序的绝对路径，参数里单独放一行 `{{text}}`，不会走 shell。`os-speech` 是 Windows 的 System.Speech，不是随应用打包的开源语音。这台开发环境没有安装 espeak-ng，所以没有做端到端中文出声；测试覆盖了参数合同、失败和取消。

全屏独占时覆盖层可能看不见。建议无边框窗口或窗口化。这一点没有在真实 Windows 上验证。

## 环境 / Requirements

- Node.js 20+
- Windows 是主要目标。macOS 用同一套命令即可编译运行。
- Windows is the primary target. The same commands build and run on macOS.

```bash
npm install
npm run dev
```

生产构建后本地预览 / preview a production build:

```bash
npm run build
npm start
```

测试解析器 / parser tests:

```bash
npm test
```

## 打开 Power.log / Enable logging

先完全退出炉石。创建或编辑 `log.config`（纯文本，不要存成 `log.config.txt`）。

Quit Hearthstone first. Create or edit `log.config` as plain text, not `log.config.txt`.

| | 路径 / Path |
| --- | --- |
| Windows | `%LOCALAPPDATA%\Blizzard\Hearthstone\log.config` |
| macOS | `~/Library/Preferences/Blizzard/Hearthstone/log.config` |

写入 / Add:

```ini
[Power]
LogLevel=1
FilePrinting=true
ConsolePrinting=false
ScreenPrinting=false
Verbose=true
```

保存后重新启动炉石。日志从下一次启动才开始写。

Restart Hearthstone after saving. Logging starts on the next launch.

炉石会按文件大小截断日志。如果对局后半段读不到，在**游戏安装目录**的 `client.config` 里加上（很多记牌器已经写过）：

If logs get cut off mid-game, add this to `client.config` in the Hearthstone install folder:

```ini
[Log]
FileSizeLimit.Int=-1
```

### 日志文件在哪 / Where Power.log is written

每次启动炉石，通常会在 Logs 目录下新建一个会话文件夹，例如 `Hearthstone_2026_04_01_12_00_00/Power.log`。Buddy 会在候选目录里挑选**修改时间最新**的 `Power.log`（也认 `power.log`）。也可以在设置里指定文件或目录。

Each launch usually creates a session folder such as `Hearthstone_2026_04_01_12_00_00/Power.log`. Buddy follows the newest `Power.log`. You can override the file or folder in Settings.

**Windows（优先自动探测）**

1. `%LOCALAPPDATA%\Blizzard\Hearthstone\Logs`
2. 若仍写在安装目录，还会探测 `%ProgramFiles(x86)%\Hearthstone\Logs` 和 `%ProgramFiles%\Hearthstone\Logs`

**macOS**

不要用 `~/Library/Logs/Unity/Player.log`。那是通用 Unity 输出，不是炉石的对局协议日志。

Do not use `~/Library/Logs/Unity/Player.log`. That is generic Unity output, not Hearthstone’s Power log.

macOS 上启用日志的配置文件是 `~/Library/Preferences/Blizzard/Hearthstone/log.config`。Power.log 本身在炉石安装目录的 Logs 里，Battle.net 默认安装为：

- `/Applications/Hearthstone/Logs/Power.log`，或
- `/Applications/Hearthstone/Logs/Hearthstone_YYYY_MM_DD_HH_MM_SS/Power.log`

这是 HSTracker 读取的位置。若游戏装在其他磁盘，把那个 `Logs` 目录或其中的 `Power.log` 填进设置。程序还会额外看一眼 `~/Library/Logs/Blizzard/Hearthstone`，防止个别版本把文件日志改写到用户目录。

The config file is `~/Library/Preferences/Blizzard/Hearthstone/log.config`. The log HSTracker reads is under the install, normally `/Applications/Hearthstone/Logs`. A custom install needs that path in Settings. `~/Library/Logs/Blizzard/Hearthstone` is only a fallback probe.

## 模型 / Models

打开右上角「设置」。密钥只写在本机 Electron `userData` 的 `config.json`（文件权限 600），不会进仓库。

Open Settings. API keys stay in the local Electron `userData/config.json` (mode 600). They are never committed.

| 来源 | 何时使用 | 密钥 |
| --- | --- | --- |
| OpenAI 兼容 | OpenAI、DeepSeek，或任何 `/chat/completions` 网关 | 云端需要。Base URL 指向本机时可留空 |
| Anthropic | Claude 官方接口 | 需要 |
| Ollama | 本机模型 | 不需要 |

OpenAI 兼容的 Base URL 要带 `/v1`，例如：

- OpenAI: `https://api.openai.com/v1`，模型 `gpt-4o-mini`
- DeepSeek: `https://api.deepseek.com/v1`，模型 `deepseek-chat`
- Ollama: `http://127.0.0.1:11434/v1`，模型名与 `ollama list` 一致
- 本地代理 / Codex 风格网关：把 Base URL 指到代理提供的 OpenAI 兼容地址即可

本地先启动 Ollama（`ollama serve`）再分析。请求超过 30 秒会超时，模型返回无法解析时界面会给出失败说明，而不是假装有建议。

Calls time out after 30 seconds. A response that is not the expected JSON is shown as a failure, not as advice.

默认不会在每次场面变化时自动请求。需要的话再打开「场面变化时自动分析」。

Auto-analyze is off by default.

用户目录大约是：

- Windows: `%APPDATA%\hs-coach\config.json`
- macOS: `~/Library/Application Support/hs-coach/config.json`

## 演示模式 / Demo mode

没有装炉石也可以看界面。点「演示局面」会铺一局法师对猎人的样例：手牌、嘲讽、圣盾、冻结和候选动作都来自内置的一段 Power.log，不是手写的假对象。

Demo mode parses a built-in Power.log excerpt (mage vs hunter). It is the same parser as live play.

没有配置模型时，窗口仍会打开，建议栏会说明该怎么填。配好 OpenAI 兼容接口、Anthropic 或 Ollama 之后，点「分析局面」。

With no key configured, the window still opens and the advice panel explains what to fill in.

点一张手牌或随从会放大那张卡的官方风格渲染。这只是查看，不会替你打出这张牌。

## 卡牌数据与插画 / Card data and art

场面用 [HearthstoneJSON](https://hearthstonejson.com/)（HearthSim 维护的社区数据，不是从炉石客户端里拆出来的文件）。

The board uses [HearthstoneJSON](https://hearthstonejson.com/), the community data set maintained by HearthSim. Nothing here is scraped from the Hearthstone client, and no client binaries are shipped.

| 内容 | 地址 |
| --- | --- |
| 卡牌 JSON（简体中文，可收集卡） | `https://api.hearthstonejson.com/v1/latest/zhCN/cards.collectible.json` |
| 整卡渲染 | `https://art.hearthstonejson.com/v1/render/latest/zhCN/256x/{cardId}.png` |
| 原画 | `https://art.hearthstonejson.com/v1/256x/{cardId}.jpg` |
| 英雄肖像 | `https://art.hearthstonejson.com/v1/heroes/latest/256x/{cardId}.png` |

仓库里已经带了一份精简目录 `apps/desktop/src/renderer/public/cards/catalog.json`（含 `dbfId`、名字、费用、攻防、稀有度、系列），以及演示局面用到的渲染、原画和英雄肖像。演示模式因此可以离线显示这些卡。

A slim catalog and the demo card renders/portraits are vendored, so demo mode still shows those cards offline.

其它 CardID：界面先找本地文件，没有再请求 `art.hearthstonejson.com`。两边都失败时，用带稀有度描边的占位卡，而不是空白。

Other card ids try the local file, then the art CDN, then a rarity-framed placeholder.

刷新 / refresh:

```bash
npm run cards:refresh
```

这会重新下载 zhCN `cards.collectible.json` 并覆盖演示卡的图片。图片 API 的说明见 [HearthstoneJSON images](https://hearthstonejson.com/docs/images.html)：可以无偿使用，但高流量站点应自行托管，商业用途请联系 `contact@hearthsim.net`。炉石传说是暴雪娱乐的商标；本项目与暴雪无关。

Hearthstone is a trademark of Blizzard Entertainment. This project is unofficial and is not affiliated with Blizzard.

## 决策基础 / Decision foundation

分析走的是本地规则，不是每次去搜攻略。模型只在你配置了接口之后才会被调用，而且只能引用当前合法动作编号。

Analysis goes through local rules. A model is called only after an endpoint is configured, and it may cite only current legal action ids.

| 内容 | 位置 |
| --- | --- |
| 规则版本、已检查范围、明确没模拟的机制 | `packages/parser/knowledge/manifest.json` |
| 通用启发式（节奏、场面、资源、斩杀、生存、铺场、顺序） | `packages/parser/knowledge/general.json` |
| 不在可收集目录里的英雄技能 | `packages/parser/knowledge/supplements.json` |
| 卡牌印刷值 | `apps/desktop/src/renderer/public/cards/catalog.json` |
| 可选卡组/原型 | `packages/parser/knowledge/archetypes/<id>.json`，只有代码显式传入 id 才读取 |

`general.json` 里的原则不是必须执行的规则，也不是当前环境的对阵表。没有对应的 archetype 文件时，不会编造卡组指南。

已检查：我方主要阶段、日志里的费用和法力、攻击次数/冻结/冲锋/突袭/风怒/召唤失调、嘲讽只限制攻击、潜行和免疫、场面 7 个随从上限、英雄技能费用和使用状态。缺标签时保持未知，不会当成 0。

没有模拟：发现、随机、抉择、连击、法强、亡语、光环、战吼、奥秘效果、对手手牌内容、牌库和后续抽牌。斩杀只比较当前能打到脸上的攻击力与英雄剩余生命。

印刷费用/攻防和日志里的当前数值会一起交给分析。减费或增益不会被卡面数值盖掉。目录里找不到的 CardID 会标明缺失。

给模型的系统提示由 `buildSystemPrompt()` 从上述文件生成。它要求只看这次 JSON，不搜索网页，不编造对手手牌，并且 `actionId` 必须来自 `legal_actions`。非法编号会被拒绝。

没有密钥时，点「本地分析」会直接给出这套离线建议。

## 架构 / Architecture

```
apps/desktop     Electron + Vite + React 界面与模型请求
packages/parser  Power.log 增量解析、场面、启发式合法动作
```

- 只消费 `GameState.DebugPrintPower()`。`PowerTaskList` 里的重复行在见到 GameState 之后会忽略，避免标签被加两次。
- 主进程盯日志（新会话文件夹或文件被截断时会重新读），通过 preload 把场面推到界面。
- 渲染进程没有 Node，也没有密钥。模型请求在主进程发出。
- 发给模型的是压缩 JSON（场面 + `legal_actions`）。要求返回 `{ summary, steps[], risk }`。
- 候选动作是启发式的：费用、嘲讽、冻结、冲锋/突袭、英雄技能。还不是服务器下发的 Options 包，复杂战吼和指向规则会漏。

The legal-action list is a heuristic (mana, taunt, freeze, charge/rush, hero power). It is not the server Options packet yet.

## 路线图 / Roadmap

- macOS 安装体验、签名和菜单栏
- 用 Options 包替换启发式动作，补上地标、奥秘和战吼目标
- 按需缓存更多卡图到用户目录，而不是把全套渲染都放进仓库
- 更完整的记牌，以及以后再考虑 Hearthstone Deck Tracker 插件
- 不会做：自动代打

## 开发 / Scripts

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Electron 开发窗口 |
| `npm test` | 解析器、建议 JSON、日志路径 |
| `npm run typecheck` | 桌面端和解析器的 TypeScript |
| `npm run build` / `npm start` | 构建并用 Electron 打开产物 |
| `npm run cards:refresh` | 重新下载 HearthstoneJSON 目录和演示卡图 |

`.gitignore` 已忽略 `node_modules`、`dist`、`out`、`.env`、`config.json` 和日志文件。
