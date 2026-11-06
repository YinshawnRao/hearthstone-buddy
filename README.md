# hs-coach

炉石传说**对局参谋**：读取 Power.log，整理场面，请模型给出下一步建议。

Hearthstone decision coach. It reads the same Power.log Hearthstone Deck Tracker and Firestone use, builds a board, and asks a model what to play next.

这是桌面端的分析工具，不是外挂脚本。它**不会**移动鼠标、模拟点击或拖拽，也**不会**向炉石进程注入任何操作。

This build does not auto-play. It does not move the mouse, synthesize clicks or drags, or inject input into the Hearthstone process. Extending it into a bot would likely conflict with Blizzard’s Terms of Service. Don’t.

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

每次启动炉石，通常会在 Logs 目录下新建一个会话文件夹，例如 `Hearthstone_2026_04_01_12_00_00/Power.log`。hs-coach 会在候选目录里挑选**修改时间最新**的 `Power.log`（也认 `power.log`）。也可以在设置里指定文件或目录。

Each launch usually creates a session folder such as `Hearthstone_2026_04_01_12_00_00/Power.log`. hs-coach follows the newest `Power.log`. You can override the file or folder in Settings.

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
- 可选下载 HearthstoneJSON，让未知 CardID 显示卡名
- 更完整的记牌，以及以后再考虑 Hearthstone Deck Tracker 插件
- 不会做：自动代打

## 开发 / Scripts

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Electron 开发窗口 |
| `npm test` | 解析器、建议 JSON、日志路径 |
| `npm run typecheck` | 桌面端和解析器的 TypeScript |
| `npm run build` / `npm start` | 构建并用 Electron 打开产物 |

`.gitignore` 已忽略 `node_modules`、`dist`、`out`、`.env`、`config.json` 和日志文件。
