# 🐋 DeepSeek 鲸鱼娘桌宠 · deepseek-whale-pet

一只住在桌面角落的小鲸鱼娘：帮你盯着 DeepSeek 余额，陪你学习，还记得你们相处了多少天。

仓库里有两个版本，任选其一（两版有单实例锁，**不要同时开**）：

| 版本 | 技术栈 | 适合谁 |
|---|---|---|
| [affection-edition](affection-edition/) · 好感版 | Electron | 想要完整体验：好感养成、学习陪读、散步、成就图鉴（当前 v7） |
| [classic-edition](classic-edition/) · 原版 | Python（tkinter） | 想要零依赖、单文件、跑起来就完事 |

> **来源与素材声明（先读这段）**
> 好感版代码改编自 [comreade-123/DeepSeek-Whale-widget-desktop](https://github.com/comreade-123/DeepSeek-Whale-widget-desktop)（MIT），其上游为 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（MIT）。
> 原项目声明：**`assets/` 下的美术素材（图片 / 动图 / 音效）不在 MIT 覆盖范围内、不授予再许可**，因此本仓库**不包含、也不分发**这些素材；补法见[「关于素材」](#关于素材)。
> 原版的鲸鱼娘立绘是作者用 AI 工具生成并加工的原创素材，随本项目一并开源。

## ✨ 功能特性

### 好感版（Electron）

- 💰 **余额监控**：实时查询 API 余额与今日消费，余额变化数字滚动动画，点击小鲸鱼立刻刷新
- 💹 **峰谷播报**：按 DeepSeek 定价时段播报（工作日 9:00–12:00 / 14:00–18:00 为峰时），菜单里实时显示距下次切换的倒计时
- ⚠️ **低余额预警**：余额过低时提醒你充值
- 💗 **好感度养成**：摸头、戳一戳、喂米饭、闲聊互动；好感越高台词越丰富，还有等级、相伴天数与互动统计
- 📚 **学习陪读**（学生党定制）：番茄钟专注、四级单词卡与复习、喝水提醒、课表管家（上课前提醒）、倒数日、待办清单
- ☀️ **天气**：实时天气与雨天带伞提醒（数据来自 wttr.in 免费接口）
- 🚶 **Shimeji 式散步**：会在桌面闲逛、爬上屏幕顶端探头喊话、跳下来还会"嗷"一声
- 🌙 **深夜打盹**：深夜无人理会就冒 Zzz；🎉 节日彩蛋；💸 充值庆祝
- 🎮 **小游戏**：干饭转盘、猜数字
- 🏆 **18 枚成就图鉴**、便签、自定义提醒、本周花费统计
- ⚙️ **实用**：开机自启、缩放 / 音量可调、低余额预警线可设
- 🗣️ 所有台词与互动全部离线，不额外消耗 API 额度

### 原版（Python）

- 💰 DeepSeek 余额查询 + 充值自动检测 + 累计充值 / 已消费统计
- 💬 AI 聊天：接 DeepSeek 官方接口，人设写在 `prompt.txt`（可编辑），保留上下文
- 💗 好感系统：聊天 / 摸头 / 喂米饭 / 每日见面涨好感，6 个等级
- 🚶 8 帧走路动画、随机漫步 / 跟随鼠标 / 原地三种模式、待机蹦跳、拖动甩出
- 🎈 游戏风对话气泡、打字机效果、悬停互动光环（💬🖐🍚♥）
- 🖥️ 天气查询、CPU / 内存 / 显卡温度监控、系统托盘、鼠标穿透、深夜打盹
- 🧩 单文件源码（约 2000 行），只用标准库 + Pillow（可选）；音效运行时自动合成

## 📸 截图

> 运行截图还没放上来——欢迎先自己跑起来看看，或截图投稿 PR 👀

<!-- 有截图后：放进 docs/ 文件夹并取消下面的注释
![好感版运行截图](docs/affection.png)
![原版运行截图](docs/classic.png)
-->

## 🚀 快速开始

### 好感版（Electron）

环境：Windows 10/11 x64、Node.js ≥ 18。

```bash
cd affection-edition
npm install
npm start
```

**首次运行前**：请先按 [renderer/assets/README.md](affection-edition/renderer/assets/README.md) 准备美术素材——本仓库不含上游素材，缺了图片小鲸鱼会"隐身"。

配置 API Key：鼠标悬停小鲸鱼 → 右上角出现 ☰ 菜单 → 在 API_KEY 行粘贴 `sk-` 开头的 Key → 保存。Key 会用 AES-256-GCM 加密写入本地 `userdata.json`，明文不落盘、不会进版本库。

更细的功能与菜单说明（28 行菜单逐项）见 [USAGE.txt](affection-edition/USAGE.txt)。

> 国内网络提示：`npm install` 慢的话，先 `npm config set registry https://registry.npmmirror.com`；Electron 二进制下载卡住时，设环境变量 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 后重试。

### 原版（Python）

环境：Python 3.10+（tkinter 为标准库自带）。

```bash
cd classic-edition
python whale_pet.py
```

1. 同目录放一个 `key.txt`，第一行写 `sk-` 开头的 DeepSeek API Key（不填也能看形象，但不能查余额 / 聊天）
2. 鲸鱼娘图片已包含在仓库中；音效（`pop.wav` / `boing.wav`）首次运行自动合成
3. 操作：拖动移动、滚轮缩放、右键菜单（聊天 / 摸头 / 喂米饭 / 天气 / 移动模式 / 使用说明……）、单击她会有反应

## 🎮 好感版互动速览

| 操作 | 效果 |
|---|---|
| 单击 | 刷新余额并弹气泡 |
| 2 秒内连点 3 次 | "戳一戳"，戳多了她偶尔会反击 |
| 悬停 | 出现右上角 ☰ 菜单 |
| 拖拽 | 移动窗口；快速甩出会滑行一段再停下 |
| 菜单 → 摸头 / 喂米饭 | 加好感（有冷却），解锁更多台词 |

☰ 菜单里还有：番茄钟、四级单词、课表管家、天气、倒数日、待办、便签、自定义提醒、干饭转盘、猜数字、成就图鉴、本周花费、峰谷时段、散步开关、喝水提醒、开机自启、使用说明与重置等，逐项说明见 [USAGE.txt](affection-edition/USAGE.txt)。

## 🔐 数据与安全

- **API Key**：好感版用 AES-256-GCM 加密存储（密钥由内置 pepper + 本机标识经 PBKDF2 派生），明文只出现在主进程内存；原版存于本地 `key.txt` 明文文件（仅本机使用，已在 `.gitignore` 中）
- **数据文件**：好感版 `userdata.json`（设置 / 密钥 / 记账）+ `affection.json`（好感 / 成就 / 统计）；原版 `state.json`、`pet_pos.txt`、`total_charged.txt` 等
- **存储位置**：好感版打包版为 EXE 同目录，开发模式（`npm start`）为项目目录；原版为程序同目录
- **网络访问**：仅 DeepSeek 官方接口（余额 / 聊天）+ 天气接口 wttr.in，除此无其他外联
- **换机器**：好感版需重新填 Key（加密绑定本机标识）；原版把 `key.txt` 拷过去即可

## 📁 目录结构

```text
whale-pet/
├── README.md
├── LICENSE                      # MIT
├── affection-edition/           # 好感版（Electron）
│   ├── main.js                  # 主进程：窗口 / IPC / 数据文件 / 开机自启
│   ├── preload.js               # contextBridge：window.whaleAPI
│   ├── lib/core.js              # 核心逻辑：配置 / 加密 / 余额 / 记账 / 峰谷
│   ├── renderer/
│   │   ├── index.html
│   │   ├── widget.js            # 界面逻辑：好感 / 学习 / 散步 / 成就……
│   │   └── assets/              # 素材目录（本仓库为空，见其中的 README.md）
│   ├── package.json
│   └── USAGE.txt                # 好感版完整使用说明
└── classic-edition/             # 原版（Python）
    ├── whale_pet.py             # 单文件主程序
    ├── prompt.txt               # 聊天人设（可编辑）
    ├── start_pet.bat            # 启动器
    └── pet.png / pet_walk_a~h.png / whale_girl.ico   # 原创立绘与图标
```

## ❓ 常见问题

- **小鲸鱼隐身 / 只有气泡没有身体**：好感版缺素材，按 [assets/README.md](affection-edition/renderer/assets/README.md) 补齐图片即可
- **好感版的素材从哪来**：上游素材未授权再分发，本仓库不能附带；可在上游官方发布版中找到同名文件（仅限个人运行使用），也欢迎用自己的图片替换（文件名保持一致）
- **为什么仓库里没有鲸鱼图片和音效**：见[「关于素材」](#关于素材)
- **余额显示"未配置"**：好感版在 ☰ 菜单里填 API Key；原版检查 `key.txt` 首行是否为 `sk-` 开头
- **今日已用显示 `--`**：记账模式需要先观测到一次余额（60 秒内自动完成）
- **没有声音**：确认素材目录下有对应音频文件；缺失时静默降级，不影响功能
- **两个版本能同时开吗**：不能，有单实例锁，会互相顶掉
- **怎么换形象**：替换同名图片即可，无需改代码（好感版 `DSniang1.png`；原版 `pet.png` / `pet_walk_*.png`）
- **怎么改台词 / 人设**：好感版台词池在 `renderer/widget.js`；原版聊天人设编辑 `prompt.txt`
- **怎么打包成 EXE**：原版用 PyInstaller：`py -m PyInstaller --onefile --noconsole --name WhalePet --icon whale_girl.ico whale_pet.py`；好感版可用 electron-builder（也可直接下载上游发布好的桌面版）

## 开发与维护提示

- 好感版冒烟测试：`npx electron . --smoke`（约 5 秒自动退出，结果写 `%TEMP%\dsh-whale-smoke-result.log`）；`lib/core.js` 不依赖 Electron，可直接单独测试
- 原版自检：`python whale_pet.py --selftest`（约 3.5 秒自动退出并写 `selftest.log`）；日志 panic 时写 `crash.log`

## 关于素材

| 素材 | 来源 | 是否包含在仓库 |
|---|---|---|
| 好感版代码 | 改编自 [comreade-123/DeepSeek-Whale-widget-desktop](https://github.com/comreade-123/DeepSeek-Whale-widget-desktop)（MIT），其上游为 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（MIT） | ✅（MIT） |
| 好感版图片 / 音效（DSniang*.png、rua.gif、*.mp3） | 源自 MeteorNOX 项目素材，**上游 PROVENANCE.md 声明不在 MIT 范围内、不授予再许可** | ❌ 请自行获取 |
| 原版立绘（pet.png、pet_walk_*.png、whale_girl.ico） | 本仓库作者 AI 生成并加工 | ✅（随本项目 MIT） |
| 原版音效（pop.wav、boing.wav） | 程序首次运行时自动合成，无外部来源 | ✅ 无需包含 |

> 想给好感版补素材：从上游官方发布的完整程序中提取同名文件，放入 `affection-edition/renderer/assets/`（仅限个人使用）；或直接用你自己画的图替换。**也欢迎 PR 可自由分发的替代素材。**

## 🙏 致谢

- [comreade-123/DeepSeek-Whale-widget-desktop](https://github.com/comreade-123/DeepSeek-Whale-widget-desktop) —— 好感版代码的直接上游（桌面版改造）
- [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) —— 一切的原点，原版小鲸鱼娘挂件的作者
- 以及所有 DeepSeek 生态的开源贡献者

## 📄 License

代码部分以 [MIT](LICENSE) 协议开源；素材部分的授权以上文[「关于素材」](#关于素材)表格为准。

如果这只小鲸鱼让你开心，欢迎点个 Star ⭐
