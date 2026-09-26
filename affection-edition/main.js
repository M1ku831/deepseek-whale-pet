// ============================================================================
// dsh-whale-widget 桌面版 —— Electron 主进程
// ----------------------------------------------------------------------------
// 一个透明、无边框、置顶的桌面小鲸鱼挂件窗口。
// 用户数据（userdata.json）存放在 EXE 同目录；API_KEY / 平台令牌经 AES-GCM
// 加密后写入（见 lib/core.js）。
// ============================================================================
'use strict'

const { app, BrowserWindow, ipcMain, screen } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const https = require('node:https')
const { createWhaleCore } = require('./lib/core.js')

const isDev = !app.isPackaged
// 冒烟测试用独立 userData：不与正式实例抢单实例锁（可在桌宠运行时并行测试）
if (process.argv.includes('--smoke')) {
  try { app.setPath('userData', path.join(app.getPath('temp'), 'dsh-whale-smoke-userdata')) } catch (err) {}
}
// portable 单文件版：PORTABLE_EXECUTABLE_DIR 指向便携 EXE 所在目录；
// 安装版 / 开发态回退到 exe 目录 / 项目目录。
const exeDir =
  process.env.PORTABLE_EXECUTABLE_DIR ||
  (isDev ? app.getAppPath() : path.dirname(app.getPath('exe')))

const core = createWhaleCore({ dataFile: path.join(exeDir, 'userdata.json') })

let win = null
let dragState = null
let pendingMove = null
let moveTimer = null

const WINDOW_W = 560
const WINDOW_H = 840

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

// Windows 透明（分层）窗口在 setPosition 时存在尺寸漂移的已知问题：
// 每次移动窗口都会“长大”几像素（连续拖动时肉眼可见地抽搐+放大）。
// 因此移动一律用 setBounds 显式钉住宽高；拖动位移用 16ms 帧合并节流。
function moveWindowTo(x, y) {
  if (!win) return
  try {
    win.setBounds({ x: Math.round(x), y: Math.round(y), width: WINDOW_W, height: WINDOW_H })
  } catch (err) {}
}

function applyPendingMove() {
  if (!pendingMove) return
  const dx = pendingMove.dx
  const dy = pendingMove.dy
  pendingMove = null
  if (!win || !dragState) return
  moveWindowTo(dragState.baseX + dx, dragState.baseY + dy)
}

function createWindow() {
  win = new BrowserWindow({
    width: WINDOW_W,
    height: WINDOW_H,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setSkipTaskbar(true)

  // 恢复上次窗口位置（限制在工作区内；用 setBounds 钉住尺寸防漂移）
  const pos = core.getWinPos()
  if (pos) {
    try {
      const wa = screen.getPrimaryDisplay().workArea
      const x = clamp(pos.x, wa.x, wa.x + wa.width - WINDOW_W)
      const y = clamp(pos.y, wa.y, wa.y + wa.height - WINDOW_H)
      moveWindowTo(x, y)
    } catch (err) {}
  }

  win.on('close', () => {
    try {
      const [x, y] = win.getPosition()
      core.setWinPos({ x, y })
    } catch (err) {}
  })

  win.loadFile(path.join(app.getAppPath(), 'renderer', 'index.html'))

  // 冒烟测试：node_modules/.bin/electron . --smoke —— 启动 5 秒后自动退出。
  // Windows 便携版是 GUI 子系统，stdout 重定向拿不到内容，结果写进
  // %TEMP%\dsh-whale-smoke-result.log，同时仍打印一份方便开发态观察。
  if (process.argv.includes('--smoke')) {
    const smokeLines = []
    const smokeLog = (m) => { smokeLines.push(String(m)); console.log(String(m)) }
    smokeLog('SMOKE START')
    win.webContents.on('console-message', (e, level, message) => {
      smokeLog('[renderer:' + level + '] ' + message)
    })
    setTimeout(async () => {
      try {
        const r = await win.webContents.executeJavaScript(
          '({ api: !!window.whaleAPI, widget: !!window.__dshWhaleWidget, root: !!document.querySelector(".dshwv-root"), img: !!document.querySelector(".dshwv-img"), apiKeyInput: !!document.querySelector(".dshwv-secret"), menuRows: document.querySelectorAll(".dshwv-menu-row").length, autoLabel: document.body.textContent.indexOf("开机自启") >= 0, wordLabel: document.body.textContent.indexOf("学个单词") >= 0, spendLabel: document.body.textContent.indexOf("花费") >= 0, noteLabel: document.body.textContent.indexOf("便签") >= 0, remindLabel: document.body.textContent.indexOf("提醒") >= 0, stickyEl: !!document.querySelector(".dshwv-sticky"), zzzEl: !!document.querySelector(".dshwv-zzz"), achNew: document.body.textContent.indexOf("🏆 图鉴") >= 0, courseLabel: document.body.textContent.indexOf("课表") >= 0, courseSpanText: (document.querySelector(".dshwv-course-span")||{}).textContent || "", weatherLabel: document.body.textContent.indexOf("天气") >= 0, countLabel: document.body.textContent.indexOf("倒数") >= 0, foodLabel: document.body.textContent.indexOf("帮我选") >= 0, gameLabel: document.body.textContent.indexOf("猜数字") >= 0, todoLabel: document.body.textContent.indexOf("待办") >= 0, gameBoxEl: !!document.querySelector(".dshwv-game-box"), todoBoxEl: !!document.querySelector(".dshwv-todo-box"), courseBoxEl: !!document.querySelector(".dshwv-course-box"), achCount: (function(){ var m = document.body.textContent.match(/成就图鉴 \\d+\\/\\d+/); return m ? m[0] : "" })() })'
        )
        smokeLog('SMOKE RENDERER: ' + JSON.stringify(r))
      } catch (err) {
        smokeLog('SMOKE RENDERER ERROR: ' + err.message)
      }
      smokeLog('SMOKE OK: window created, size=' + JSON.stringify(win.getSize()) + ' pos=' + JSON.stringify(win.getPosition()))
      try {
        fs.writeFileSync(path.join(app.getPath('temp'), 'dsh-whale-smoke-result.log'), smokeLines.join('\r\n') + '\r\n', 'utf8')
      } catch (err) {}
      app.quit()
    }, 5000)
  }
}

function animateWindowTo(tx, ty) {
  if (!win) return
  const [x, y] = win.getPosition()
  const steps = 8
  let i = 0
  const timer = setInterval(() => {
    i++
    const t = i / steps
    const ease = 1 - Math.pow(1 - t, 3)
    moveWindowTo(x + (tx - x) * ease, y + (ty - y) * ease)
    if (i >= steps) clearInterval(timer)
  }, 18)
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle('whale:getConfig', () => core.getConfig())
ipcMain.handle('whale:saveConfig', (e, cfg) => core.saveConfig(cfg))
ipcMain.handle('whale:setApiKey', (e, key) => core.setApiKey(String(key || '')))
ipcMain.handle('whale:setPlatformToken', (e, token) => core.setPlatformToken(String(token || '')))
ipcMain.handle('whale:fetchBalance', () => core.getBalance())
ipcMain.handle('whale:fetchLastTurn', () => core.fetchLastTurn())
ipcMain.handle('whale:getUsageStats', () => core.getUsageStats())
ipcMain.handle('whale:quit', () => app.quit())

// —— 天气（v7）：免费 wttr.in，按 IP 自动定位城市；主进程拉取+内存缓存 90 分钟 ——
// wttr.in 偶发不通/超时，失败时返回 {ok:false}，渲染层静默显示获取失败即可
let weatherCache = null   // { at: ms, data: {...} }
let weatherBusy = false
const WEATHER_CACHE_MS = 90 * 60000
function fetchWeatherOnce() {
  return new Promise((resolve) => {
    const req = https.get('https://wttr.in/?format=j1&lang=zh', {
      headers: { 'User-Agent': 'curl/8.0.1' },
      timeout: 9000,
    }, (res) => {
      let body = ''
      res.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy() })
      res.on('end', () => {
        try {
          const j = JSON.parse(body)
          const cur = j.current_condition && j.current_condition[0]
          const today = j.weather && j.weather[0]
          if (!cur) return resolve(null)
          resolve({
            tempC: Number(cur.temp_C),
            feelsC: Number(cur.FeelsLikeC),
            humidity: Number(cur.humidity),
            precip: Number(cur.precipMM || 0),
            desc: (cur.weatherDesc && cur.weatherDesc[0] && cur.weatherDesc[0].value) || '',
            minC: today ? Number(today.mintempC) : null,
            maxC: today ? Number(today.maxtempC) : null,
          })
        } catch (err) { resolve(null) }
      })
    })
    req.on('timeout', () => { req.destroy(); resolve(null) })
    req.on('error', () => resolve(null))
  })
}
ipcMain.handle('whale:getWeather', async () => {
  if (weatherCache && Date.now() - weatherCache.at < WEATHER_CACHE_MS) {
    return weatherCache.data
  }
  if (weatherBusy) return { ok: false, busy: true }
  weatherBusy = true
  const data = await fetchWeatherOnce()
  weatherBusy = false
  if (!data) return { ok: false }
  const result = { ok: true, ...data }
  weatherCache = { at: Date.now(), data: result }
  return result
})

// —— 好感度数据（从鲸鱼娘桌宠移植）：独立 JSON 文件，先写临时文件再改名，断电不坏 ——
const affectionFile = path.join(exeDir, 'affection.json')
ipcMain.handle('whale:getAffection', () => {
  try {
    return JSON.parse(fs.readFileSync(affectionFile, 'utf8'))
  } catch (err) {
    return null
  }
})
ipcMain.handle('whale:saveAffection', (e, d) => {
  try {
    if (!d || typeof d !== 'object') return { ok: false }
    const tmp = affectionFile + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(d, null, 2), 'utf8')
    fs.renameSync(tmp, affectionFile)
    return { ok: true }
  } catch (err) {
    return { ok: false }
  }
})

// —— 开机自启（v3）：在用户「启动」文件夹放一个隐藏启动的 .vbs ——
// 用 UTF-16LE + BOM 写入（wscript 认识带 BOM 的 Unicode 脚本），路径含中文也不怕；
// Run 的第二个参数 0 表示不弹任何辅助窗口，桌宠窗口照常出现。
const startupFile = path.join(
  app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup',
  'dsh-whale-affection.vbs'
)
ipcMain.handle('whale:getStartup', () => {
  try {
    fs.accessSync(startupFile)
    return true
  } catch (err) {
    return false
  }
})
ipcMain.handle('whale:setStartup', (e, on) => {
  try {
    if (on) {
      const line = 'CreateObject("WScript.Shell").Run """' + app.getPath('exe') + '""", 0, False'
      fs.writeFileSync(startupFile, '\ufeff' + line + '\r\n', 'utf16le')
    } else {
      try { fs.unlinkSync(startupFile) } catch (err2) {}
    }
    return { ok: true }
  } catch (err) {
    return { ok: false }
  }
})

// 鼠标穿透：透明区域忽略鼠标事件（forward 保留 mousemove 供渲染层检测悬停）
ipcMain.on('whale:setIgnore', (e, ignore) => {
  if (win) {
    try {
      win.setIgnoreMouseEvents(!!ignore, { forward: true })
    } catch (err) {}
  }
})

// —— 散步模式（v5，Shimeji 式自由活动）——
// 渲染层自己算步进节奏，主进程只负责移动窗口和提供屏幕信息。
// walkStep 只做宽松兜底 clamp（允许窗口探出屏幕，这样"爬到屏幕顶再
// 摔下来"时露出来的正好只有鲸鱼本体），防渲染层算错导致窗口跑丢。
ipcMain.handle('whale:getWorkArea', () => {
  try {
    const wa = screen.getPrimaryDisplay().workArea
    return { x: wa.x, y: wa.y, w: wa.width, h: wa.height }
  } catch (err) {
    return null
  }
})
ipcMain.handle('whale:getPos', () => {
  if (!win) return null
  try {
    const [x, y] = win.getPosition()
    return { x, y }
  } catch (err) {
    return null
  }
})
ipcMain.handle('whale:walkStep', (e, x, y) => {
  if (!win) return null
  const px = Number(x)
  const py = Number(y)
  if (!isFinite(px) || !isFinite(py)) return null
  try {
    const wa = screen.getPrimaryDisplay().workArea
    const nx = clamp(px, wa.x - 600, wa.x + wa.width)
    const ny = clamp(py, wa.y - 900, wa.y + wa.height)
    moveWindowTo(nx, ny)
    return { x: nx, y: ny }
  } catch (err) {
    return null
  }
})

// 拖拽窗口：渲染层上报相对起点位移，主进程按 16ms 帧合并节流移动窗口
ipcMain.handle('whale:moveWindow', (e, dx, dy) => {
  if (!win) return null
  const px = Number(dx)
  const py = Number(dy)
  if (!isFinite(px) || !isFinite(py)) return null
  pendingMove = { dx: px, dy: py }
  if (!dragState) {
    try {
      const [wx, wy] = win.getPosition()
      dragState = { baseX: wx, baseY: wy }
    } catch (err) {
      return null
    }
  }
  if (!moveTimer) {
    moveTimer = setInterval(applyPendingMove, 16)
  }
  return null
})

// 拖拽结束：四分之一屏边缘吸附 + 限制在工作区内
ipcMain.handle('whale:dragEnd', () => {
  if (!win) return { h: null, v: null }
  if (moveTimer) {
    clearInterval(moveTimer)
    moveTimer = null
  }
  applyPendingMove() // 应用最后一次位移，保证吸附计算基于最终位置
  dragState = null
  try {
    const [wx, wy] = win.getPosition()
    const [ww, wh] = win.getSize()
    const bounds = win.getBounds()
    const disp = screen.getDisplayMatching(bounds)
    const wa = disp.workArea
    const centerX = wx + ww / 2
    const centerY = wy + wh / 2
    let hSnap = null
    let vSnap = null
    if (centerX < wa.x + wa.width / 4) hSnap = 'left'
    else if (centerX > wa.x + (wa.width * 3) / 4) hSnap = 'right'
    if (centerY < wa.y + wa.height / 4) vSnap = 'top'
    else if (centerY > wa.y + (wa.height * 3) / 4) vSnap = 'bottom'
    let tx = clamp(wx, wa.x, wa.x + wa.width - ww)
    let ty = clamp(wy, wa.y, wa.y + wa.height - wh)
    if (hSnap === 'left') tx = wa.x
    else if (hSnap === 'right') tx = wa.x + wa.width - ww
    if (vSnap === 'top') ty = wa.y
    else if (vSnap === 'bottom') ty = wa.y + wa.height - wh
    animateWindowTo(tx, ty)
    core.setWinPos({ x: tx, y: ty })
    return { h: hSnap, v: vSnap }
  } catch (err) {
    return { h: null, v: null }
  }
})

// ---------------------------------------------------------------------------
// 应用生命周期
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
