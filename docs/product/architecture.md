# 架构

```
Power.log -> parser snapshot -> rules/legal actions -> card catalog
          -> advice (offline or model) -> bubble policy -> animation + optional TTS
```

- 启动器窗口负责模型、日志、游戏路径和角色选择。
- 启动成功只表示操作系统接受了进程或 `battlenet://hs`。登录留在 Battle.net 自己的窗口。
- 陪伴窗口是另一个无边框、透明、置顶的 BrowserWindow。它不注入游戏。
- 模型只能引用 `legal_actions` 里的编号。人物语气不能改编号，也不能补全对手手牌。
- 同一局面的同一句话有冷却。快照变化会取消上一次朗读。
- 安静模式不主动开口。

全屏独占时，透明窗口可能看不见。建议使用无边框窗口或窗口化。这一点还没有在真实 Windows 桌面上验证。
