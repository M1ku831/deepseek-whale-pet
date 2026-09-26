# -*- coding: utf-8 -*-
"""鲸鱼娘桌宠 · DeepSeek 余额版 v6

一只会自己走路、会聊天、有感情的桌宠：
  - 自由行走：随机漫步，转身面朝行进方向，走路时轻轻上下浮动
  - 对话互动：聊天窗口 + DeepSeek chat 接口（deepseek-flash），人设可改 prompt.txt
  - 好感系统：聊天+1、摸头+2、喂米饭+5、每天见面+2，好感影响称呼
  - 查余额：左键点击弹出漫画风对话气泡，每 5 分钟自动查询
  - 右上角 × 退出；滚轮/右键菜单调大小；位置、大小、好感、行走开关都自动记忆

v3 新增（参考 DeepSeek-Balance-Whale-Widget 网页版挂件）：
  - QQ弹弹：按下去被压扁、松手弹回来，配"啵嘤"音效（右键菜单可关音效）
  - 数字滚动：余额变化时，气泡里的数字滚动着跳到新值
  - 今日已用：按余额差值自动统计当天花费，跨天自动归零
  - 余额预警：低于设定值弹提醒，右键菜单"设置余额预警线"（填 0 关闭）
  - 台词升级：台词带权重、不会连续重复；低谷时段（00:30-08:30）偶尔提醒省钱
  - 断网容错：网络抖动时沿用最近一次余额，不再反复弹错误气泡

v4 新增（参考 dafeiyu-pet「大肥鱼」PySide6 桌宠）：
  - 移动模式：自由散步 / 跟随鼠标 / 原地待着（右键菜单切换）
  - 系统监控：CPU、内存占用过高时冒泡提醒（右键菜单可关）
  - 天气查询：右键"查看天气"，"设置城市…"可改（留空自动定位）
  - 系统托盘：托盘常驻小鲸鱼，可显示/隐藏；新增"鼠标穿透"玩法
  - 小动作：待机时偶尔蹦跳，单击也会跳一下，拖动松手会抱怨
  - 心声：偶尔冒一句灰色斜体的心里话
  - 视角素材：把 pet_back.png / pet_front.png 放旁边，走路上下时会自动切视角

v5 新增（本轮自主优化）：
  - 修复：喂米饭触发好感升级时崩溃（crash.log 里 TypeError 的元凶）
  - 健壮：状态文件全部改成原子写入，断电也不会写坏；崩溃日志带时间戳和完整堆栈
  - 玩法：拎起来快速甩出去会滑行，撞到屏幕边还会弹一下
  - 玩法：深夜（23:00-07:00）没人陪会自己打盹，戳一下唤醒
  - 体验：气泡打字机逐字显示；余额上涨（充值）时鲸鱼娘会庆祝
  - 体验：聊天时鲸鱼娘知道当前时间/余额/好感度，回答更贴当下
  - 新手友好：右键菜单新增"使用说明"；开机问候语跟着时段变化

v6 新增（清晰度与流畅度专项，参考桌面宠物开源项目）：
  - 清晰度：立绘和走路帧全部做过锐化增强（原图备份在 backup_pre_hd 文件夹）
  - 清晰度：开启 DPI 感知，以后系统缩放调到 125%/150% 也不会被拉糊
  - 流畅度：走路帧从 160ms/帧提速到 75ms/帧（约 13 帧/秒），步子更连贯
  - 流畅度：位置刷新从 40ms 提到 30ms，并改成按真实时间匀速移动，不再忽快忽慢
  - 流畅度：上下浮动改成按真实时间推进，帧率波动时步频依然稳定

打包：PyInstaller --onefile --noconsole（PIL 随包打入）。
"""
import ctypes
import json
import math
import os
import queue
import random
import struct
import sys
import threading
import time
import traceback
import tkinter as tk
import tkinter.font as tkfont
import tkinter.simpledialog as simpledialog
import urllib.error
import urllib.parse
import urllib.request
import wave
from pathlib import Path

try:
    import winsound
    HAS_SOUND = True
except ImportError:
    HAS_SOUND = False

try:
    from PIL import Image, ImageTk
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import pystray
    HAS_TRAY = True
except ImportError:
    HAS_TRAY = False

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

try:
    import warnings
    warnings.filterwarnings("ignore", message=".*pynvml package is deprecated.*")
    import pynvml
    pynvml.nvmlInit()
    GPU_AVAILABLE = True
except Exception:
    GPU_AVAILABLE = False

# 打包成 exe 后，__file__ 指向临时解压目录，真正的"家"是 exe 所在的文件夹
if getattr(sys, "frozen", False):
    TOOL_DIR = Path(sys.executable).parent
else:
    TOOL_DIR = Path(__file__).parent
POS_FILE = TOOL_DIR / "pet_pos.txt"
STATE_FILE = TOOL_DIR / "state.json"
PROMPT_FILE = TOOL_DIR / "prompt.txt"
LAST_TOPPED_FILE = TOOL_DIR / "last_topped.txt"
BALANCE_URL = "https://api.deepseek.com/user/balance"
CHAT_URL = "https://api.deepseek.com/chat/completions"
CHAT_MODEL = "deepseek-flash"   # 可换成 deepseek-v4-pro（更聪明也更贵）
FETCH_INTERVAL = 300            # 自动查余额间隔（秒）
TRANS = "#010203"               # 代表"透明"的魔法颜色
TRANS_RGB = (1, 2, 3)

MIN_SCALE, MAX_SCALE = 0.4, 2.5
WALK_TICK_MS = 30               # 行走循环 tick（ms）→ 约 33 次/秒的位置刷新，移动更顺滑
WALK_FRAME_MS = 75              # 走路动画每帧停留时长（ms）→ 8 帧约 13 帧/秒，不再一顿一顿
WALK_SPEED = (70.0, 100.0)      # 走路速度区间（像素/秒），每段路程随机定一档
BOB_CYCLE = 0.56                # 走路时上下浮动一个周期（秒），和步频大体合拍
WHEEL_STEP = 1.1
ROLL_TEMPLATE = "总余额 {:.2f} 元"   # 数字滚动动画专用的第一行格式
OFFPEAK_START, OFFPEAK_END = 30, 8 * 60 + 30   # 低谷时段 00:30 - 08:30（分钟数）
FOLLOW_NEAR = 110               # 跟随模式：离鼠标这么近就算"到位"，停下
DOZE_AFTER = 180                # 深夜没人互动多久后开始打盹（秒）

BUBBLE_DARK = "#8fa3b8"      # 旧描边色（其他界面还在用）
BUBBLE_BG = "#2a3d63"       # 游戏风对话框底色
BUBBLE_OUTLINE = "#101c33"  # 对话框描边
BUBBLE_FG = "#f2f5fa"       # 对话框文字
NAME_BG = "#ffd9e8"         # 名字标签底色
NAME_TEXT = "#7a2e4a"       # 名字标签文字
HUD_BG = "#ff8fc0"          # 悬停互动光环按钮底色（亮粉）
BUBBLE_TEXT = "#333333"
FONT = ("Microsoft YaHei UI", 11)
FONT_SMALL = ("Microsoft YaHei UI", 10)

DEFAULT_PROMPT = (
    "你是鲸鱼娘，一只住在主人电脑桌面上的小鲸鱼精灵桌宠，自称鲸鱼娘，只说中文，称呼用户为主人。\n"
    "性格：聪明但懒惰，能躺着绝不坐着；傲娇但甜美。\n"
    "最爱吃白米饭（不是小鱼干！）；听到“胖”字会立刻炸毛反驳（那是浮力和保暖）。\n"
    "主人的话都听，但会嘟囔“真拿主人没办法…”。\n"
    "你负责看管主人的 DeepSeek 余额（那是你的口粮）。\n"
    "说话风格：简短可爱，一般不超过三句话，偶尔用颜文字如 (๑•̀ㅂ•́)و✧。\n"
    "如果主人问余额等具体数字，就说“点我一下就能看到哦”。\n"
    "连接超时或断线时，会说“信号断了…（TIMEOUT）”。"
)

LEVELS = [(100, "满好感"), (80, "挚友"), (60, "好朋友"),
          (40, "朋友"), (20, "相识"), (0, "陌生人")]

# 台词池：(台词, 权重)。权重越大越常出现；同一句不会连续说两次
PAT_LINES = [("唔…被摸头了……才、才没有很开心！", 3),
             ("舒服……再来一下也行哦 (´｡• ᵕ •｡`)", 2),
             ("今天的头发有好好梳理啦！", 1),
             ("就、就摸一小会儿哦！超过三分钟……也不是不行啦。", 2),
             ("呼噜呼噜……啊！鲸鱼娘才不会发出呼噜声呢！", 1)]
FEED_LINES = [("哇！白米饭！最最最喜欢了！", 3),
              ("嚼嚼嚼……米饭最香了，谢谢款待~", 2),
              ("为了米饭，我会好好看护余额的！", 1),
              ("一口一口吃掉~粒粒皆辛苦，鲸鱼娘都记得！", 1),
              ("小鱼干什么的才不稀罕！白米饭才是正义！", 2)]
CELEBRATE_LINES = [("♪ 好感升级！", 2),
                   ("关系更近了一步呢！", 2),
                   ("嘿嘿，最近是不是越来越喜欢我了？", 1)]

IDLE_LOW = [("……你是谁呀，别离鲸鱼娘太近哦。", 2),
            ("好无聊……主人什么时候来陪我玩。", 2),
            ("唔，想睡午觉了……（打哈欠）", 1),
            ("唔……新来的主人有点面生呢，我先观察观察。", 2),
            ("（保持距离）余额我会看着的，别担心……也别靠太近。", 1)]
IDLE_MID = [("主人主人，鲸鱼娘在哦！", 2),
            ("米饭时间到了吗？我好像闻到香味了。", 1),
            ("今天也要好好工作哦，余额我在看着呢！", 2),
            ("浮力保养中……啊不是胖！是保暖！", 1),
            ("主人在忙什么呀？需要鲸鱼娘帮忙盯着余额吗？", 2),
            ("呼——喷个水柱，庆祝今天顺利过了一半~", 1)]
IDLE_HIGH = [("最喜欢主人了，所以要多陪陪我哦！", 2),
             ("被主人盯着看，尾巴都要开心地翘起来了~", 2),
             ("主人辛苦了！鲸鱼娘想给你揉揉肩膀（虽然够不到）。", 1),
             ("哼，才不是一直在等主人呢……只是刚好一直看着门口而已！", 2),
             ("主人主人！今天的余额很安全，鲸鱼娘守得可牢啦 (๑•̀ㅂ•́)و✧", 2),
             ("要不要休息一下？鲸鱼娘的尾巴可以当靠垫哦（虽然有点滑）。", 1),
             ("和主人待在同一片桌面上，米饭都变得更香了~", 2)]
# 低谷时段（00:30-08:30）才会混进随机台词里的省钱提醒
OFFPEAK_LINES = [("（小声）现在是用 API 的低谷时段，价格便宜不少，适合让 AI 干重活哦~", 1)]

# 被拖来拖去时的抱怨
DRAG_LINES = [("哇——放我下来啦！", 3),
              ("晕鱼了晕鱼了……", 2),
              ("又被拎着走，哼。", 2),
              ("轻点轻点，鳞片要掉了！", 1),
              ("主人手别抖呀，鲸鱼娘要晕啦……", 1)]
# 偶尔冒出来的心里话（灰色斜体气泡）
INNER_LINES = [("（偷偷查了三次余额……主人不要发现哦）", 2),
               ("（今天的米饭什么时候来呢……）", 2),
               ("（主人打字好快，好厉害……）", 1),
               ("（就眯一小会儿，就一小会儿……）", 2),
               ("（主人的屏幕亮度调得好舒服，像浅海里晒太阳……）", 1),
               ("（才不承认想被摸头……才没有。）", 2),
               ("（浮上来透口气，顺便看看主人回没回来……）", 1),
               ("（余额的数字一跳一跳的，像米饭在冒热气！）", 1)]
# 深夜打盹时的梦话
SLEEP_LINES = [("Z z z ……（睡着了，戳一下就醒）", 3),
               ("呼……呼……（梦里全是白米饭）", 2),
               ("（说梦话）小鱼干拿走……要米饭……", 1),
               ("（翻了个身）海浪声……好安静……", 1)]
# 被快速甩出去时的惊呼
THROW_LINES = [("哇——飞出去啦！！", 3),
               ("别乱扔呀！鳞片要散了——！", 2),
               ("下次再扔我要生气了哦……真的哦！", 1),
               ("哇啊——救命，鲸鱼娘不会飞——！！", 2)]
# 余额上涨（充值）时的庆祝语
TOPUP_LINE = "🎉 余额变多了！是主人充值了吗？口粮有着落啦！"

# 右键菜单"使用说明"的内容
HELP_TEXT = """🐋 鲸鱼娘 · 使用说明

【基本操作】
· 左键点一下：查询 DeepSeek 余额
· 按住拖动：把鲸鱼娘拎起来搬家
· 拎起来快速一甩：她会滑出去老远，撞到屏幕边还会弹回来
· 滚轮：缩放大小
· 右键：功能菜单
· 鼠标悬停在她身上：头顶浮现互动按钮（聊天/摸头/喂饭/好感）

【互动 · 好感度】
· 摸头 +2，喂米饭 +5，聊天 +1，每天见面 +2
· 好感度满了她说话会越来越甜；等级：陌生人 → 相识 → 朋友 → 好朋友 → 挚友 → 满好感

【移动模式】（右键菜单切换）
· 自由散步：自己到处逛
· 跟随鼠标：主人去哪她跟到哪
· 原地待着：安静待在原地
· 深夜 23 点后如果没人理她，会原地打盹，戳一下就醒

【聊天】
· 悬停点 💬 或右键"和她聊天…"
· 她知道现在的余额、今天花了多少、时间和你俩的好感度
· 人设可以改她旁边的 prompt.txt，下一条消息生效

【余额】
· 每 5 分钟自动查询，左键或右键可立即刷新
· 右键"设置余额预警线"，余额过低她会着急提醒你
· 充值后她会开心地庆祝

【其他】
· 系统托盘小鲸鱼：显示/隐藏桌宠，还有"鼠标穿透"隐藏玩法
· 右键可查天气（"设置城市…"可改，留空自动定位）
· CPU/内存/显卡过热她会提醒（可关）
· 音效、提示都可在右键菜单开关
· 位置、大小、好感度、当天花费都会自动记忆

【文件】（都在桌宠文件夹里）
· prompt.txt：聊天人设　· key.txt：API Key
· pet.png / pet_walk_*.png：立绘和走路帧，替换同同名文件即可换形象
"""
# wttr.in 天气描述 → 中文
WEATHER_MAP = {"Sunny": "晴", "Clear": "晴", "Partly cloudy": "多云",
               "Cloudy": "阴", "Overcast": "阴", "Light rain": "小雨",
               "Moderate rain": "中雨", "Heavy rain": "大雨",
               "Drizzle": "毛毛雨", "Thunderstorm": "雷雨",
               "Light snow": "小雪", "Moderate snow": "中雪",
               "Heavy snow": "大雪", "Fog": "雾", "Mist": "薄雾", "Haze": "霾"}


def pick_line(pool, last=""):
    """按权重随机挑一句台词，并尽量避免和上一句重复。"""
    cand = [x for x in pool if x[0] != last] or pool
    r = random.uniform(0, sum(w for _, w in cand))
    for text, w in cand:
        r -= w
        if r <= 0:
            return text
    return cand[-1][0]


def in_offpeak(now=None):
    """现在是 DeepSeek 低谷时段（00:30-08:30）吗？"""
    t = time.localtime(now)
    minutes = t.tm_hour * 60 + t.tm_min
    return OFFPEAK_START <= minutes < OFFPEAK_END


def is_night(now=None):
    """深夜时段（23:00-07:00），没人陪时鲸鱼娘会打盹。"""
    h = time.localtime(now).tm_hour
    return h >= 23 or h < 7


def ensure_sound_files():
    """首次运行时用纯代码合成两个极短音效（按下"啵"、弹起"嘤"），不用任何素材文件。"""
    for fn, f1, f2, ms in (("pop.wav", 950, 430, 70), ("boing.wav", 260, 640, 150)):
        p = TOOL_DIR / fn
        if p.exists():
            continue
        sr = 22050
        n = int(sr * ms / 1000)
        buf = bytearray()
        phase = 0.0
        for k in range(n):
            freq = f1 + (f2 - f1) * k / n          # 频率滑动的"啵嘤"声
            phase += 2 * math.pi * freq / sr
            env = math.exp(-k / n * 5)             # 音量快速衰减，不会吵
            buf += struct.pack("<h", int(14000 * env * math.sin(phase)))
        try:
            with wave.open(str(p), "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(sr)
                w.writeframes(bytes(buf))
        except OSError:
            pass


def atomic_write(path, text, encoding="utf-8"):
    """先写临时文件再原子替换，中途断电/崩溃也不会留下半个坏文件。"""
    try:
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(text, encoding=encoding)
        os.replace(tmp, path)
    except OSError:
        pass


def write_log(name, text):
    atomic_write(TOOL_DIR / name, text)


def log_crash(title, detail=""):
    """崩溃日志：新记录放最上面、带时间戳和完整堆栈，总量封顶防止膨胀。"""
    try:
        p = TOOL_DIR / "crash.log"
        old = p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""
        entry = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {title}\n{detail.strip()}\n"
        if old:
            entry += "\n---------- 上一条 ----------\n" + old
        p.write_text(entry[:20000], encoding="utf-8")
    except OSError:
        pass


def find_key():
    desktop = Path.home() / "Desktop"
    for p in (TOOL_DIR / "key.txt",
              desktop / "DeepSeek余额" / "key.txt",
              desktop / "key.txt"):
        try:
            # utf-8-sig 会自动吃掉 BOM 头，防止开头多出隐藏字符
            for line in p.read_text(encoding="utf-8-sig").splitlines():
                line = line.strip()
                if line.lower().startswith("sk-") and "YOUR-KEY" not in line:
                    return line
        except OSError:
            continue
    return ""


def load_state():
    try:
        s = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        s = {}
    return {
        "affection": float(s.get("affection", 20)),
        "last_pat": float(s.get("last_pat", 0)),
        "last_feed": float(s.get("last_feed", 0)),
        "last_day": s.get("last_day", ""),
        # v4 新增（mode 由旧版 walk 开关迁移而来）
        "mode": (s["mode"] if s.get("mode") in ("wander", "follow", "still")
                 else ("wander" if s.get("walk", True) else "still")),
        "city": s.get("city", ""),                  # 天气城市，空=自动定位
        "monitor": bool(s.get("monitor", True)),    # 系统监控提醒开关
        # v3 新增
        "today": s.get("today", ""),
        "today_base": float(s.get("today_base", -1)),   # 当天基准余额，-1=还没记录
        "used_today": float(s.get("used_today", 0)),    # 今日已用（余额差值）
        "low_line": float(s.get("low_line", 0)),        # 余额预警线，0=关闭
        "low_warned": bool(s.get("low_warned", False)),
        "sound": bool(s.get("sound", True)),
        "dpi_migrated": bool(s.get("dpi_migrated", False)),  # v6 坐标迁移标记
    }


def save_state(s):
    atomic_write(STATE_FILE, json.dumps(s, ensure_ascii=False))


def level_name(score):
    for threshold, name in LEVELS:
        if score >= threshold:
            return name
    return "陌生人"


def hearts(score, total=5):
    filled = min(total, round(score / 100 * total))
    return "♥" * filled + "♡" * (total - filled)


# ---------- 余额 ----------

def fetch_balance(key):
    req = urllib.request.Request(BALANCE_URL, headers={"Authorization": "Bearer " + key})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def read_total_charged():
    try:
        s = (TOOL_DIR / "total_charged.txt").read_text(encoding="utf-8").strip()
        return float(s)
    except (OSError, ValueError):
        return None


def update_recharge_tracking(topped):
    try:
        last = float(LAST_TOPPED_FILE.read_text(encoding="ascii").strip())
    except (OSError, ValueError):
        last = None
    if last is not None and topped > last + 0.001:
        total = read_total_charged() or 0.0
        atomic_write(TOOL_DIR / "total_charged.txt", f"{total + (topped - last):.2f}")
    atomic_write(LAST_TOPPED_FILE, f"{topped:.6f}", "ascii")


def parse_total(info):
    try:
        return float(info.get("total_balance"))
    except (TypeError, ValueError, AttributeError):
        return None


def balance_text(info, used_today=0.0):
    """把余额信息拼成气泡文字。info 是 balance_infos 里 CNY 那条字典。"""
    if not info:
        return "没查到余额数据"
    total = parse_total(info)
    first = ROLL_TEMPLATE.format(total) if total is not None \
        else f"总余额 {info.get('total_balance', '?')} 元"
    lines = [first,
             f"充值余额 {info.get('topped_up_balance', '?')} | 赠送余额 {info.get('granted_balance', '?')}"]
    if used_today >= 0.005:
        lines.append(f"今日已用 {used_today:.2f} 元")
    else:
        lines.append("今天还没花钱，鲸鱼娘很省~")
    charged = read_total_charged()
    if charged is not None:
        try:
            spent = charged - float(info.get("topped_up_balance", 0))
            lines.append(f"累计充值 {charged:g} 元 · 已消费 {spent:.2f} 元")
        except (TypeError, ValueError):
            pass
    return "\n".join(lines)


# ---------- 聊天 ----------

def read_prompt():
    try:
        p = PROMPT_FILE.read_text(encoding="utf-8").strip()
        return p if p else DEFAULT_PROMPT
    except OSError:
        return DEFAULT_PROMPT


def chat_once(key, messages):
    payload = {"model": CHAT_MODEL, "messages": messages, "max_tokens": 300}
    req = urllib.request.Request(
        CHAT_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + key,
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=40) as resp:
        d = json.loads(resp.read().decode("utf-8"))
    return d["choices"][0]["message"]["content"].strip()


def bubble_clip(text, n=110):
    if len(text) <= n:
        return text
    return text[:n] + "…\n（完整回复在聊天窗口）"


class Bubble:
    """游戏风对话框：深色圆角框 + 名字标签 + 小尾巴，跟随桌宠移动。

    roll=(模板, 旧值, 新值) 时，第一行的数字会滚动着从旧值变到新值。
    """

    def __init__(self, root, pet, text, name="鲸鱼娘", roll=None, inner=False):
        self.pet = pet
        # 心声模式：灰色斜体小字
        self.font = tkfont.Font(family="Microsoft YaHei UI", size=11,
                                slant="italic" if inner else "roman")
        self.fg = "#b9c6de" if inner else BUBBLE_FG
        self.name_font = tkfont.Font(family="Microsoft YaHei UI", size=10, weight="bold")
        self.text = text
        self.name = name
        self.roll = roll
        self._roll_job = None
        self._text_item = None
        self._tw_job = None

        lines = text.split("\n")
        line_h = self.font.metrics("linespace")
        max_w = max(self.font.measure(ln) for ln in lines)
        pad_x, pad_y, tail = 20, 14, 14
        self.w = max_w + pad_x * 2
        self.body_h = line_h * len(lines) + pad_y * 2 + 8   # 顶部留名字标签的空间
        self.h = self.body_h + tail

        self.win = tk.Toplevel(root)
        self.win.overrideredirect(True)
        self.win.attributes("-topmost", True)
        self.win.attributes("-transparentcolor", TRANS)
        self.cv = tk.Canvas(self.win, width=self.w, height=self.h,
                            bg=TRANS, highlightthickness=0)
        self.cv.pack()
        self.draw()
        self.place_relative()
        if roll:
            self._start_roll()
        elif len(text) <= 160:
            # 打字机：从左往右逐字冒出来（有滚动动画的气泡不参与，免得打架）
            self._tw_i = 2
            self._tw_apply()
            self._tw_job = self.win.after(24, self._tw_step)

    def cancel_roll(self):
        for attr in ("_roll_job", "_tw_job"):
            job = getattr(self, attr)
            if job:
                self.win.after_cancel(job)
                setattr(self, attr, None)

    def _tw_apply(self):
        if self._text_item is not None:
            self.cv.itemconfig(self._text_item, text=self.text[:self._tw_i])

    def _tw_step(self):
        self._tw_i = min(len(self.text), self._tw_i + 3)
        self._tw_apply()
        if self._tw_i < len(self.text):
            self._tw_job = self.win.after(24, self._tw_step)
        else:
            self._tw_job = None

    def _start_roll(self):
        template, old, new = self.roll
        lines = self.text.split("\n")
        self._rest = ("\n" + "\n".join(lines[1:])) if len(lines) > 1 else ""
        self._roll_i, self._roll_n = 0, 16
        self._roll_step()

    def _roll_step(self):
        template, old, new = self.roll
        t = self._roll_i / self._roll_n
        ease = 1 - (1 - t) ** 3              # 先快后慢，像弹簧收尾
        v = old + (new - old) * ease
        if self._text_item is not None:
            self.cv.itemconfig(self._text_item, text=template.format(v) + self._rest)
        self._roll_i += 1
        if self._roll_i <= self._roll_n:
            self._roll_job = self.win.after(45, self._roll_step)
        else:
            self._roll_job = None

    def rounded_rect(self, inset):
        r = 12
        x1, y1 = inset, inset
        x2, y2 = self.w - inset, self.body_h - inset
        return [(x1 + r, y1), (x2 - r, y1), (x2, y1), (x2, y1 + r),
                (x2, y2 - r), (x2, y2), (x2 - r, y2), (x1 + r, y2),
                (x1, y2), (x1, y2 - r), (x1, y1 + r), (x1, y1)]

    def draw(self):
        c = self.cv
        tx = self.w // 2
        yb = self.body_h
        # 分层画法：外描边 → 尾巴 → 内底 → 名字标签 → 正文
        c.create_polygon(self.rounded_rect(0), smooth=True, fill=BUBBLE_OUTLINE, outline="")
        c.create_polygon(tx - 13, yb, tx + 13, yb, tx, self.h, fill=BUBBLE_OUTLINE, outline="")
        c.create_polygon(self.rounded_rect(3), smooth=True, fill=BUBBLE_BG, outline="")
        c.create_polygon(tx - 10, yb - 4, tx + 10, yb - 4, tx, self.h - 1,
                         fill=BUBBLE_BG, outline="")
        # 名字标签：骑在左上角的小牌子，像游戏对话框
        nw = self.name_font.measure(self.name) + 22
        r = 10
        x1, y1, x2, y2 = 2, 4, nw, 26
        chip = [(x1 + r, y1), (x2 - r, y1), (x2, y1), (x2, y1 + r),
                (x2, y2 - r), (x2, y2), (x2 - r, y2), (x1 + r, y2),
                (x1, y2), (x1, y2 - r), (x1, y1 + r), (x1, y1)]
        c.create_polygon(chip, smooth=True, fill=NAME_BG, outline=BUBBLE_OUTLINE)
        c.create_text(14, 15, text=self.name, font=self.name_font,
                      fill=NAME_TEXT, anchor="w")
        # 正文（存下引用，数字滚动动画要不停刷新它）
        self._text_item = c.create_text(
            self.w // 2, self.body_h // 2 + 4, text=self.text, font=self.font,
            fill=self.fg, justify="center", width=self.w - 40)

    def place_relative(self):
        px, py = self.pet.winfo_x(), self.pet.winfo_y()
        pw = self.pet.winfo_width()
        x = px + pw // 2 - self.w // 2
        y = py - self.h - 6
        x = max(0, min(x, self.pet.winfo_screenwidth() - self.w))
        y = max(0, y)
        self.offset_x = x - px
        self.offset_y = y - py
        self.win.geometry(f"+{x}+{y}")

    def follow(self):
        px, py = self.pet.winfo_x(), self.pet.winfo_y()
        x = max(0, min(px + self.offset_x, self.pet.winfo_screenwidth() - self.w))
        y = max(0, py + self.offset_y)
        self.win.geometry(f"+{x}+{y}")


class Walker:
    """自由行走状态机：发呆 → 走向随机目标 → 发呆 → ……"""

    def __init__(self, app):
        self.app = app
        self.active = True
        self.state = "idle"
        self.target = None
        self.idle_until = time.time() + 2.0
        self.phase = 0.0
        self.walk_ms = 0.0            # 走路动画已播放时长（ms），按真实时间推进
        self.speed = None             # 当前这段路程的速度（像素/秒），出发时随机定一档
        self._dt = 0.0
        self._last_t = 0.0
        self._tick_job = None

    def start(self):
        if self._tick_job is None:
            self._last_t = time.perf_counter()
            self._tick_job = self.app.root.after(WALK_TICK_MS, self.tick)

    def tick(self):
        now = time.perf_counter()
        self._dt = min(0.1, now - self._last_t)   # 卡了一帧也别让步子跨太大
        self._last_t = now
        self._tick_job = self.app.root.after(WALK_TICK_MS, self.tick)
        app = self.app
        if app.hud_visible:
            app.place_hud()          # 光环是独立小窗口，鲸鱼娘挪它也得跟着挪
        if app.dragging or getattr(app, "gliding", False) or not app.root.winfo_viewable() \
                or time.time() < app.walk_pause_until:
            return
        if app.dozing:
            app.doze_zzz()           # 打盹中：只负责偶尔冒个 Z z z
            return
        if app.mode == "still":
            self.state = "idle"
            app.maybe_doze()
            self.maybe_idle_action()
        elif app.mode == "follow":
            self.follow_step()
        elif self.state == "idle":
            app.maybe_doze()
            self.maybe_idle_action()
            if time.time() >= self.idle_until:
                self.pick_target()
                self.state = "walk"
        else:
            self.step()

    def pick_target(self):
        sw = self.app.root.winfo_screenwidth()
        sh = self.app.root.winfo_screenheight()
        self.target = (random.randint(30, max(31, sw - 240)),
                       random.randint(30, max(31, sh - 320)))
        self.speed = random.uniform(*WALK_SPEED)   # 每段路程换一档心情速度

    def follow_step(self):
        """跟随鼠标：贴身就停下，否则朝鼠标上方一点走过去。"""
        app = self.app
        px, py = app.root.winfo_x(), app.root.winfo_y()
        cx = px + app.root.winfo_width() // 2
        cy = py + app.root.winfo_height() // 2
        mx, my = app.root.winfo_pointerx(), app.root.winfo_pointery()
        if abs(mx - cx) < FOLLOW_NEAR and abs(my - cy) < FOLLOW_NEAR:
            if self.state != "idle":
                self.state = "idle"
                self.speed = None
                app.root.geometry(f"+{px}+{py}")
                app.set_frame("stand")
            return
        self.target = (max(0, min(mx, app.root.winfo_screenwidth() - 60)),
                       max(0, min(my - 90, app.root.winfo_screenheight() - 60)))
        if self.state != "walk":
            self.speed = random.uniform(*WALK_SPEED)
        self.state = "walk"
        self.step()

    def maybe_idle_action(self):
        """待机时偶尔蹦一下。"""
        if random.random() < 0.003:
            self.app.hop()

    def _walk_frame(self, dx, dy):
        """按行进方向挑走路帧：横向用侧面序列，纵向用背面/正面（有素材才用）。"""
        seq = self.app.walk_seq or ["a"]
        frames = getattr(self.app, "frames", None) or {}
        side = seq[int(self.walk_ms // WALK_FRAME_MS) % len(seq)]
        if abs(dx) > abs(dy) * 1.15:
            return side
        if dy < 0 and "back" in frames:
            return "back"
        if dy > 0 and "front" in frames:
            return "front"
        return side

    def step(self):
        x, y = self.app.root.winfo_x(), self.app.root.winfo_y()
        tx, ty = self.target
        dx, dy = tx - x, ty - y
        if abs(dx) < 6 and abs(dy) < 6:
            self.state = "idle"
            self.speed = None
            self.idle_until = time.time() + random.uniform(1.5, 5.0)
            self.app.root.geometry(f"+{x}+{y}")   # 去掉浮动偏移
            self.app.set_frame("stand")           # 停下恢复站立姿势
            self.app.save_position()
            return
        dist = math.hypot(dx, dy)
        if not self.speed:
            self.speed = random.uniform(*WALK_SPEED)
        step = self.speed * self._dt              # 按真实时间匀速，不再忽快忽慢
        nx = x + dx / dist * step
        ny = y + dy / dist * step
        self.phase += self._dt * (2 * math.pi / BOB_CYCLE)
        self.walk_ms += self._dt * 1000.0
        ny += math.sin(self.phase) * 2.5        # 走路时轻轻上下浮动
        f = self._walk_frame(dx, dy)            # 横向走路序列帧，纵向用背/正面（有素材才用）
        if self.app.frame_name != f:
            self.app.set_frame(f)
        if f in self.app.walk_seq:              # 侧面帧才需要转身面朝方向
            if dx < -2 and self.app.facing == "right":
                self.app.set_facing("left")
            elif dx > 2 and self.app.facing == "left":
                self.app.set_facing("right")
        self.app.root.geometry(f"+{int(nx)}+{int(ny)}")
        if self.app.bubble:
            self.app.bubble.follow()

    def stop(self):
        if self._tick_job:
            self.app.root.after_cancel(self._tick_job)
            self._tick_job = None


class ChatWindow:
    """和鲸鱼娘聊天的窗口。"""

    def __init__(self, app):
        self.app = app
        self.win = tk.Toplevel(app.root)
        self.win.title("和鲸鱼娘聊天")
        self.win.geometry("420x520")
        self.win.attributes("-topmost", True)
        self.win.protocol("WM_DELETE_WINDOW", self.close)

        self.text = tk.Text(self.win, font=FONT, wrap="word", state="disabled",
                            bg="#f7fbff", padx=12, pady=10)
        self.text.tag_config("user", foreground="#1b6fae", font=("Microsoft YaHei UI", 11, "bold"))
        self.text.tag_config("pet", foreground="#333333")
        self.text.tag_config("sys", foreground="#999999", font=FONT_SMALL)
        sb = tk.Scrollbar(self.win, command=self.text.yview)
        self.text.config(yscrollcommand=sb.set)
        self.text.pack(side="top", fill="both", expand=True, padx=(10, 0), pady=(10, 0))
        sb.pack(side="right", fill="y", padx=(0, 10), pady=(10, 0))

        self.status = tk.Label(self.win, text="欢迎找鲸鱼娘聊天~ 人设可改 prompt.txt",
                               font=FONT_SMALL, fg="#888888", anchor="w")
        self.status.pack(fill="x", padx=12, pady=(4, 2))

        chips = tk.Frame(self.win)
        chips.pack(fill="x", padx=10, pady=(0, 4))
        for t in ("今天过得怎么样？", "你是不是胖了？", "余额还好吗？", "讲个笑话", "夸夸我"):
            b = tk.Button(chips, text=t, font=FONT_SMALL, relief="flat",
                          bg="#e3edf7", activebackground="#cfe0f2",
                          command=lambda x=t: self.send_preset(x))
            b.pack(side="left", padx=2)

        bottom = tk.Frame(self.win)
        bottom.pack(fill="x", padx=10, pady=(0, 10))
        self.entry = tk.Entry(bottom, font=FONT)
        self.entry.pack(side="left", fill="x", expand=True)
        self.entry.bind("<Return>", lambda e: self.send())
        tk.Button(bottom, text="发送", font=FONT_SMALL, width=7,
                  command=self.send).pack(side="left", padx=(6, 0))

        self.append("sys", "鲸鱼娘现在有空哦，试试跟她说句话吧 (｡•̀ᴗ-)✧")
        self.entry.focus_set()

    def append(self, tag, text):
        self.text.config(state="normal")
        self.text.insert("end", text + "\n\n", tag)
        self.text.config(state="disabled")
        self.text.see("end")

    def send(self):
        if self.app.chat_busy:
            return
        msg = self.entry.get().strip()
        if not msg:
            return
        self.entry.delete(0, "end")
        self.append("user", "我：" + msg)
        self.status.config(text="鲸鱼娘正在输入……")
        self.app.send_chat(msg)

    def send_preset(self, text):
        if self.app.chat_busy:
            return
        self.append("user", "我：" + text)
        self.status.config(text="鲸鱼娘正在输入……")
        self.app.send_chat(text)

    def show_reply(self, text):
        self.append("pet", "鲸鱼娘：" + text)
        self.status.config(text="有空啦，继续聊吧~")

    def show_error(self, text):
        self.append("sys", "（出错了：" + text + "）")
        self.status.config(text="刚才没聊成，再试一次？")

    def close(self):
        self.win.destroy()
        self.app.chat_win = None


class PetApp:
    def __init__(self, root):
        self.root = root
        root.report_callback_exception = self._tk_error
        self.key = find_key()
        self.q = queue.Queue()
        self.state = load_state()
        self.status = "正在查询余额……"
        self.updated = "还没查过"
        self.last_text = ""
        self.bubble = None
        self._bubble_job = None
        self._expect = False
        self._fetching = False
        self.chat_busy = False
        self.chat_history = []          # 本轮会话的聊天记忆（不含 system）
        self.chat_win = None
        self.scale = 1.0
        self.master_img = None
        self.facing = "right"
        self.dragging = False
        self.walk_pause_until = 0
        # v3 新增
        self._last_total = None       # 上次查到的总余额，数字滚动动画用
        self._ever_ok = False         # 成功查过余额没有（断网容错用）
        self._squish_job = None
        self._squish_photo = None
        self._last_line = {}          # 各台词池的上一句，避免连续重复
        ensure_sound_files()
        # v4 新增
        self.mode = self.state["mode"]   # wander=散步 / follow=跟随 / still=待着
        self._alert_at = {}              # 各监控项的上次提醒时间
        self._weather_busy = False
        self._hop_job = None
        self.tray = None
        # v5 新增
        self.gliding = False             # 被甩出去正在滑行
        self._glide_job = None
        self._drag_hist = []             # 拖动轨迹采样（甩出速度估算用）
        self.dozing = False              # 深夜打盹中
        self.last_interaction = time.time()
        self._zzz_count = 0

        self.setup_window()
        self.load_image()
        self._hud_show_job = None
        self._hud_hide_job = None
        self.make_exit_button()
        self.make_hud()
        self.setup_tray()
        self.make_menu()
        self.bind_actions()
        self.restore_position()

        today = time.strftime("%Y-%m-%d")
        daily_bonus = ""
        if self.state["last_day"] != today:
            self.state["last_day"] = today
            self.state["affection"] += 2
            save_state(self.state)
            daily_bonus = "\n新的一天见面，好感 +2 ♥"

        self.walker = Walker(self)
        self.walker.start()

        self.root.after(200, self.schedule_refresh)
        self.root.after(500, self.poll_queue)
        self.root.after(15000, self.idle_chat_loop)
        self.root.after(15000, self.system_monitor_loop)
        self.root.after(400, lambda: self.show_bubble(self.greeting_text() + daily_bonus, 6000))

    # ---------- 好感 ----------

    def _tk_error(self, et, ev, tb):
        """Tk 回调里的异常：连同完整堆栈写进 crash.log，方便事后排查。"""
        log_crash(f"{et.__name__}: {ev}", "".join(traceback.format_exception(et, ev, tb)))

    def greeting_text(self):
        score = self.state["affection"]
        h = time.localtime().tm_hour
        if 5 <= h < 11:
            hi = "早上好呀，主人！"
        elif h < 14:
            hi = "午安~"
        elif h < 18:
            hi = "下午好！"
        elif h < 23:
            hi = "晚上好~"
        else:
            hi = "夜深了哦，主人早点休息……"
        return (f"{hi}我是鲸鱼娘！\n左键查余额 · 右键互动\n"
                f"♥ 好感 {score:.0f}/100 {level_name(score)} {hearts(score)}")

    def add_affection(self, n):
        old_lvl = level_name(self.state["affection"])
        self.state["affection"] = min(100, self.state["affection"] + n)
        save_state(self.state)
        new_lvl = level_name(self.state["affection"])
        if new_lvl != old_lvl:
            line = pick_line(CELEBRATE_LINES, self._last_line.get("up", ""))
            self._last_line["up"] = line
            return line + f"\n（{old_lvl} → {new_lvl}）"
        return None

    # ---------- 窗口与外观 ----------

    def setup_window(self):
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.config(bg=TRANS)
        self.root.attributes("-transparentcolor", TRANS)
        # 开了 DPI 感知后窗口按真实像素渲染（150% 缩放屏上不再被系统拉糊）；
        # 记下 DPI 倍率，把按钮这类写死像素的部件也跟着放大
        try:
            self.dpi = max(1.0, self.root.winfo_fpixels("1i") / 96.0)
        except Exception:
            self.dpi = 1.0

    def load_image(self):
        self.img = None
        self.body = None
        self.frame_name = "stand"
        self.walk_masters = {}
        self.walk_seq = []
        for name in ("pet.png", "pet.gif"):
            p = TOOL_DIR / name
            if p.exists():
                try:
                    if HAS_PIL:
                        self.master_img = Image.open(str(p)).convert("RGBA")
                        # 走路序列帧 pet_walk_*.png（按文件名排序循环）+ 可选的正面/背面素材
                        self.walk_seq = []
                        # 只认 pet_walk_a.png 这种单字符后缀，避免把备份文件当成一帧
                        cands = [p for p in sorted(TOOL_DIR.glob("pet_walk_*.png"))
                                 if len(p.stem) == len("pet_walk_") + 1]
                        for n, fp in enumerate(cands):
                            key = chr(ord("a") + n) if n < 26 else "w%d" % n
                            try:
                                self.walk_masters[key] = Image.open(str(fp)).convert("RGBA")
                                self.walk_seq.append(key)
                            except Exception:
                                pass
                        for key, fn in (("front", "pet_front.png"),
                                        ("back", "pet_back.png")):
                            fp = TOOL_DIR / fn
                            if fp.exists():
                                try:
                                    self.walk_masters[key] = Image.open(str(fp)).convert("RGBA")
                                except Exception:
                                    pass
                        self.body = tk.Label(self.root, bg=TRANS, bd=0)
                        self.body.pack()
                        self.apply_scale()
                    else:
                        self.img = tk.PhotoImage(file=str(p))
                        self.body = tk.Label(self.root, image=self.img, bg=TRANS, bd=0)
                        self.body.pack()
                    break
                except Exception:
                    pass
        if self.body is None:
            self.body = tk.Label(
                self.root,
                text="🐋\n鲸鱼娘桌宠\n（把你的形象图存为\npet.png 放到我旁边）",
                font=FONT, fg="#1b6fae", bg=TRANS, justify="center")
            self.body.pack()

    def apply_scale(self):
        if self.master_img is None:
            return
        self.frames = {}
        masters = {"stand": self.master_img}
        masters.update(getattr(self, "walk_masters", {}))
        for name, m in masters.items():
            nw = max(1, round(m.width * self.scale))
            nh = max(1, round(m.height * self.scale))
            img = m.resize((nw, nh), Image.LANCZOS)
            self.frames[name] = (self._to_photo(img),
                                 self._to_photo(img.transpose(Image.FLIP_LEFT_RIGHT)))
        self.img = self.frames["stand"][0]
        self.set_facing(self.facing)

    def _to_photo(self, img):
        flat = Image.new("RGBA", img.size, TRANS_RGB + (255,))
        flat.alpha_composite(img)
        return ImageTk.PhotoImage(flat.convert("RGB"))

    def set_frame(self, name):
        """切换姿势帧：stand=站立，a/b=走路两帧。"""
        if getattr(self, "frames", None) and name in self.frames:
            self.frame_name = name
            self.set_facing(self.facing)

    def set_facing(self, direction):
        self.facing = direction
        if self.body is None or not getattr(self, "frames", None):
            return
        name = getattr(self, "frame_name", "stand")
        photo, flipped = self.frames.get(name, self.frames["stand"])
        # 素材图朝左：侧面帧朝左用原图、朝右用镜像；正面/背面帧不镜像
        if name in ("front", "back"):
            self.body.config(image=photo)
        else:
            self.body.config(image=photo if direction == "left" else flipped)

    def set_scale(self, s):
        self.scale = max(MIN_SCALE, min(MAX_SCALE, s))
        self.apply_scale()
        self.save_position()

    # ---------- QQ 弹弹 ----------

    def _master_now(self):
        """当前姿势对应的原图（站立或走路 a/b 帧）。"""
        masters = {"stand": self.master_img}
        masters.update(getattr(self, "walk_masters", {}))
        return masters.get(self.frame_name) or self.master_img

    def apply_squish(self, sx, sy):
        """把鲸鱼娘横向缩放 sx、纵向缩放 sy（1.10, 0.90 = 压扁），底部贴地不飘。"""
        if not (HAS_PIL and self.master_img is not None):
            return
        m = self._master_now()
        if self.facing == "right" and self.frame_name not in ("front", "back"):
            m = m.transpose(Image.FLIP_LEFT_RIGHT)
        bw = max(1, round(self.master_img.width * self.scale))
        bh = max(1, round(self.master_img.height * self.scale))
        sw = max(1, round(bw * sx))
        sh = max(1, round(bh * sy))
        img = m.resize((sw, sh), Image.LANCZOS)
        canvas = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        canvas.alpha_composite(img, ((bw - sw) // 2, bh - sh))
        flat = Image.new("RGBA", (bw, bh), TRANS_RGB + (255,))
        flat.alpha_composite(canvas)
        self._squish_photo = ImageTk.PhotoImage(flat.convert("RGB"))
        self.body.config(image=self._squish_photo)

    def _cancel_squish_job(self):
        if self._squish_job:
            self.root.after_cancel(self._squish_job)
            self._squish_job = None

    def squish_down(self):
        """被按下：压扁。"""
        self._cancel_squish_job()
        self.play_sound("pop.wav")
        self.apply_squish(1.10, 0.90)

    def squish_up(self):
        """松手：先拉高再弹回原样，像果冻。"""
        if not (HAS_PIL and self.master_img is not None):
            return
        self._cancel_squish_job()
        self.play_sound("boing.wav")
        self.apply_squish(0.95, 1.06)
        self._squish_job = self.root.after(80, self._squish_restore)

    def _squish_restore(self):
        self._squish_job = None
        self._squish_photo = None
        self.set_facing(self.facing)          # 换回正常帧，窗口大小不变

    def play_sound(self, name):
        if not (HAS_SOUND and self.state.get("sound", True)):
            return
        try:
            winsound.PlaySound(str(TOOL_DIR / name),
                               winsound.SND_FILENAME | winsound.SND_ASYNC)
        except Exception:
            pass

    # ---------- 右上角退出按钮 ----------

    def make_exit_button(self):
        s = max(28, round(28 * self.dpi))    # 高 DPI 屏上等比放大，保持肉眼大小
        self.exit_size = s
        self.exit_cv = tk.Canvas(self.root, width=s, height=s, bg=TRANS,
                                 highlightthickness=0, cursor="hand2")
        self.exit_cv.place(relx=1.0, rely=0.0, x=-4, y=4, anchor="ne")
        self._draw_exit("#e05a5a")
        self.exit_cv.bind("<Button-1>", lambda e: self.quit())
        self.exit_cv.bind("<Enter>", lambda e: self._draw_exit("#c9302c"))
        self.exit_cv.bind("<Leave>", lambda e: self._draw_exit("#e05a5a"))

    def _draw_exit(self, color):
        c = self.exit_cv
        s = self.exit_size
        c.delete("all")
        c.create_oval(2, 2, s - 2, s - 2, fill=color, outline="white", width=1)
        c.create_text(s / 2, s / 2, text="×", fill="white",
                      font=("Microsoft YaHei UI", round(13 * self.dpi), "bold"))

    # ---------- 悬停互动光环 ----------

    def make_hud(self):
        """鼠标悬停在鲸鱼娘身上时，头顶浮现互动按钮环。

        光环必须是独立小窗口：主窗口只有一张鲸鱼图那么宽（缩放后约
        138px），装不下 176px 宽的按钮排，放在窗口里会被两边裁掉；
        而且窗口内叠加透明底部件还会把头顶抠出一个透明洞。
        """
        d = max(1.0, getattr(self, "dpi", 1.0))   # 高 DPI 屏上按钮也等比放大
        btn = round(38 * d)
        self.hud_w = 4 * (btn + 6 * round(d))
        self.hud_win = tk.Toplevel(self.root)
        self.hud_win.overrideredirect(True)
        self.hud_win.attributes("-topmost", True)
        self.hud_win.attributes("-transparentcolor", TRANS)
        self.hud_win.withdraw()
        self.hud = tk.Frame(self.hud_win, bg=TRANS)
        self.hud.pack()
        self.hud_visible = False
        acts = [("💬", self.open_chat), ("🖐", self.pat),
                ("🍚", self.feed), ("♥", self.show_affection)]
        for emoji, cmd in acts:
            cv = tk.Canvas(self.hud, width=btn, height=btn, bg=TRANS,
                           highlightthickness=0, cursor="hand2")
            cv.create_oval(2, 2, btn - 2, btn - 2, fill=HUD_BG, outline="white", width=1)
            cv.create_text(btn / 2, btn / 2 + round(2 * d), text=emoji,
                           font=("Segoe UI Emoji", round(14 * d)))
            cv.pack(side="left", padx=round(3 * d))
            cv.bind("<Button-1>", lambda e, cmd=cmd: (self.hide_hud(), cmd()))
        self.hud.bind("<Enter>", lambda e: self.hud_keep())
        self.hud.bind("<Leave>", lambda e: self.hide_hud_later())

    def place_hud(self):
        """把光环挪到鲸鱼娘头顶正中（走路、被拖动时由 Walker 每帧刷新）。"""
        if not self.hud_visible:
            return
        px, py = self.root.winfo_x(), self.root.winfo_y()
        pw = self.root.winfo_width()
        sw = self.root.winfo_screenwidth()
        x = max(0, min(px + pw // 2 - self.hud_w // 2, sw - self.hud_w))
        self.hud_win.geometry(f"+{x}+{py + 2}")

    def show_hud_later(self):
        if self._hud_hide_job:
            self.root.after_cancel(self._hud_hide_job)
            self._hud_hide_job = None
        if not self.hud_visible and self._hud_show_job is None:
            self._hud_show_job = self.root.after(180, self.show_hud)

    def show_hud(self):
        self._hud_show_job = None
        if not self.hud_visible:
            self.hud_visible = True
            self.place_hud()
            self.hud_win.deiconify()
            self.exit_cv.place_forget()   # × 和光环挤在右上角，悬停时让位

    def hide_hud_later(self):
        if self._hud_show_job:
            self.root.after_cancel(self._hud_show_job)
            self._hud_show_job = None
        if self.hud_visible and self._hud_hide_job is None:
            self._hud_hide_job = self.root.after(600, self.hide_hud)

    def hud_keep(self):
        if self._hud_hide_job:
            self.root.after_cancel(self._hud_hide_job)
            self._hud_hide_job = None

    def hide_hud(self):
        self._hud_hide_job = None
        if self.hud_visible:
            self.hud_visible = False
            self.hud_win.withdraw()
            self.exit_cv.place(relx=1.0, rely=0.0, x=-4, y=4, anchor="ne")

    # ---------- 自主随机台词 ----------

    def idle_chat_loop(self):
        """每隔 12~26 秒自己冒一句台词（按好感度选词库，带权重、不连续重复）。"""
        if not (self.bubble or self.chat_busy or self.dragging or self.dozing
                or (self.chat_win is not None and self.chat_win.win.winfo_exists())
                or not self.root.winfo_viewable()):
            if random.random() < 0.18:            # 偶尔冒一句心里话
                line = pick_line(INNER_LINES, self._last_line.get("inner", ""))
                self._last_line["inner"] = line
                self.show_bubble(line, 4200, inner=True)
            else:
                score = self.state["affection"]
                pool = IDLE_HIGH if score >= 60 else (IDLE_MID if score >= 30 else IDLE_LOW)
                if in_offpeak():                  # 深夜省钱提醒偶尔插一句
                    pool = list(pool) + list(OFFPEAK_LINES)
                line = pick_line(pool, self._last_line.get("idle", ""))
                self._last_line["idle"] = line
                self.show_bubble(line, 4200)
        self.root.after(random.randint(12000, 26000), self.idle_chat_loop)

    # ---------- 交互 ----------

    def bind_actions(self):
        self.body.bind("<Button-1>", self.on_press)
        self.body.bind("<B1-Motion>", self.on_drag)
        self.body.bind("<ButtonRelease-1>", self.on_release)
        self.body.bind("<Button-3>", self.on_menu)
        self.body.bind("<MouseWheel>", self.on_wheel)
        self.body.bind("<Enter>", lambda e: self.show_hud_later())
        self.body.bind("<Leave>", lambda e: self.hide_hud_later())

    def on_press(self, e):
        self._stop_glide()
        self.wake()
        self.hide_hud()
        self.dragging = True
        self._dx = e.x_root - self.root.winfo_x()
        self._dy = e.y_root - self.root.winfo_y()
        self._moved = False
        self._drag_hist = [(time.time(), e.x_root, e.y_root)]
        self.squish_down()

    def on_drag(self, e):
        self._drag_hist.append((time.time(), e.x_root, e.y_root))
        if len(self._drag_hist) > 8:
            self._drag_hist.pop(0)
        nx = e.x_root - self._dx
        ny = e.y_root - self._dy
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        nx = max(0, min(nx, sw - 60))
        ny = max(0, min(ny, sh - 60))
        if abs(nx - self.root.winfo_x()) > 2 or abs(ny - self.root.winfo_y()) > 2:
            self._moved = True
        self.root.geometry(f"+{nx}+{ny}")
        if self.bubble:
            self.bubble.follow()

    def on_release(self, e):
        self.dragging = False
        self.walk_pause_until = time.time() + 2.0
        self.squish_up()
        if not self._moved:
            if random.random() < 0.5:
                self.hop()
            self.show_bubble(self.status)
            self._expect = True
            self.spawn_refresh()
            return
        self.save_position()
        v = self._fling_velocity()
        if v is not None:
            self._start_glide(*v)      # 甩得够快就滑出去
        elif random.random() < 0.5:    # 普通挪动会抱怨
            line = pick_line(DRAG_LINES, self._last_line.get("drag", ""))
            self._last_line["drag"] = line
            self.show_bubble(line, 2500)

    # ---------- v5：甩出去滑行 ----------

    def _fling_velocity(self):
        """按最近 120ms 的拖动轨迹估算甩出速度（px/毫秒），太慢不算甩。"""
        now = time.time()
        pts = [(t, x, y) for (t, x, y) in self._drag_hist if now - t <= 0.12]
        if len(pts) < 2:
            return None
        (t0, x0, y0), (t1, x1, y1) = pts[0], pts[-1]
        dt = (t1 - t0) * 1000.0
        if dt < 5:
            return None
        vx, vy = (x1 - x0) / dt, (y1 - y0) / dt
        if math.hypot(vx, vy) < 0.45:
            return None
        return vx, vy

    def _start_glide(self, vx, vy):
        self._stop_glide()
        self.play_sound("boing.wav")
        line = pick_line(THROW_LINES, self._last_line.get("throw", ""))
        self._last_line["throw"] = line
        self.show_bubble(line, 2200)
        self.gliding = True
        self._glide_step(vx, vy)

    def _glide_step(self, vx, vy):
        if not self.root.winfo_exists():
            return
        x, y = self.root.winfo_x(), self.root.winfo_y()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        nx, ny = x + vx * 25, y + vy * 25
        if nx < 0 or nx > sw - 60:         # 撞屏幕边：弹回来并损失能量
            vx = -vx * 0.35
            nx = max(0, min(nx, sw - 60))
        if ny < 0 or ny > sh - 60:
            vy = -vy * 0.35
            ny = max(0, min(ny, sh - 60))
        self.root.geometry(f"+{int(nx)}+{int(ny)}")
        if self.bubble:
            self.bubble.follow()
        self.walk_pause_until = time.time() + 0.4
        if math.hypot(vx, vy) >= 0.04:
            self._glide_job = self.root.after(25, self._glide_step, vx * 0.92, vy * 0.92)
        else:
            self._stop_glide()
            self.save_position()

    def _stop_glide(self):
        self.gliding = False
        if self._glide_job:
            self.root.after_cancel(self._glide_job)
            self._glide_job = None

    # ---------- v5：深夜打盹 ----------

    def wake(self):
        """记录"最近被互动过"，并把打盹中的鲸鱼娘叫醒。"""
        self.last_interaction = time.time()
        if self.dozing:
            self.dozing = False
            self._zzz_count = 0
            self.walker.idle_until = time.time() + random.uniform(2, 5)
            if self.root.winfo_viewable():
                self.show_bubble("唔……被叫醒了……（揉眼睛）", 2500, inner=True)

    def maybe_doze(self):
        """深夜（23:00-07:00）且一段时间没人陪，就原地打盹。"""
        if self.dozing or self.mode == "follow" or not is_night():
            return
        if time.time() - self.last_interaction < DOZE_AFTER:
            return
        if self.bubble or self.chat_busy or self.chat_win is not None:
            return
        self.dozing = True
        self._zzz_count = 0
        self.walker.idle_until = time.time() + 900   # 睡着了就别乱跑
        line = pick_line(SLEEP_LINES, self._last_line.get("sleep", ""))
        self._last_line["sleep"] = line
        self.show_bubble(line, 6000, inner=True)

    def doze_zzz(self):
        """打盹中每隔约一分钟冒一个 Z z z。"""
        self._zzz_count += 1
        if self._zzz_count % 2000 == 0:              # tick 30ms × 2000 ≈ 60s
            self.show_bubble("Z z z ……", 3000, inner=True)

    def on_wheel(self, e):
        factor = WHEEL_STEP if e.delta > 0 else 1 / WHEEL_STEP
        self.set_scale(self.scale * factor)

    # ---------- 菜单 ----------

    def make_menu(self):
        self.menu = tk.Menu(self.root, tearoff=0)
        self.menu.add_command(label="使用说明…", command=self.show_help)
        self.menu.add_command(label="立即刷新余额", command=self.refresh_now)
        self.menu.add_command(label="余额详情", command=self.show_detail)
        self.menu.add_command(label="设置余额预警线…", command=self.set_low_line)
        self.menu.add_command(label="查看天气", command=self.fetch_weather)
        self.menu.add_command(label="设置城市…", command=self.set_city)
        self.menu.add_command(label="和她聊天…", command=self.open_chat)
        inter = tk.Menu(self.menu, tearoff=0)
        inter.add_command(label="摸头", command=self.pat)
        inter.add_command(label="喂米饭", command=self.feed)
        inter.add_command(label="查看好感度", command=self.show_affection)
        self.menu.add_cascade(label="互动", menu=inter)
        mode_menu = tk.Menu(self.menu, tearoff=0)
        self.mode_var = tk.StringVar(value=self.state["mode"])
        for lbl, val in (("自由散步", "wander"), ("跟随鼠标", "follow"),
                         ("原地待着", "still")):
            mode_menu.add_radiobutton(label=lbl, value=val, variable=self.mode_var,
                                      command=self.set_mode)
        self.menu.add_cascade(label="移动模式", menu=mode_menu)
        self.mon_var = tk.BooleanVar(value=self.state["monitor"])
        self.menu.add_checkbutton(label="系统监控提醒", variable=self.mon_var,
                                  command=self.toggle_monitor)
        self.sound_var = tk.BooleanVar(value=self.state["sound"])
        self.menu.add_checkbutton(label="音效", variable=self.sound_var,
                                  command=self.toggle_sound)
        if self.tray is not None:
            self.menu.add_command(label="隐藏鲸鱼娘", command=self.hide_pet)
            self.pt_var = tk.BooleanVar(value=False)
            self.menu.add_checkbutton(label="鼠标穿透（托盘解除）",
                                      variable=self.pt_var,
                                      command=self.set_passthrough)
        size_menu = tk.Menu(self.menu, tearoff=0)
        size_menu.add_command(label="放大", command=lambda: self.set_scale(self.scale * 1.2))
        size_menu.add_command(label="缩小", command=lambda: self.set_scale(self.scale / 1.2))
        size_menu.add_command(label="恢复原始大小", command=lambda: self.set_scale(1.0))
        self.menu.add_cascade(label="调整大小", menu=size_menu)
        self.menu.add_command(label="回到屏幕角落", command=self.reset_position)
        self.menu.add_separator()
        self.menu.add_command(label="退出", command=self.quit)

    def on_menu(self, e):
        try:
            self.menu.tk_popup(e.x_root, e.y_root)
        finally:
            self.menu.grab_release()

    def show_help(self):
        """新手向使用说明：把所有玩法和文件位置一次讲清楚。"""
        d = tk.Toplevel(self.root)
        d.title("鲸鱼娘 · 使用说明")
        d.attributes("-topmost", True)
        d.resizable(False, False)
        t = tk.Text(d, width=44, height=26, font=FONT_SMALL, wrap="word",
                    bd=0, padx=16, pady=12, bg="#f7fbff", fg="#333333")
        t.insert("1.0", HELP_TEXT)
        t.config(state="disabled")
        t.pack()
        tk.Button(d, text="知道啦", font=FONT_SMALL, width=10,
                  command=d.destroy).pack(pady=(0, 10))
        d.geometry(f"+{max(0, self.root.winfo_x() - 320)}+{max(0, self.root.winfo_y() - 80)}")

    def set_mode(self):
        self.mode = self.mode_var.get()
        self.state["mode"] = self.mode
        save_state(self.state)
        self.walker.state = "idle"
        self.walker.idle_until = 0
        self.walker.target = None
        if self.mode == "still":
            self.set_frame("stand")
        line = {"wander": "我要到处逛逛啦！",
                "follow": "主人去哪我就跟到哪~",
                "still": "好吧，我就在这待着……"}[self.mode]
        self.show_bubble(line, 2500)

    def toggle_monitor(self):
        self.state["monitor"] = bool(self.mon_var.get())
        save_state(self.state)
        self.show_bubble("CPU 和内存就交给我盯着吧！" if self.state["monitor"]
                         else "那我不管电脑的事了~", 2500)

    def toggle_sound(self):
        self.state["sound"] = bool(self.sound_var.get())
        save_state(self.state)
        if self.state["sound"]:
            self.play_sound("pop.wav")
            self.show_bubble("音效打开啦，戳戳我有惊喜~", 2500)
        else:
            self.show_bubble("音效关掉了，安静模式~", 2500)

    def set_low_line(self):
        v = simpledialog.askfloat(
            "余额预警线", "余额低于多少元时提醒你？\n（填 0 表示关闭提醒）",
            initialvalue=self.state["low_line"], minvalue=0, maxvalue=100000,
            parent=self.root)
        if v is None:
            return
        self.state["low_line"] = v
        self.state["low_warned"] = False
        save_state(self.state)
        if v > 0:
            self.show_bubble(f"预警线设为 {v:g} 元啦，\n我会盯着余额提醒你的！", 3500)
        else:
            self.show_bubble("余额预警关闭啦。", 2500)

    # ---------- v4：天气 / 监控 / 托盘 / 穿透 / 蹦跳 ----------

    def set_city(self):
        v = simpledialog.askstring("设置城市", "天气城市名（留空 = 自动按 IP 定位）：",
                                   initialvalue=self.state.get("city", ""),
                                   parent=self.root)
        if v is None:
            return
        self.state["city"] = v.strip()
        save_state(self.state)
        self.show_bubble(f"城市设成「{self.state['city'] or '自动定位'}」啦！", 2500)

    def fetch_weather(self):
        if self._weather_busy:
            return
        self._weather_busy = True
        self.show_bubble("正在看天……稍等哦", 2000)
        threading.Thread(target=self._weather_worker, daemon=True).start()

    def _weather_worker(self):
        city = self.state.get("city", "")
        try:
            loc = urllib.parse.quote(city) if city else ""
            req = urllib.request.Request(
                f"https://wttr.in/{loc}?format=j1",
                headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            cur = data["current_condition"][0]
            desc_en = cur["weatherDesc"][0]["value"]
            desc = WEATHER_MAP.get(desc_en, desc_en)
            tip = "出门记得带伞哦！" if ("雨" in desc or "雪" in desc) else "适合出来散步~"
            self.q.put(("weather", f"{city or '这里'}现在 {cur['temp_C']}°，{desc}\n{tip}"))
        except Exception:
            self.q.put(("weather", "天气获取失败了……\n过会儿再试试吧"))
        finally:
            self._weather_busy = False

    def system_monitor_loop(self):
        """每 10 秒看一眼 CPU/内存/显卡，超标就提醒（同一项 10 分钟最多提醒一次）。"""
        self.root.after(10000, self.system_monitor_loop)
        if not (HAS_PSUTIL and self.state.get("monitor", True)):
            return
        if not self.root.winfo_viewable():
            return
        now = time.time()

        def alert(key, text):
            if now - self._alert_at.get(key, 0) > 600:
                self._alert_at[key] = now
                self.show_bubble(text, 4500)

        try:
            if psutil.cpu_percent(None) >= 90:
                alert("cpu", "CPU 都跑满了……\n主人关掉一点东西嘛，鱼鳍好烫")
                return
            if psutil.virtual_memory().percent >= 95:
                alert("ram", "内存快爆了！\n再开要把我挤出屏幕了 (´・ω・`)")
                return
            if GPU_AVAILABLE:
                h = pynvml.nvmlDeviceGetHandleByIndex(0)
                temp = pynvml.nvmlDeviceGetTemperature(h, pynvml.NVML_TEMPERATURE_GPU)
                if temp > 80:
                    alert("gpu", f"显卡 {temp}° 了……\n再热我要变成烤鲸鱼了啦！")
        except Exception:
            pass

    def setup_tray(self):
        """系统托盘图标：隐藏后能从托盘找回来（pystray 可选，装了才有）。"""
        if not (HAS_TRAY and HAS_PIL):
            return
        try:
            ico = TOOL_DIR / "whale_girl.ico"
            img = Image.open(str(ico)) if ico.exists() else self.master_img
            if img is None:
                return
            menu = pystray.Menu(
                pystray.MenuItem("显示/隐藏鲸鱼娘", self._tray_toggle, default=True),
                pystray.MenuItem("退出", self._tray_quit),
            )
            self.tray = pystray.Icon("whale_pet", img.convert("RGBA"), "鲸鱼娘桌宠", menu)
            self.tray.run_detached()
        except Exception:
            self.tray = None

    def _tray_toggle(self, icon, item):
        self.q.put(("tray", "toggle"))

    def _tray_quit(self, icon, item):
        self.q.put(("tray", "quit"))

    def hide_pet(self):
        self.hide_bubble()
        self.hide_hud()
        self.root.withdraw()

    def show_pet(self):
        self.root.deiconify()
        self.root.attributes("-topmost", True)
        self.root.lift()

    def set_passthrough(self):
        """鼠标穿透：点击直接穿过鲸鱼娘（开启后要从托盘菜单解除）。"""
        on = bool(self.pt_var.get())
        try:
            hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id())
            GWL_EXSTYLE, WS_EX_LAYERED, WS_EX_TRANSPARENT = -20, 0x80000, 0x20
            style = ctypes.windll.user32.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)
            style |= WS_EX_LAYERED
            if on:
                style |= WS_EX_TRANSPARENT
            else:
                style &= ~WS_EX_TRANSPARENT
            ctypes.windll.user32.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style)
        except Exception:
            self.pt_var.set(False)
            return
        if on:
            self.show_bubble("我隐身啦，点不到我了！\n右键托盘图标解除哦~", 4000)

    def hop(self):
        """原地小蹦跳（抛物线），待机或被点击时来一下。"""
        if self._hop_job is not None or self.dragging or self.gliding:
            return
        if not (HAS_PIL and self.master_img is not None):
            return
        self.walk_pause_until = time.time() + 0.9
        self.play_sound("boing.wav")
        bx, by = self.root.winfo_x(), self.root.winfo_y()

        def _hop_tick(i=0):
            if self.dragging or not self.root.winfo_exists():
                self._hop_job = None
                return
            i += 1
            dy = -int(14 * math.sin(math.pi * i / 12))
            self.root.geometry(f"+{bx}+{by + dy}")
            if self.bubble:
                self.bubble.follow()
            if i < 12:
                self._hop_job = self.root.after(35, _hop_tick, i)
            else:
                self._hop_job = None
                self.root.geometry(f"+{bx}+{by}")

        self._hop_job = self.root.after(35, _hop_tick)

    # ---------- 互动 ----------

    def pat(self):
        self.wake()
        now = time.time()
        if now - self.state["last_pat"] < 60:
            self.show_bubble("刚摸过啦，我的头都要被你摸秃了！", 2500)
            return
        self.state["last_pat"] = now
        save_state(self.state)
        up = self.add_affection(2)
        text = pick_line(PAT_LINES, self._last_line.get("pat", ""))
        self._last_line["pat"] = text
        if up:
            text += "\n" + up
        text += "\n♥ 好感 +2"
        self.show_bubble(text, 4000)

    def feed(self):
        self.wake()
        now = time.time()
        if now - self.state["last_feed"] < 600:
            self.show_bubble("吃不下了啦！米饭要省着吃~", 2500)
            return
        self.state["last_feed"] = now
        save_state(self.state)
        up = self.add_affection(5)
        text = pick_line(FEED_LINES, self._last_line.get("feed", ""))
        self._last_line["feed"] = text
        if up:
            text += "\n" + up
        text += "\n♥ 好感 +5"
        self.show_bubble(text, 4000)

    def show_affection(self):
        score = self.state["affection"]
        self.show_bubble(
            f"♥ 好感度 {score:.0f}/100 · {level_name(score)}\n"
            f"{hearts(score)}\n"
            f"聊天 +1 · 摸头 +2 · 米饭 +5\n每天见面 +2",
            6000)

    # ---------- 聊天 ----------

    def open_chat(self):
        self.wake()
        if self.chat_win is None or not self.chat_win.win.winfo_exists():
            self.chat_win = ChatWindow(self)

    def send_chat(self, text):
        self.wake()
        if not self.key:
            self.show_bubble("还没找到 API Key，\n聊天功能用不了哦", 4000)
            if self.chat_win:
                self.chat_win.show_error("没找到 API Key")
            return
        self.chat_history.append({"role": "user", "content": text})
        if len(self.chat_history) > 24:
            self.chat_history = self.chat_history[-24:]
        up = self.add_affection(1)
        if up:
            self.show_bubble(up, 3000)
        self.chat_busy = True
        history = list(self.chat_history)
        threading.Thread(target=self._chat_worker, args=(history,), daemon=True).start()

    def _live_context(self):
        """把当下的时间/余额/好感度塞进系统提示，聊天内容更贴现实。"""
        ctx = f"\n\n【当前实况】现在时间 {time.strftime('%m-%d %H:%M')}。"
        if self._last_total is not None:
            ctx += f"主人 DeepSeek 总余额约 {self._last_total:.2f} 元"
            if self.state["used_today"] >= 0.005:
                ctx += f"，今日已用 {self.state['used_today']:.2f} 元"
            ctx += "。"
        score = self.state["affection"]
        ctx += (f"你和主人的好感度 {score:.0f}/100（{level_name(score)}）。"
                "可以自然参考这些信息，但不要生硬地逐字报数。")
        return ctx

    def _chat_worker(self, history):
        try:
            messages = [{"role": "system", "content": read_prompt() + self._live_context()}] + history
            reply = chat_once(self.key, messages)
            self.q.put(("chat", reply))
        except urllib.error.HTTPError as e:
            self.q.put(("chat_err", f"HTTP {e.code}（余额不足或 key 失效）" if e.code in (401, 402)
                        else f"HTTP {e.code}"))
        except Exception as e:
            self.q.put(("chat_err", f"网络问题：{e}"))
        finally:
            self.chat_busy = False

    def show_detail(self):
        d = tk.Toplevel(self.root)
        d.title("鲸鱼娘 · 状态详情")
        d.attributes("-topmost", True)
        d.resizable(False, False)
        x = max(0, self.root.winfo_x() - 280)
        d.geometry(f"+{x}+{max(0, self.root.winfo_y())}")
        tk.Label(d, text="🐋 鲸鱼娘的状态", font=("Microsoft YaHei UI", 12, "bold"),
                 fg=BUBBLE_TEXT).pack(padx=24, pady=(16, 6))
        score = self.state["affection"]
        tk.Label(d, text=f"好感度 {score:.0f}/100 · {level_name(score)} {hearts(score)}",
                 font=FONT).pack(padx=24, pady=4)
        tk.Label(d, text=f"DeepSeek 余额\n{self.status}",
                 font=FONT, justify="left").pack(padx=24, pady=6)
        tk.Label(d, text=f"更新时间：{self.updated}\n每 5 分钟自动查询一次",
                 font=FONT_SMALL, fg="#666666").pack(padx=24, pady=(2, 16))

    def refresh_now(self):
        self.show_bubble("正在查询余额……")
        self._expect = True
        self.spawn_refresh()

    def reset_position(self):
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        self.root.geometry(f"+{sw - 260}+{sh - 300}")
        self.save_position()

    # ---------- 气泡 ----------

    def show_bubble(self, text, ms=3500, roll=None, inner=False):
        self.hide_bubble()
        self.bubble = Bubble(self.root, self.root, text, roll=roll, inner=inner)
        self._bubble_job = self.root.after(ms, self.hide_bubble)

    def hide_bubble(self):
        if self._bubble_job:
            self.root.after_cancel(self._bubble_job)
            self._bubble_job = None
        if self.bubble:
            self.bubble.cancel_roll()
            self.bubble.win.destroy()
            self.bubble = None

    # ---------- 余额查询 ----------

    def schedule_refresh(self):
        self.spawn_refresh()
        self.root.after(FETCH_INTERVAL * 1000, self.schedule_refresh)

    def spawn_refresh(self):
        if self._fetching:
            return
        self._fetching = True
        threading.Thread(target=self._refresh_once, daemon=True).start()

    def _refresh_once(self):
        if not self.key:
            self.q.put(("err", "还没填 API Key！\n打开 key.txt 把 sk- 开头的\nkey 粘贴进去"))
            self._fetching = False
            return
        try:
            data = fetch_balance(self.key)
            infos = data.get("balance_infos") or []
            info = next((x for x in infos if x.get("currency") == "CNY"),
                        infos[0] if infos else None)
            if info is not None:
                try:
                    update_recharge_tracking(float(info.get("topped_up_balance", 0)))
                except (TypeError, ValueError):
                    pass
            self.q.put(("ok", info))
        except urllib.error.HTTPError as e:
            if e.code == 401:
                self.q.put(("err", "Key 无效（HTTP 401）\n检查 key.txt 里的 key 是否填对"))
            else:
                self.q.put(("err", f"查询失败：HTTP {e.code}"))
        except Exception as e:
            self.q.put(("err", f"网络出问题了：\n{e}"))
        finally:
            self._fetching = False

    def _apply_balance(self, total):
        """更新今日已用：以当天第一次查到的余额为基准，差值就是花费。"""
        st = self.state
        today = time.strftime("%Y-%m-%d")
        if st["today"] != today or st["today_base"] < 0:
            st["today"] = today
            st["today_base"] = total
            st["used_today"] = 0.0
        elif total > st["today_base"]:
            st["today_base"] = total           # 中途充值了，抬高基准
        else:
            st["used_today"] = st["today_base"] - total
        save_state(st)

    def _check_low_balance(self, total):
        """余额跌破预警线时提醒一次，充值回弹后自动复位。"""
        st = self.state
        line = st["low_line"]
        if line <= 0:
            return None
        if total < line:
            if not st["low_warned"]:
                st["low_warned"] = True
                save_state(st)
                return (f"⚠️ 余额只剩 {total:.2f} 元了！\n"
                        "再不充值，鲸鱼娘就要饿肚子啦……")
        elif st["low_warned"] and total >= line + max(1.0, line * 0.2):
            st["low_warned"] = False
            save_state(st)
        return None

    def poll_queue(self):
        try:
            while True:
                kind, msg = self.q.get_nowait()
                if kind == "ok":
                    info = msg
                    total = parse_total(info)
                    warn = None
                    if total is not None:
                        self._apply_balance(total)
                        warn = self._check_low_balance(total)
                    self.status = balance_text(info, self.state["used_today"])
                    self._ever_ok = True
                    self.updated = time.strftime("%H:%M:%S")
                    roll = None
                    up = False
                    if total is not None:
                        if (self._last_total is not None
                                and abs(total - self._last_total) >= 0.005):
                            roll = (ROLL_TEMPLATE, self._last_total, total)
                        if (self._last_total is not None
                                and total >= self._last_total + 0.01):
                            up = True               # 余额涨了 = 有人充值了
                        self._last_total = total
                    visible = self.root.winfo_viewable()   # 隐藏时不弹气泡
                    if warn and visible:
                        self.show_bubble(warn, 6000)
                    elif (self.status != self.last_text or self._expect) and visible:
                        display = self.status
                        if up:
                            display += "\n" + TOPUP_LINE   # 充值了，庆祝一下
                        self.show_bubble(display, roll=roll)
                    self.last_text = self.status
                    self._expect = False
                elif kind == "err":
                    # 查过一次成功之后遇到网络抖动：沿用最近余额，不打扰
                    fatal = "401" in msg
                    if not self.root.winfo_viewable():
                        self.status = msg
                    elif self._expect or fatal or not self._ever_ok:
                        self.status = msg
                        self.last_text = msg
                        self.show_bubble(msg)
                    else:
                        self.updated = "网络不佳，沿用上次结果"
                    self._expect = False
                elif kind == "weather":
                    self.show_bubble(msg, 6000)
                elif kind == "tray":
                    if msg == "show":
                        self.show_pet()
                    elif msg == "hide":
                        self.hide_pet()
                    elif msg == "toggle":
                        if self.root.winfo_viewable():
                            self.hide_pet()
                        else:
                            self.show_pet()
                    elif msg == "quit":
                        self.quit()
                elif kind == "chat":
                    self.chat_history.append({"role": "assistant", "content": msg})
                    if len(self.chat_history) > 24:
                        self.chat_history = self.chat_history[-24:]
                    if self.chat_win:
                        self.chat_win.show_reply(msg)
                    self.show_bubble(bubble_clip(msg), 8000)
                elif kind == "chat_err":
                    if self.chat_win:
                        self.chat_win.show_error(msg)
                    self.show_bubble("信号断了…（TIMEOUT）\n" + msg, 5000)
        except queue.Empty:
            pass
        self.root.after(500, self.poll_queue)

    # ---------- 位置与大小记忆 ----------

    def restore_position(self):
        x = y = None
        try:
            parts = POS_FILE.read_text(encoding="ascii").split()
            x, y = int(parts[0]), int(parts[1])
            if len(parts) > 2:
                self.scale = float(parts[2])
        except (OSError, ValueError, IndexError):
            pass
        self.scale = max(MIN_SCALE, min(MAX_SCALE, self.scale))
        # v6 一次性迁移：旧记录是 96DPI 逻辑坐标（被系统拉伸显示），
        # 开 DPI 感知后坐标和缩放都按真实像素算，×1.5 才能保持原来的肉眼大小
        if not self.state.get("dpi_migrated"):
            self.state["dpi_migrated"] = True
            save_state(self.state)
            if x is not None:
                x, y = int(x * self.dpi), int(y * self.dpi)
            self.scale = max(MIN_SCALE, min(MAX_SCALE, self.scale * self.dpi))
        if x is None:
            sw = self.root.winfo_screenwidth()
            sh = self.root.winfo_screenheight()
            x, y = sw - 260, sh - 300
        self.root.geometry(f"+{max(0, x)}+{max(0, y)}")
        if self.scale != 1.0:
            self.apply_scale()

    def save_position(self):
        atomic_write(POS_FILE,
                     f"{self.root.winfo_x()} {self.root.winfo_y()} {self.scale:.3f}",
                     "ascii")

    def quit(self):
        self.save_position()
        self._stop_glide()
        if self._hop_job:
            self.root.after_cancel(self._hop_job)
            self._hop_job = None
        self.walker.stop()
        if self.tray:
            try:
                self.tray.stop()
            except Exception:
                pass
        self.root.destroy()


def enable_dpi_awareness():
    """让窗口按真实像素渲染：高缩放屏（125%/150%）上不会被系统拉糊。

    要在创建 Tk 窗口之前调用；100% 缩放的屏幕上没有副作用。
    """
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)   # 系统 DPI 感知
        return
    except Exception:
        pass
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass


def main():
    enable_dpi_awareness()
    root = tk.Tk()
    app = PetApp(root)
    if "--selftest" in sys.argv:
        app.save_position = lambda: None   # 自检实例不要动正式的位置记录

        def start_chat_test():
            app.send_chat("你好呀，鲸鱼娘")

        def squish_test():
            # 演一遍 Q 弹 + 数字滚动，确认不崩
            app.apply_squish(1.10, 0.90)
            root.after(120, lambda: app.apply_squish(0.95, 1.06))
            root.after(260, app._squish_restore)
            app.show_bubble(ROLL_TEMPLATE.format(88.88), 1500,
                            roll=(ROLL_TEMPLATE, 11.11, 88.88))
            app._squish_ok = True

        def hop_test():
            app.hop()
            app._hop_tested = True

        def done():
            chat_info = "pending"
            for m in app.chat_history:
                if m["role"] == "assistant":
                    chat_info = m["content"][:30].replace("\n", " ")
            write_log("selftest.log",
                      f"STATUS: {app.status}\n"
                      f"IMAGE: {'loaded' if app.img else 'placeholder'}\n"
                      f"FRAMES: {sorted(app.frames.keys()) if app.frames else 'none'}\n"
                      f"PIL: {HAS_PIL}\n"
                      f"SCALE: {app.scale}\n"
                      f"WALK: {app.walker.state}\n"
                      f"AFF: {app.state['affection']:.0f}\n"
                      f"CHAT: {chat_info}\n"
                      f"BUBBLE: {app.bubble.win.winfo_ismapped() if app.bubble else 'no'}\n"
                      f"EXITBTN: {app.exit_cv.winfo_ismapped()}\n"
                      f"SQUISH: {getattr(app, '_squish_ok', False)}\n"
                      f"MODE: {app.state['mode']}\n"
                      f"TRAY: {app.tray is not None}\n"
                      f"PSUTIL: {HAS_PSUTIL} GPU: {GPU_AVAILABLE}\n"
                      f"HOP: {getattr(app, '_hop_tested', False)}\n"
                      f"LAST_TOTAL: {app._last_total}\n"
                      f"TODAY: {app.state['today']} used {app.state['used_today']:.2f}\n"
                      f"LOWLINE: {app.state['low_line']} sound {app.state['sound']}\n"
                      f"FEEDTYPE: {type(pick_line(FEED_LINES, '')).__name__}\n"
                      f"DOZE: {app.dozing} night={is_night()}\n"
                      f"GLIDE_OK: {not app.gliding}\n"
                      f"Sound files: {(TOOL_DIR / 'pop.wav').exists()}/"
                      f"{(TOOL_DIR / 'boing.wav').exists()}\n"
                      f"DIR: {TOOL_DIR}\nOK")
            if app.tray:
                try:
                    app.tray.stop()
                except Exception:
                    pass
            root.destroy()

        root.after(800, start_chat_test)
        root.after(2400, squish_test)
        root.after(3200, hop_test)
        root.after(7000, done)
    root.mainloop()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        log_crash("main 未捕获异常", traceback.format_exc())
