(function () {
if (window.__dshWhaleWidget) return
window.__dshWhaleWidget = true
// 桌面版：渲染层只能通过 preload 暴露的 window.whaleAPI 与主进程通信
if (!window.whaleAPI) return
var API = window.whaleAPI

var MIN_SCALE = 0.6
var MAX_SCALE = 2.5
var STEP = 0.1
var CLICK_SQ = 9
var REFRESH_MS = 60000
var CHANGE_MS = 900
var ANIM_MS = 700
var BUBBLE_MS = 5000
var FETCH_TIMEOUT_MS = 25000
var IMG_URL = './assets/DSniang1.png'
var GIF_URL = './assets/rua.gif'

var css = [
  // 桌面版：挂件尺寸只随 scale 变化（不依赖窗口视口），避免 Windows 透明窗口
  // 移动时尺寸微抖导致挂件抽搐/放大；1.5 倍 = 280px
  '.dshwv-root{position:fixed;right:0;bottom:0;--dshw-scale:1;--dshw-base:clamp(150px,calc(186.667px * var(--dshw-scale)),540px);width:var(--dshw-base);height:var(--dshw-base);pointer-events:none;user-select:none;-webkit-user-select:none;z-index:9999;font-family:inherit;transition:left .16s ease,top .16s ease,transform .3s ease}',
  '.dshwv-root.dshwv-left{transform:scaleX(-1)}',
  '.dshwv-root.dshwv-dragging{cursor:grabbing;transition:none}',
  '.dshwv-body{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:50% 100%;transition:transform .22s cubic-bezier(.34,1.56,.64,1)}',
  '.dshwv-img{position:absolute;right:0;bottom:0;width:59.45%;height:59.45%;display:block;pointer-events:none;-webkit-user-drag:none;user-select:none}',
  '.dshwv-bubble{position:absolute;left:0;top:0;width:100%;aspect-ratio:1026/700;pointer-events:none;z-index:1;--dshw-u:calc(var(--dshw-base) / 1026)}',
  '.dshwv-bubble svg{display:block;width:100%;height:100%;pointer-events:none}',
  '.dshwv-bubble svg path,.dshwv-bubble svg ellipse{pointer-events:none;cursor:pointer}',
  '.dshwv-bubble.dshwv-bubble-open svg path,.dshwv-bubble.dshwv-bubble-open svg ellipse{pointer-events:visiblePainted}',
  '.dshwv-bubble .dshwv-bshape,.dshwv-bubble .dshwv-b1,.dshwv-bubble .dshwv-b2{opacity:0;transform:scale(.7);transform-box:fill-box;transform-origin:50% 50%;transition:opacity .2s ease,transform .2s ease}',
  '.dshwv-bubble.dshwv-bubble-open .dshwv-bshape,.dshwv-bubble.dshwv-bubble-open .dshwv-b1,.dshwv-bubble.dshwv-bubble-open .dshwv-b2{opacity:1;transform:none}',
  '.dshwv-gif{position:absolute;left:44.25%;top:38%;transform:translate(-50%,-50%);max-width:calc(var(--dshw-u) * 560);max-height:calc(var(--dshw-u) * 400);display:none;opacity:0;transition:opacity .2s ease;pointer-events:none;-webkit-user-drag:none;user-select:none;object-fit:contain}',
  '.dshwv-root.dshwv-left .dshwv-gif{transform:translate(-50%,-50%) scaleX(-1)}',
  '.dshwv-bubble.dshwv-bubble-open .dshwv-gif{opacity:1}',
  '.dshwv-bubble.dshwv-bubble-open .dshwv-b2{transition-delay:0s}',
  '.dshwv-bubble.dshwv-bubble-open .dshwv-b1{transition-delay:.13s}',
  '.dshwv-bubble.dshwv-bubble-open .dshwv-bshape{transition-delay:.26s}',
  '.dshwv-bubble .dshwv-bshape{transition-delay:.1s}',
  '.dshwv-bubble .dshwv-b1{transition-delay:.2s}',
  '.dshwv-bubble .dshwv-b2{transition-delay:.3s}',
  '.dshwv-text{position:absolute;left:44.25%;top:38%;transform:translate(-50%,-50%);text-align:center;color:#536ba9;line-height:1.15;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .16s ease,transform .3s ease}',
  '.dshwv-bubble.dshwv-bubble-open .dshwv-text{opacity:1;transition:opacity .16s ease .36s,transform .3s ease}',
  '.dshwv-root.dshwv-left .dshwv-text{transform:translate(-50%,-50%) scaleX(-1)}',
  '.dshwv-label{font-size:calc(var(--dshw-u) * 66);font-weight:600;letter-spacing:.06em}',
  '.dshwv-amount{font-size:calc(var(--dshw-u) * 128);font-weight:800;line-height:1.05}',
  '.dshwv-period{font-size:calc(var(--dshw-u) * 104);font-weight:800;line-height:1.05}',
  '.dshwv-wrap{white-space:normal;max-width:calc(var(--dshw-u) * 560);line-height:1.2}',
  '.dshwv-hint{font-size:calc(var(--dshw-u) * 56);color:#9fb0d9;letter-spacing:.02em;margin-top:calc(var(--dshw-u) * 9);min-height:calc(var(--dshw-u) * 64);line-height:1.15}',
  '.dshwv-menu-btn{position:absolute;top:calc(40.55% + 4px);right:4px;width:26px;height:26px;border:none;border-radius:6px;background:rgba(32,49,112,.85);cursor:pointer;pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0;z-index:2;opacity:0;transition:opacity .15s ease}',
  '.dshwv-menu-btn.dshwv-menu-btn-visible{opacity:1}',
  '.dshwv-menu-btn span{display:block;width:14px;height:2px;background:#fff;border-radius:1px}',
  '.dshwv-menu-btn:hover{background:#203170}',
  '.dshwv-menu{position:fixed;min-width:196px;background:rgba(255,255,255,.92);border:1px solid rgba(32,49,112,.35);border-radius:10px;padding:10px 12px;opacity:0;transform:scale(.92) translateY(-4px);transform-origin:top right;transition:opacity .18s ease,transform .2s cubic-bezier(.34,1.56,.64,1);pointer-events:none;z-index:10000;box-shadow:0 6px 18px rgba(0,0,0,.18);color-scheme:light}',
  '.dshwv-menu.dshwv-menu-open{opacity:1;transform:scale(1) translateY(0);pointer-events:auto}',
  '.dshwv-menu-row{display:flex;align-items:center;gap:8px;margin:3px 0;color:#203170;font-size:12px;white-space:nowrap}',
  '.dshwv-range{flex:1;min-width:0;accent-color:#203170}',
  '.dshwv-number{width:44px;border:1px solid rgba(32,49,112,.4);border-radius:6px;padding:2px 4px;font-size:12px;color:#203170;background:#fff;box-sizing:border-box}',
  '.dshwv-number:disabled{opacity:.4;background:rgba(32,49,112,.06);cursor:not-allowed}',
  '.dshwv-sound{flex:1;border:1px solid rgba(32,49,112,.4);border-radius:6px;background:rgba(32,49,112,.08);color:#203170;font-size:12px;padding:3px 0;cursor:pointer}',
  '.dshwv-sound:hover{background:rgba(32,49,112,.16)}',
  '.dshwv-check{width:16px;height:16px;accent-color:#203170;cursor:pointer;flex:0 0 auto}',
  '.dshwv-menu-sep{height:1px;background:rgba(32,49,112,.25);margin:6px 0}',
  '.dshwv-volpct{width:44px;text-align:right;color:#203170;font-size:12px}',
  '.dshwv-secret{flex:1;min-width:0;border:1px solid rgba(32,49,112,.4);border-radius:6px;padding:3px 6px;font-size:12px;color:#203170;background:#fff;box-sizing:border-box}',
  '.dshwv-secret::placeholder{color:#9fb0d9}',
  '.dshwv-btn{border:1px solid rgba(32,49,112,.4);border-radius:6px;background:rgba(32,49,112,.08);color:#203170;font-size:12px;padding:3px 8px;cursor:pointer;flex:0 0 auto}',
  '.dshwv-btn:hover{background:rgba(32,49,112,.16)}',
  '.dshwv-quit{margin:2px 0 0;width:100%;padding:5px 0;border:1px solid rgba(224,67,63,.45);border-radius:6px;background:rgba(224,67,63,.06);color:#e0433f;font-size:12px;cursor:pointer}',
  '.dshwv-quit:hover{background:rgba(224,67,63,.14)}',
  // —— 好感互动（从鲸鱼娘桌宠移植），互动入口在右上角菜单 ——
  '.dshwv-inter{display:flex;gap:8px;flex:1}',
  '.dshwv-inter .dshwv-btn{flex:1;text-align:center}',
  '.dshwv-affsum{color:#203170;font-size:12px;font-weight:600}',
  // —— 好感互动动效：爱心粒子 / 呼吸 / 小跳 ——
  '.dshwv-heart{position:fixed;z-index:10002;pointer-events:none;line-height:1;will-change:transform,opacity;animation:dshwv-float 1.15s ease-out forwards}',
  '@keyframes dshwv-float{0%{opacity:0;transform:translateY(0) scale(.5)}14%{opacity:1}100%{opacity:0;transform:translateY(-92px) scale(1.15)}}',
  '.dshwv-img{transform-origin:50% 100%}',
  '.dshwv-img.dshwv-breathe{animation:dshwv-breathe 3.4s ease-in-out infinite}',
  '@keyframes dshwv-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.012,1.022)}}',
  '.dshwv-img.dshwv-hop{animation:dshwv-hop .62s cubic-bezier(.34,1.56,.64,1)}',
  '@keyframes dshwv-hop{0%,100%{transform:translateY(0)}35%{transform:translateY(-26px)}70%{transform:translateY(0)}}',
  // —— 散步模式（v5，Shimeji 式）：走路的"一颠一颠"感 ——
  '.dshwv-img.dshwv-walk{animation:dshwv-walkbob .52s ease-in-out infinite}',
  '@keyframes dshwv-walkbob{0%,100%{transform:translateY(0) rotate(0deg)}25%{transform:translateY(-9px) rotate(-2deg)}75%{transform:translateY(-9px) rotate(2deg)}}',
  // —— 使用说明弹窗（风格跟随右键菜单）——
  '.dshwv-help{position:fixed;width:272px;background:rgba(255,255,255,.96);border:1px solid rgba(32,49,112,.35);border-radius:10px;padding:12px 14px;color:#203170;font-size:12px;line-height:1.55;z-index:10000;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:0;transform:scale(.92) translateY(-4px);transform-origin:bottom right;transition:opacity .18s ease,transform .2s cubic-bezier(.34,1.56,.64,1);pointer-events:none;color-scheme:light}',
  '.dshwv-help.dshwv-help-open{opacity:1;transform:scale(1) translateY(0);pointer-events:auto}',
  '.dshwv-help h4{margin:0 0 6px;font-size:13px;font-weight:600}',
  '.dshwv-help p{margin:4px 0}',
  '.dshwv-help-foot{display:flex;gap:8px;margin-top:8px}',
  '.dshwv-help-foot .dshwv-btn{flex:1;text-align:center}',
  // —— v6 新增：菜单行数变多，空间不够时内部滚动（窗口 840px 定高，防裁切）——
  '.dshwv-menu{max-height:calc(100vh - 320px);overflow-y:auto}',
  // —— v6 一句话便签：悬在鲸鱼头顶上方的黄色小纸条 ——
  // —— v6 使用说明/图鉴行数变多：同样加限高保护 ——
  '.dshwv-help{max-height:calc(100vh - 340px);overflow-y:auto}',
  '.dshwv-sticky{position:absolute;right:2%;bottom:calc(100% + 8px);max-width:88%;box-sizing:border-box;background:#fff7cc;border:1px solid #e3cf7a;border-radius:8px 8px 8px 2px;box-shadow:0 3px 8px rgba(0,0,0,.15);padding:calc(var(--dshw-u) * 16) calc(var(--dshw-u) * 26);color:#7a6a1f;font-size:calc(var(--dshw-u) * 40);line-height:1.3;display:none;z-index:3;transform-origin:100% 100%;transition:transform .25s cubic-bezier(.34,1.56,.64,1)}',
  '.dshwv-root.dshwv-left .dshwv-sticky{transform-origin:0% 100%}',
  '.dshwv-sticky.dshwv-sticky-on{display:block;animation:dshwv-stickyin .3s cubic-bezier(.34,1.56,.64,1)}',
  '@keyframes dshwv-stickyin{0%{opacity:0;transform:scale(.6)}100%{opacity:1;transform:scale(1)}}',
  // —— v6 深夜打盹：头顶漂浮的 Zzz ——
  '.dshwv-zzz{position:absolute;right:10%;bottom:62%;color:#9fb0d9;font-weight:700;font-size:calc(var(--dshw-u) * 46);letter-spacing:.08em;display:none;pointer-events:none;z-index:2;animation:dshwv-zzzfloat 2.6s ease-in-out infinite;text-shadow:0 1px 0 #fff}',
  '.dshwv-root.dshwv-sleepy .dshwv-zzz{display:block}',
  '@keyframes dshwv-zzzfloat{0%,100%{opacity:.35;transform:translateY(0)}50%{opacity:1;transform:translateY(-7px)}}',
  // —— v6 戳一戳：连续点击时的左右抖动（排在 breathe/walk 之后，临时覆盖其动画）——
  '.dshwv-img.dshwv-shake{animation:dshwv-shake .55s ease}',
  '@keyframes dshwv-shake{0%,100%{transform:translateX(0) rotate(0deg)}15%{transform:translateX(-8px) rotate(-2deg)}30%{transform:translateX(8px) rotate(2deg)}45%{transform:translateX(-6px) rotate(-1.5deg)}60%{transform:translateX(6px) rotate(1.5deg)}80%{transform:translateX(-3px) rotate(0deg)}}',
  // —— v7 待办清单条目：点击整行切换完成，右侧 ✕ 删除 ——
  '.dshwv-todo-item{display:flex;align-items:flex-start;gap:6px;margin:3px 0;cursor:pointer}',
  '.dshwv-todo-item .dshwv-todo-text{flex:1;min-width:0;white-space:normal;word-break:break-all}',
  '.dshwv-todo-item.dshwv-todo-done .dshwv-todo-text{text-decoration:line-through;color:#9fb0d9}',
  '.dshwv-todo-del{border:none;background:none;color:#e0433f;cursor:pointer;font-size:12px;padding:0 2px;flex:0 0 auto}',
  '.dshwv-todo-del:hover{background:rgba(224,67,63,.12);border-radius:4px}',
  '.dshwv-todo-empty{color:#9fb0d9;margin:6px 0}',
  // —— v7 猜数字游戏状态行 ——
  '.dshwv-game-status{margin:6px 0;white-space:normal;min-height:32px}'
].join('\n')

var styleEl = document.createElement('style')
styleEl.textContent = css
document.head.appendChild(styleEl)

var root = document.createElement('div')
root.className = 'dshwv-root'

var img = document.createElement('img')
img.className = 'dshwv-img'
img.src = IMG_URL
img.alt = 'DeepSeek 余额'
img.draggable = false

var menuBtn = document.createElement('button')
menuBtn.type = 'button'
menuBtn.className = 'dshwv-menu-btn'
menuBtn.title = '菜单'
menuBtn.innerHTML = '<span></span><span></span><span></span>'
menuBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu() })

var menuBox = document.createElement('div')
menuBox.className = 'dshwv-menu'
function menuLabel(text) {
  var s = document.createElement('span')
  s.textContent = text
  return s
}
function menuRow() {
  var r = document.createElement('div')
  r.className = 'dshwv-menu-row'
  return r
}
var scaleInput = document.createElement('input')
scaleInput.type = 'range'
scaleInput.min = String(MIN_SCALE)
scaleInput.max = String(MAX_SCALE)
scaleInput.step = '0.1'
scaleInput.className = 'dshwv-range'
scaleInput.value = '1.5'
var scaleNumber = document.createElement('input')
scaleNumber.type = 'number'
scaleNumber.min = '1'
scaleNumber.max = '20'
scaleNumber.step = '1'
scaleNumber.className = 'dshwv-number'
scaleNumber.value = '10'
scaleInput.addEventListener('pointerdown', function () { root.style.transition = 'none' })
scaleInput.addEventListener('input', function () { setScale(scaleInput.value) })
scaleInput.addEventListener('change', function () { root.style.transition = '' })
scaleNumber.addEventListener('focus', function () { root.style.transition = 'none' })
scaleNumber.addEventListener('blur', function () { root.style.transition = '' })
scaleNumber.addEventListener('input', function () {
  var v = Math.round(Number(scaleNumber.value))
  var s = MIN_SCALE + Math.max(0, Math.min(20, v) - 1) * (MAX_SCALE - MIN_SCALE) / 19
  setScale(s)
})
scaleNumber.addEventListener('change', function () {
  var v = Math.round(Number(scaleNumber.value))
  var s = MIN_SCALE + Math.max(0, Math.min(20, v) - 1) * (MAX_SCALE - MIN_SCALE) / 19
  setScale(s)
  root.style.transition = ''
})
var soundSelect = document.createElement('select')
soundSelect.className = 'dshwv-sound'
function soundOpt(value, label) {
  var o = document.createElement('option')
  o.value = value
  o.textContent = label
  return o
}
soundSelect.appendChild(soundOpt('duck', '小黄鸭'))
soundSelect.appendChild(soundOpt('fx1', '音效1'))
soundSelect.addEventListener('change', function () { setSoundSet(soundSelect.value) })
var usageSelect = document.createElement('select')
usageSelect.className = 'dshwv-sound'
usageSelect.appendChild(soundOpt('ledger', '小鲸鱼记账 (推荐)'))
usageSelect.appendChild(soundOpt('token', '实时·令牌 (需平台令牌)'))
usageSelect.addEventListener('change', function () { setUsageMode(usageSelect.value) })
var peakSelect = document.createElement('select')
peakSelect.className = 'dshwv-sound'
peakSelect.appendChild(soundOpt('default', '默认'))
peakSelect.appendChild(soundOpt('liangwen', '梁文峰谷'))
peakSelect.appendChild(soundOpt('qiangqiang', '!?强强?!'))
peakSelect.addEventListener('change', function () { setPeakMode(peakSelect.value) })
var bubbleToggle = document.createElement('input')
bubbleToggle.type = 'checkbox'
bubbleToggle.className = 'dshwv-check'
bubbleToggle.checked = true
bubbleToggle.title = '开启/关闭思考气泡'
bubbleToggle.addEventListener('change', function () { setBubbleOn(bubbleToggle.checked) })
var chatToggle = document.createElement('input')
chatToggle.type = 'checkbox'
chatToggle.className = 'dshwv-check'
chatToggle.checked = true
chatToggle.title = '开启/关闭自主闲聊（会省着弹，不打扰）'
chatToggle.addEventListener('change', function () {
  affection.chatOn = chatToggle.checked
  saveAffection()
})
var row1 = menuRow()
row1.appendChild(menuLabel('大小'))
row1.appendChild(scaleInput)
row1.appendChild(scaleNumber)
var row2 = menuRow()
row2.appendChild(menuLabel('音效'))
row2.appendChild(soundSelect)
var volInput = document.createElement('input')
volInput.type = 'range'
volInput.min = '0'
volInput.max = '1'
volInput.step = '0.05'
volInput.className = 'dshwv-range'
volInput.value = '0.9'
var volPct = document.createElement('span')
volPct.className = 'dshwv-volpct'
volPct.textContent = '90%'
volInput.addEventListener('input', function () { setVol(volInput.value) })
var row3 = menuRow()
row3.appendChild(menuLabel('音量'))
row3.appendChild(volInput)
row3.appendChild(volPct)
var row4 = menuRow()
row4.appendChild(menuLabel('用量'))
row4.appendChild(usageSelect)
var row5 = menuRow()
row5.appendChild(menuLabel('峰谷'))
row5.appendChild(peakSelect)
var row6 = menuRow()
row6.appendChild(menuLabel('气泡'))
row6.appendChild(bubbleToggle)
var row6b = menuRow()
row6b.appendChild(menuLabel('闲聊'))
row6b.appendChild(chatToggle)
var menuSep1 = document.createElement('div')
menuSep1.className = 'dshwv-menu-sep'
// —— API_KEY / 平台令牌（桌面版专用：凭据只进主进程，AES 加密写入 userdata.json）——
function secretInput(placeholder) {
  var inp = document.createElement('input')
  inp.type = 'password'
  inp.className = 'dshwv-secret'
  inp.placeholder = placeholder
  inp.autocomplete = 'off'
  inp.spellcheck = false
  return inp
}
function secretSaveBtn(label) {
  var btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'dshwv-btn'
  btn.textContent = label
  return btn
}
var apiKeyInput = secretInput('sk-... 未配置')
var apiKeySave = secretSaveBtn('保存')
function saveApiKey() {
  var v = apiKeyInput.value.trim()
  if (!v) { apiKeyInput.focus(); return }
  apiKeySave.disabled = true
  API.setApiKey(v).then(function (r) {
    apiKeyInput.value = ''
    apiKeyInput.placeholder = (r && r.ok) ? '已保存 ✓' : '保存失败'
    apiKeySave.disabled = false
    refresh(true)
  }).catch(function () {
    apiKeyInput.placeholder = '保存失败'
    apiKeySave.disabled = false
  })
}
apiKeySave.addEventListener('click', saveApiKey)
apiKeyInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveApiKey() })
var tokenInput = secretInput('未配置 (可选)')
var tokenSave = secretSaveBtn('保存')
function saveToken() {
  var v = tokenInput.value.trim()
  if (!v) { tokenInput.focus(); return }
  tokenSave.disabled = true
  API.setPlatformToken(v).then(function (r) {
    tokenInput.value = ''
    tokenInput.placeholder = (r && r.ok) ? '已保存 ✓' : '保存失败'
    tokenSave.disabled = false
    refresh(true)
  }).catch(function () {
    tokenInput.placeholder = '保存失败'
    tokenSave.disabled = false
  })
}
tokenSave.addEventListener('click', saveToken)
tokenInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveToken() })
var row7 = menuRow()
row7.appendChild(menuLabel('API_KEY'))
row7.appendChild(apiKeyInput)
row7.appendChild(apiKeySave)
var row8 = menuRow()
row8.appendChild(menuLabel('平台令牌'))
row8.appendChild(tokenInput)
row8.appendChild(tokenSave)
// —— 互动（好感系统，移植自鲸鱼娘桌宠）——
var menuSep3 = document.createElement('div')
menuSep3.className = 'dshwv-menu-sep'
var affSummary = document.createElement('span')
affSummary.className = 'dshwv-affsum'
function refreshAffSummary() {
  affSummary.textContent = Math.round(affection.score) + '/100 · ' + levelName(affection.score) + ' ' + heartsBar(affection.score)
}
var rowAff = menuRow()
rowAff.appendChild(menuLabel('好感'))
rowAff.appendChild(affSummary)
function interBtn(label, fn) {
  var b = document.createElement('button')
  b.type = 'button'
  b.className = 'dshwv-btn'
  b.textContent = label
  b.addEventListener('click', function () { closeMenu(); fn() })
  return b
}
var interBox = document.createElement('div')
interBox.className = 'dshwv-inter'
interBox.appendChild(interBtn('摸头', doPat))
interBox.appendChild(interBtn('喂米饭', doFeed))
interBox.appendChild(interBtn('查看好感', showAffection))
interBox.appendChild(interBtn('说明', toggleHelp))
var rowInter = menuRow()
rowInter.appendChild(interBox)
var menuSep2 = document.createElement('div')
menuSep2.className = 'dshwv-menu-sep'
// ============================================================
// —— v3 新增：学习陪读（番茄钟）/ 四级单词 / 喝水提醒 / 低余额预警 ——
// 全部离线实现，不调用任何 API；开关与统计存进 affection.json
// ============================================================
var STUDY_DONE_LINES = ['专注完成！主人最棒了！', '哇，坚持下来了！快去休息一下吧~', '认真学习的主人闪闪发光呢！', '今天的专注额度满格啦，鲸鱼娘好佩服！']
var WATER_LINES = ['该喝水啦！鲸鱼娘盯着你呢，快去接一杯~', '久坐魔法持续中……起来活动一下，顺便喝口水！', '咕嘟咕嘟……听到了吗？是你的水杯在叫你。', '补充水分！鲸鱼娘的海域禁止干旱哦~']
var WORDS = [
  ['abandon', 'v. 放弃；抛弃', 'Never abandon your dreams.'],
  ['absorb', 'v. 吸收；使专心', 'Plants absorb water through their roots.'],
  ['achieve', 'v. 达到；实现', 'Work hard, and you will achieve your goals.'],
  ['adapt', 'v. 适应；改编', 'She adapted quickly to college life.'],
  ['adequate', 'adj. 足够的；适当的', 'Get adequate sleep before the exam.'],
  ['adjust', 'v. 调整；适应', 'Adjust your chair to a comfortable height.'],
  ['admire', 'v. 钦佩；欣赏', 'I admire her courage.'],
  ['anxious', 'adj. 焦虑的', 'There is no need to be anxious about the results.'],
  ['apologize', 'v. 道歉', 'He apologized for being late.'],
  ['appreciate', 'v. 感激；欣赏', 'I really appreciate your help.'],
  ['approach', 'n./v. 方法；接近', 'Try a new approach to the problem.'],
  ['appropriate', 'adj. 恰当的；合适的', 'Wear appropriate clothes in the lab.'],
  ['avoid', 'v. 避免；避开', 'Avoid making the same mistake twice.'],
  ['aware', 'adj. 意识到的', 'Stay aware of the deadline.'],
  ['balance', 'n./v. 平衡；余额', 'Balance your study and rest.'],
  ['brief', 'adj. 简短的；短暂的', 'Keep your report brief and clear.'],
  ['capable', 'adj. 有能力的', 'You are capable of more than you think.'],
  ['challenge', 'n./v. 挑战', 'Every challenge makes you stronger.'],
  ['concentrate', 'v. 全神贯注', 'Concentrate on one thing at a time.'],
  ['confident', 'adj. 自信的', 'Stay confident in the interview.'],
  ['consider', 'v. 考虑；认为', 'Consider all the options before deciding.'],
  ['constant', 'adj. 持续的；不变的', 'Constant practice brings progress.'],
  ['contribute', 'v. 贡献；捐助', 'Everyone can contribute ideas in class.'],
  ['curious', 'adj. 好奇的', 'Stay curious about the world.'],
  ['decrease', 'v./n. 减少；降低', 'The cost decreased by ten percent.'],
  ['develop', 'v. 发展；培养', 'Develop a good study habit early.'],
  ['efficient', 'adj. 高效的', 'Good tools make revision efficient.'],
  ['encourage', 'v. 鼓励；促进', 'Good friends encourage each other.'],
  ['essential', 'adj. 必不可少的', 'Water is essential for all life.'],
  ['expand', 'v. 扩大；膨胀', 'Reading expands your mind.'],
  ['familiar', 'adj. 熟悉的', 'This song sounds familiar to me.'],
  ['focus', 'n./v. 焦点；集中', 'Focus on what you can control.'],
  ['gather', 'v. 收集；聚集', 'Gather your notes before the exam.'],
  ['gradual', 'adj. 逐渐的', 'Progress is a gradual process.'],
  ['imagine', 'v. 想象；设想', 'Imagine what you can build in four years.'],
  ['improve', 'v. 改善；提高', 'Small daily steps improve everything.'],
  ['independent', 'adj. 独立的', 'College teaches you to be independent.'],
  ['influence', 'n./v. 影响', 'Good books influence how we think.'],
  ['inspire', 'v. 激励；启发', 'Great teachers inspire their students.'],
  ['maintain', 'v. 维持；保养', 'Maintain a regular schedule.'],
  ['obstacle', 'n. 障碍', 'Every obstacle is a lesson in disguise.'],
  ['opportunity', 'n. 机会；良机', 'Seize every opportunity to learn.'],
  ['particular', 'adj. 特别的；讲究的', 'Is there a particular subject you like?'],
  ['patience', 'n. 耐心', 'Patience is a quiet kind of strength.'],
  ['perform', 'v. 表现；执行；表演', 'He performed well in the contest.'],
  ['persist', 'v. 坚持；持续', 'Persist, and you will get there.'],
  ['previous', 'adj. 先前的', 'Review the previous lesson tonight.'],
  ['process', 'n./v. 过程；处理', 'Do not rush — trust the process.'],
  ['progress', 'n./v. 进步；前进', 'Progress hides inside daily effort.'],
  ['realize', 'v. 意识到；实现', 'You will realize your own potential.'],
  ['recommend', 'v. 推荐；建议', 'Can you recommend a good book?'],
  ['refresh', 'v. 使清爽；刷新', 'A short walk can refresh your mind.'],
  ['remind', 'v. 提醒；使想起', 'Please remind me to drink water.'],
  ['schedule', 'n./v. 计划表；安排', 'Check your schedule every morning.'],
  ['seek', 'v. 寻找；追求', 'Seek help when you are stuck.'],
  ['struggle', 'n./v. 奋斗；挣扎', 'Struggle now, shine later.'],
  ['succeed', 'v. 成功；继承', 'Keep going and you will succeed.'],
  ['support', 'n./v. 支持；支撑', 'Your family will always support you.'],
  ['tidy', 'adj./v. 整洁的；整理', 'Keep your desk tidy before studying.'],
  ['wisdom', 'n. 智慧；才智', 'Wisdom grows from questions, not answers.']
]
// 学习陪读状态（不持久化：重启后重新计时即可；统计与时长选择持久化）
var studyEnd = null
var studyTotalMs = 0
var studyHalfShown = false
var studyTickTimer = null
function playQuack() {
  try {
    if (!pressAudio || !soundOn) return
    var a = pressAudio.cloneNode()
    a.volume = soundVol
    var p = a.play()
    if (p && typeof p.catch === 'function') p.catch(function () {})
  } catch (err) {}
}
function startStudy(min) {
  min = Math.max(5, Math.min(180, Math.round(Number(min) || 25)))
  affection.studyMin = min
  saveAffection()
  studyEnd = Date.now() + min * 60000
  studyTotalMs = min * 60000
  studyHalfShown = false
  studyBtn.textContent = '取消'
  burstHearts(3)
  showAffBubble([
    affLine('A', '开始专注 ' + min + ' 分钟！鲸鱼娘安静陪读~', '', true),
    affLine('C', '（闲聊暂停 · 完成可得 ♥ 好感 +' + Math.max(1, Math.round(min / 5)) + '）')
  ], 4200)
  studyTickTimer = setInterval(studyTick, 15000)
}
function studyTick() {
  if (!studyEnd) return
  var now = Date.now()
  if (now >= studyEnd) { finishStudy(); return }
  if (!studyHalfShown && now >= studyEnd - studyTotalMs / 2) {
    studyHalfShown = true
    if (!bubbleShown && !costBubbleActive && !customBubbleActive) {
      showAffBubble([affLine('A', '已专注一半啦！还剩 ' + Math.ceil((studyEnd - now) / 60000) + ' 分钟，加油！', '', true)], 3200)
    }
  }
}
function finishStudy() {
  var min = Math.round(studyTotalMs / 60000)
  var gain = Math.max(1, Math.round(min / 5))
  studyEnd = null
  studyTotalMs = 0
  if (studyTickTimer) { clearInterval(studyTickTimer); studyTickTimer = null }
  affection.studyCount = (affection.studyCount || 0) + 1
  affection.studyMinutes = (affection.studyMinutes || 0) + min
  if (isSleepHour()) affection.nightStudy = (affection.nightStudy || 0) + 1   // 成就：夜猫子见证
  var up = addAffection(gain)
  studyBtn.textContent = '开始'
  burstHearts(12)
  doHop()
  playQuack()
  showAffBubble(affBubbleLines(pickLine(STUDY_DONE_LINES, ''), up, gain), 5200)
}
function cancelStudy() {
  studyEnd = null
  studyTotalMs = 0
  if (studyTickTimer) { clearInterval(studyTickTimer); studyTickTimer = null }
  studyBtn.textContent = '开始'
  showAffBubble([affLine('A', '学习提前结束啦，休息一下也没关系哦~', '', true)], 3000)
}
// 四级单词：不重复循环，进度存 affection.json；菜单按钮与闲聊穿插共用
// v6：25% 概率改成"复习"旧词（只学不复习容易忘）
function showWord() {
  var review = WORDS.length > 10 && Math.random() < 0.25
  var i
  if (review) {
    do { i = Math.floor(Math.random() * WORDS.length) } while (i === (affection.wordIdx || 0) % WORDS.length)
  } else {
    i = (affection.wordIdx || 0) % WORDS.length
    affection.wordIdx = (i + 1) % WORDS.length
  }
  affection.wordCount = (affection.wordCount || 0) + 1   // 成就：单词收藏家
  saveAffection()
  var w = WORDS[i]
  showAffBubble([
    affLine(review ? 'A' : 'A', (review ? '🔁 复习一下：' : '📖 ') + w[0], '#e0433f'),
    affLine('A', w[1], '', true),
    affLine('C', w[2], '#9fb0d9', true)
  ], 6500)
}
// 喝水提醒：约 40~50 分钟一次，开关存 affection.json（默认开）
var WATER_MS_MIN = 40 * 60000
var WATER_MS_VAR = 10 * 60000
var nextWaterAt = 0
function waterGuardsOk() {
  if (!bubbleOn || bubbleShown || costBubbleActive || customBubbleActive || menuOpen || helpOpen || achOpen || popOpen()) return false
  if (drag && drag.active) return false
  if (studyEnd) return false
  return true
}
function setWaterOn(v) {
  affection.waterOn = !!v
  saveAffection()
  if (v && !nextWaterAt) nextWaterAt = Date.now() + WATER_MS_MIN + Math.random() * WATER_MS_VAR
}
setInterval(function () {
  if (!affection.waterOn || !nextWaterAt || Date.now() < nextWaterAt) return
  nextWaterAt = Date.now() + WATER_MS_MIN + Math.random() * WATER_MS_VAR
  if (!waterGuardsOk()) return
  burstHearts(2)
  showAffBubble([affLine('A', pickLine(WATER_LINES, ''), '', true)], 4200)
}, 60000)
// 低余额预警：余额 < ¥2 时每天最多提醒一次（口粮告急）
function checkLowBalance(nb) {
  if (!isFinite(nb) || nb >= 2) return
  if (affection.lastLowBalDay === todayKey()) return
  affection.lastLowBalDay = todayKey()
  saveAffection()
  setTimeout(function () {
    if (bubbleShown || costBubbleActive || customBubbleActive) return
    showAffBubble([
      affLine('A', '呜…余额只剩 ' + nb.toFixed(2) + ' 元啦！', '#e0433f', true),
      affLine('C', '鲸鱼娘的口粮不够了，记得去充值哦~')
    ], 5200)
  }, 4000)
}
// ============================================================
// —— v4 新增：实时峰谷时段播报（贴鲸鱼娘人设）——
// 时间表与 lib/core.js 的 isPeakTime 完全一致：
// 工作日 9:00–12:00、14:00–18:00（北京时间）为峰，周末全天谷
// ============================================================
var PEAK_SLOTS = [[9, 12], [14, 18]]
var PEAK_BOUNDS = [9, 12, 14, 18]
var WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
var VALLEY_LINES = [
  '嘀——现在是{谷}哦主人！半价狂欢，快来使用我叭~',
  '现在是{谷}！便宜时段，主人的 token 可以放心霍霍啦（小声）',
  '{谷}时段到啦！有什么大工程要跑吗？鲸鱼娘陪主人一起冲！',
  '现在可是{谷}哦，不跑点任务都对不起这个价格叭！',
  '嘘——{谷}中，半价跑任务的好时机，别辜负鲸鱼娘的守候呀~'
]
var PEAKTIME_LINES = [
  '呜…现在是{峰}，余额掉得快，主人省着点用哦~',
  '现在是{峰}……别怕，鲸鱼娘会替主人看好余额的！',
  '现在是{峰}哦，小任务先攒一攒，等{谷}再跑叭~',
  '提醒：{峰}中！轻量对话随便聊，重型任务先缓缓~',
  '哼，{峰}的 token 贵得像鲸鱼娘的米饭……主人忍一忍嘛'
]
function peakPeriodNames() {
  // 名字跟菜单"峰谷"趣味模式联动：默认/梁文峰谷/!?强强?!
  if (peakMode === 'liangwen') return ['梁文峰', '梁文谷']
  if (peakMode === 'qiangqiang') return ['!?峰峰?!', '!?谷谷?!']
  return ['峰时', '谷时']
}
function bjNow() { return new Date(Date.now() + 8 * 3600e3) }   // +8h 后读 getUTC* 即北京时间
function calcIsPeakNow() {
  var bj = bjNow()
  if (bj.getUTCDay() === 0 || bj.getUTCDay() === 6) return false // 周末全天谷
  var h = bj.getUTCHours()
  for (var i = 0; i < PEAK_SLOTS.length; i++) {
    if (h >= PEAK_SLOTS[i][0] && h < PEAK_SLOTS[i][1]) return true
  }
  return false
}
function nextPeakBoundary(nowMs) {
  // 从现在起往后找最近的峰/谷翻转整点（最多看 9 天，覆盖跨周末长谷）
  var bj = bjNow()
  for (var day = 0; day < 9; day++) {
    var wd = (bj.getUTCDay() + day) % 7
    if (wd === 0 || wd === 6) continue
    var base = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate() + day) - 8 * 3600e3
    for (var i = 0; i < PEAK_BOUNDS.length; i++) {
      var t = base + PEAK_BOUNDS[i] * 3600e3
      if (t > nowMs) return t
    }
  }
  return null
}
function humanSpan(min) {
  if (min < 1) return '不到 1 分钟'
  if (min < 60) return min + ' 分钟'
  var h = Math.floor(min / 60)
  if (min < 1440) return h + ' 小时' + (min % 60 ? ' ' + (min % 60) + ' 分' : '')
  return Math.floor(h / 24) + ' 天 ' + (h % 24) + ' 小时'
}
function p2(n) { return String(n).padStart(2, '0') }
function peakStatusText() {
  var names = peakPeriodNames()
  var nowMs = Date.now()
  var bound = nextPeakBoundary(nowMs)
  var txt = calcIsPeakNow() ? names[0] : names[1]
  if (!bound) return txt
  var b = new Date(bound + 8 * 3600e3)
  var bj = bjNow()
  var sameDay = b.getUTCFullYear() === bj.getUTCFullYear() && b.getUTCMonth() === bj.getUTCMonth() && b.getUTCDate() === bj.getUTCDate()
  var until = '至 ' + (sameDay ? '' : WEEKDAY_NAMES[b.getUTCDay()] + ' ') + p2(b.getUTCHours()) + ':' + p2(b.getUTCMinutes())
  return txt + ' · ' + until + '（还剩 ' + humanSpan(Math.max(0, Math.round((bound - nowMs) / 60000))) + '）'
}
function fmtPeakLine(isPeak) {
  var n = peakPeriodNames()
  var pool = isPeak ? PEAKTIME_LINES : VALLEY_LINES
  return pickLine(pool, '').replace(/\{峰\}/g, n[0]).replace(/\{谷\}/g, n[1])
}
function showPeakLine(ms) {
  showAffBubble([affLine('A', fmtPeakLine(calcIsPeakNow()), '', true)], ms || 4600)
}
// 每 30s 对表：进谷/进峰切换 → 排队播报；顺带刷新菜单"时段"行
var lastPeakState = null
var peakQueued = null
setInterval(function () {
  var p = calcIsPeakNow()
  if (lastPeakState === null) { lastPeakState = p; peakQueued = p }   // 启动后播报一次当前时段
  else if (p !== lastPeakState) { lastPeakState = p; peakQueued = p } // 实时切换播报
  updatePeakNowRow()
}, 30000)
// 每 5s 挑空闲时机弹出待播报消息（成就优先，其次峰谷；不打断摸头/菜单/学习陪读）
setInterval(function () {
  if (notifyQueue.length) {
    if (!bubbleOn) { notifyQueue.length = 0; return }
    if (bubbleShown || costBubbleActive || customBubbleActive || menuOpen || helpOpen || achOpen || popOpen()) return
    if (drag && drag.active) return
    if (studyEnd) return
    if (document.visibilityState !== 'visible') return
    var line = notifyQueue.shift()
    burstHearts(5)
    showAffBubble([affLine('A', line, '#e0433f', true)], 4200)
    return
  }
  if (peakQueued === null) return
  if (!bubbleOn) return
  if (bubbleShown || costBubbleActive || customBubbleActive || menuOpen || helpOpen || achOpen || popOpen()) return
  if (drag && drag.active) return
  if (studyEnd) return
  if (document.visibilityState !== 'visible') return
  var isPeak = peakQueued
  peakQueued = null
  if (!isPeak) burstHearts(3)   // 进谷撒爱心庆祝半价
  showAffBubble([affLine('A', fmtPeakLine(isPeak), '', true)], 4800)
}, 5000)
// 菜单"时段"行：实时显示当前峰谷 + 窗口 + 剩余时间
var peakNowSpan = document.createElement('span')
peakNowSpan.className = 'dshwv-affsum'
function updatePeakNowRow() { peakNowSpan.textContent = peakStatusText() }
var rowPeakNow = menuRow()
rowPeakNow.appendChild(menuLabel('时段'))
rowPeakNow.appendChild(peakNowSpan)
updatePeakNowRow()
// ============================================================
// —— v7 新增①：课表管家（内置示例课表，替换成你自己的课程即可）——
// 节次时间按常见秋季作息内置；若与学校实际有出入，改 BELL_TIMES 即可
// ============================================================
var BELL_TIMES = [
  ['08:00', '08:50'], ['09:00', '09:50'],
  ['10:10', '11:00'], ['11:10', '12:00'], ['12:10', '13:00'],
  ['14:30', '15:20'], ['15:30', '16:20'], ['16:30', '17:20'],
  ['18:00', '18:50'], ['19:00', '19:50']
]
var SEMESTER_START = '2026-08-31'   // 第 1 教学周的周一（改成你学校开学那一周）
// [周几(1=周一…5=周五), 起节, 止节, 课程, 教室, 周次(如 [2,5,9,18]=2-5 周和 9-18 周；null=每周)]
// 下面是示例课表，按同样格式替换成你自己的课程即可（行数不限）
var TIMETABLE = [
  [1, 1, 2, '示例课程A', 'A101', null],
  [1, 3, 5, '示例课程B', 'A102', [2, 5, 9, 18]],
  [2, 3, 4, '示例课程C', 'B201', null],
  [2, 9, 10, '示例课程D', 'B202', null],
  [3, 1, 2, '示例课程A', 'A101', null],
  [3, 6, 8, '示例课程E', 'B203', null],
  [4, 3, 4, '示例课程A', 'A101', null],
  [5, 3, 5, '示例课程B', 'A102', [2, 5, 9, 18]]
]
var COURSE_SOON_LINES = [
  '还有{min}分钟上{course}啦！教室 {room}，快准备叭主人！',
  '{course}要开始咯！在 {room}，课本带上没有呀~',
  '马上要上{course}了哦！{room}，鲸鱼娘目送你去教室~'
]
var COURSE_IN_LINES = [
  '{course}开始啦！认真听讲，别想鲸鱼娘哦（才怪）',
  '上课铃响啦！{course}，坐后排也要好好记笔记哦~',
  '{course}开课！鲸鱼娘在桌面守家，主人冲鸭~'
]
var courseOpen = false, gameOpen = false, todoOpen = false
// 好感/功能状态容器（v7 起提前到此处声明：课表/倒数/待办在初始化时就要读写它）
var affection = { score: 20, lastDay: '', lastPat: 0, lastFeed: 0, pats: 0, feeds: 0, days: 0, chatOn: true }
function popOpen() { return courseOpen || gameOpen || todoOpen }
function hmToMs(hm, dayOffset) {
  var p = hm.split(':')
  var d = new Date()
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (dayOffset || 0), Number(p[0]), Number(p[1]), 0, 0)
  return d.getTime()
}
// '08:00' → 当天毫秒偏移（纯函数，配合 base0 点 + day*86400e3 用）
function hmStrToMs(hm) {
  var p = hm.split(':')
  return (Number(p[0]) * 3600 + Number(p[1]) * 60) * 1000
}
function semesterWeek(nowMs) {
  var sy = SEMESTER_START.split('-')
  var start = new Date(Number(sy[0]), Number(sy[1]) - 1, Number(sy[2])).getTime()
  var base = new Date(nowMs)
  base = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()
  return Math.floor((base - start) / (7 * 86400e3)) + 1
}
function courseWeekHit(c, week) {
  if (!c[5]) return true
  // 周次是成对的段列表：[2,5,9,18] = 2-5 周 + 9-18 周
  for (var i = 0; i + 1 < c[5].length; i += 2) {
    if (week >= c[5][i] && week <= c[5][i + 1]) return true
  }
  return false
}
function dayCourses(weekday, week) {
  var out = []
  for (var i = 0; i < TIMETABLE.length; i++) {
    var c = TIMETABLE[i]
    if (c[0] === weekday && courseWeekHit(c, week)) out.push(c)
  }
  out.sort(function (a, b) { return a[1] - b[1] })
  return out
}
// 当前正在上（state='in'）或下一节课（state='before'）；往后最多找 7 天
// 纯函数：一切锚定 nowMs 所在那天，不依赖运行时"今天"
function nextCourseInfo(nowMs) {
  var nb = new Date(nowMs)
  var baseDay = new Date(nb.getFullYear(), nb.getMonth(), nb.getDate()).getTime()
  for (var day = 0; day <= 7; day++) {
    var week = semesterWeek(baseDay + day * 86400e3)   // 跨周时按那天的周次过滤
    if (week < 1 || week > 25) continue
    var d = new Date(baseDay + day * 86400e3)
    var wd = d.getDay()
    if (wd === 0 || wd === 6) continue
    var cs = dayCourses(wd, week)
    for (var i = 0; i < cs.length; i++) {
      var start = baseDay + hmStrToMs(BELL_TIMES[cs[i][1] - 1][0]) + day * 86400e3
      var end = baseDay + hmStrToMs(BELL_TIMES[cs[i][2] - 1][1]) + day * 86400e3
      if (nowMs < start) return { c: cs[i], start: start, end: end, state: 'before', day: day }
      if (nowMs < end) return { c: cs[i], start: start, end: end, state: 'in', day: day }
    }
  }
  return null
}
function courseName(c) { return c[3] }
function courseShortText(info) {
  var c = info.c
  var time = BELL_TIMES[c[1] - 1][0]
  var dayTxt = info.day === 0 ? '' : (info.day === 1 ? '明 ' : WEEKDAY_NAMES[new Date(info.start).getDay()] + ' ')
  return courseName(c) + ' ' + dayTxt + time + ' ' + c[4]
}
var courseSpan = document.createElement('span')
courseSpan.className = 'dshwv-course-span'
courseSpan.style.cssText = 'max-width:150px;white-space:normal;font-size:11px;color:#203170'
function updateCourseRow() {
  var info = nextCourseInfo(Date.now())
  if (!info) { courseSpan.textContent = '假期中，好好休息~'; return }
  if (info.state === 'in') {
    courseSpan.textContent = '上课中 · ' + courseName(info.c) + ' 至 ' + BELL_TIMES[info.c[2] - 1][1]
  } else {
    var left = Math.round((info.start - Date.now()) / 60000)
    courseSpan.textContent = '下节 ' + courseShortText(info) + '（' + (left < 1 ? '马上' : humanSpan(left) + '后') + '）'
  }
}
// 上课前 10 分钟提醒（每节课一次）；学习陪读中也照常提醒（上课优先）
var COURSE_ALERT_BEFORE = 10 * 60000
function courseAlertTick() {
  updateCourseRow()
  var info = nextCourseInfo(Date.now())
  if (!info) return
  var key = todayKey() + '@' + info.c[0] + '-' + info.c[1] + '-' + info.c[3]
  var main, detail
  if (info.state === 'in') {
    if (Date.now() - info.start > 2 * 60000) return
    if (affection.lastCourseAlert === key) return
    if (bubbleShown || costBubbleActive || customBubbleActive || menuOpen || helpOpen || achOpen || popOpen()) return
    main = pickLine(COURSE_IN_LINES, '').replace(/\{course\}/g, courseName(info.c))
  } else {
    var left = info.start - Date.now()
    if (left > COURSE_ALERT_BEFORE) return
    if (affection.lastCourseAlert === key) return
    if (bubbleShown || costBubbleActive || customBubbleActive || menuOpen || helpOpen || achOpen || popOpen()) return   // 被占用：下个 tick 再试
    if (left < -2 * 60000) { affection.lastCourseAlert = key; saveAffection(); return }   // 拖过 2 分钟就放弃
    main = pickLine(COURSE_SOON_LINES, '').replace(/\{course\}/g, courseName(info.c)).replace(/\{min\}/g, String(Math.max(1, Math.round(left / 60000)))).replace(/\{room\}/g, info.c[4])
  }
  affection.lastCourseAlert = key
  saveAffection()
  playQuack()
  doHop()
  burstHearts(3)
  detail = info.state === 'in' ? ('教室 ' + info.c[4] + ' · 下课 ' + BELL_TIMES[info.c[2] - 1][1]) : ('教室 ' + info.c[4])
  showAffBubble([affLine('A', '📚 ' + main, '#e0433f', true), affLine('C', detail)], 7000)
}
setInterval(courseAlertTick, 30000)
updateCourseRow()
var courseBtn = document.createElement('button')
courseBtn.type = 'button'
courseBtn.className = 'dshwv-btn'
courseBtn.textContent = '📚 课表'
courseBtn.title = '查看本周课表与教学周'
courseBtn.addEventListener('click', function () { closeMenu(); toggleCourse() })
var rowCourse = menuRow()
rowCourse.appendChild(menuLabel('课程'))
rowCourse.appendChild(courseSpan)
rowCourse.appendChild(courseBtn)
// —— 课表弹窗（复用说明弹窗样式）：教学周 + 今日课程 + 整周课表 ——
var courseBox = document.createElement('div')
courseBox.className = 'dshwv-help dshwv-course-box'
var courseTitle = document.createElement('h4')
var courseList = document.createElement('div')
var courseFoot2 = document.createElement('div')
courseFoot2.className = 'dshwv-help-foot'
var courseCloseBtn = document.createElement('button')
courseCloseBtn.type = 'button'
courseCloseBtn.className = 'dshwv-btn'
courseCloseBtn.textContent = '知道啦'
courseFoot2.appendChild(courseCloseBtn)
courseBox.appendChild(courseTitle)
courseBox.appendChild(courseList)
courseBox.appendChild(courseFoot2)
document.body.appendChild(courseBox)
function refreshCourseList() {
  var week = semesterWeek(Date.now())
  var todayWd = new Date().getDay()
  courseTitle.textContent = '📚 本周课表 · 第 ' + week + ' 教学周'
  var html = ''
  for (var wd = 1; wd <= 5; wd++) {
    var cs = dayCourses(wd, week)
    var tag = wd === todayWd ? ' ⭐今天' : ''
    html += '<p style="margin:3px 0"><b>周' + '一二三四五'[wd - 1] + '</b>' + tag + '</p>'
    if (!cs.length) {
      html += '<p style="margin:2px 0 6px;color:#9fb0d9">　· 无课，撒欢叭！</p>'
    } else {
      for (var i = 0; i < cs.length; i++) {
        var c = cs[i]
        html += '<p style="margin:2px 0 6px">　· ' + c[3] + '（' + c[1] + '-' + c[2] + '节 ' + BELL_TIMES[c[1] - 1][0] + '）' + c[4] + '</p>'
      }
    }
  }
  courseList.innerHTML = html
}
function positionCourse() {
  try {
    var b = menuBtn.getBoundingClientRect()
    var vp = viewport()
    courseBox.style.right = (vp.w - b.right) + 'px'
    courseBox.style.left = 'auto'
    courseBox.style.bottom = (vp.h - b.top) + 'px'
    courseBox.style.top = 'auto'
  } catch (err) {}
}
function toggleCourse() {
  courseOpen = !courseOpen
  if (courseOpen) {
    refreshCourseList()
    if (menuOpen) closeMenu()
    if (helpOpen) closeHelp()
    if (achOpen) toggleAch()
    if (gameOpen) toggleGame()
    if (todoOpen) toggleTodo()
    positionCourse()
  }
  courseBox.classList.toggle('dshwv-help-open', courseOpen)
}
courseCloseBtn.addEventListener('click', function (e) {
  e.stopPropagation()
  courseOpen = false
  courseBox.classList.remove('dshwv-help-open')
})
// ============================================================
// —— v7 新增②：天气播报（wttr.in 免费接口，主进程拉取+缓存）——
// ============================================================
var WEATHER_DESC_MAP = {
  'sunny': '晴', 'clear': '晴', 'partly cloudy': '多云', 'cloudy': '多云', 'overcast': '阴',
  'mist': '薄雾', 'fog': '雾', 'haze': '霾', 'light drizzle': '毛毛雨', 'patchy light drizzle': '毛毛雨',
  'light rain': '小雨', 'moderate rain': '中雨', 'heavy rain': '大雨', 'light rain shower': '阵雨',
  'moderate or heavy rain shower': '强阵雨', 'patchy rain possible': '可能有雨', 'patchy rain nearby': '局部有雨',
  'thundery outbreaks possible': '可能有雷雨', 'patchy light rain': '零星小雨', 'light snow': '小雪',
  'moderate snow': '中雪', 'heavy snow': '大雪', 'patchy snow possible': '可能有小雪', 'blowing snow': '风雪',
  'light sleet': '雨夹雪', 'light sleet showers': '雨夹雪'
}
function weatherDescZh(s) {
  var low = String(s || '').toLowerCase()
  if (WEATHER_DESC_MAP[low]) return WEATHER_DESC_MAP[low]
  if (/thunder/.test(low)) return '雷雨'
  if (/sleet/.test(low)) return '雨夹雪'
  if (/snow/.test(low)) return '雪'
  if (/rain|drizzle|shower/.test(low)) return '雨'
  if (/cloud/.test(low)) return '多云'
  if (/fog|mist|haze/.test(low)) return '雾'
  if (/sunny|clear/.test(low)) return '晴'
  return String(s || '—')
}
var weatherSpan = document.createElement('span')
weatherSpan.className = 'dshwv-affsum'
weatherSpan.textContent = '待获取…'
var weatherData = null
var RAIN_WORDS = /雨|雪|雷/
function applyWeather(d) {
  weatherData = d
  weatherSpan.textContent = weatherDescZh(d.desc) + ' ' + Math.round(d.tempC) + '°C · 今 ' + Math.round(d.minC) + '~' + Math.round(d.maxC) + '°C'
  if (RAIN_WORDS.test(weatherDescZh(d.desc)) || d.precip > 0.1) {
    // 雨雪天每天提醒一次带伞
    if (affection.lastRainNudge !== todayKey()) {
      affection.lastRainNudge = todayKey()
      saveAffection()
      setTimeout(function () {
        if (bubbleShown || costBubbleActive || customBubbleActive || menuOpen || helpOpen || achOpen || popOpen()) return
        burstHearts(3)
        showAffBubble([affLine('A', '☔ 今天有' + weatherDescZh(d.desc) + '哦！出门记得带伞，别淋湿啦主人~', '', true)], 5200)
      }, 6000)
    }
  }
}
function updateWeatherRow() {
  if (!API.getWeather) return
  API.getWeather().then(function (d) {
    if (!d || !d.ok) { if (!weatherData) weatherSpan.textContent = '天气获取失败'; return }
    applyWeather(d)
  }).catch(function () {})
}
var rowWeather = menuRow()
rowWeather.appendChild(menuLabel('天气'))
rowWeather.appendChild(weatherSpan)
updateWeatherRow()
setInterval(updateWeatherRow, 10 * 60000)
// ============================================================
// —— v7 新增③：倒数日（期末考试之类的目标日，菜单常显倒计时）——
// ============================================================
var cdSpan = document.createElement('span')
cdSpan.className = 'dshwv-affsum'
cdSpan.style.cssText = 'max-width:130px;white-space:normal;font-size:11px;color:#203170'
function daysUntil(dateStr) {
  var p = String(dateStr || '').split('-')
  if (p.length !== 3) return null
  var y = Number(p[0]), mo = Number(p[1]), da = Number(p[2])
  if (!isFinite(y) || !isFinite(mo) || !isFinite(da)) return null
  var t = new Date(y, mo - 1, da).getTime()
  if (!isFinite(t)) return null
  var chk = new Date(t)
  if (chk.getFullYear() !== y || chk.getMonth() !== mo - 1 || chk.getDate() !== da) return null   // 2027-13-40 这类进位输入
  return Math.round((t - hmToMs('00:00', 0)) / 86400e3)
}
function updateCountdownRow() {
  var cd = affection.countdown
  if (!cd || !cd.date) { cdSpan.textContent = '未设置'; return }
  var n = daysUntil(cd.date)
  if (n === null) { cdSpan.textContent = '日期格式不对'; return }
  if (n > 0) cdSpan.textContent = '距「' + cd.name + '」还有 ' + n + ' 天'
  else if (n === 0) cdSpan.textContent = '「' + cd.name + '」就是今天！！加油！！'
  else cdSpan.textContent = '「' + cd.name + '」已过 ' + -n + ' 天（可清除）'
}
var cdDateInput = document.createElement('input')
cdDateInput.type = 'text'
cdDateInput.className = 'dshwv-number'
cdDateInput.style.width = '82px'
cdDateInput.placeholder = '2027-01-18'
cdDateInput.autocomplete = 'off'
cdDateInput.spellcheck = false
cdDateInput.title = '目标日期，格式 2027-01-18'
var cdNameInput = document.createElement('input')
cdNameInput.type = 'text'
cdNameInput.className = 'dshwv-number'
cdNameInput.style.width = '64px'
cdNameInput.placeholder = '期末考试'
cdNameInput.maxLength = 10
cdNameInput.autocomplete = 'off'
cdNameInput.spellcheck = false
function setCountdown() {
  var date = cdDateInput.value.trim()
  var name = cdNameInput.value.trim() || '目标日'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || daysUntil(date) === null) {
    showAffBubble([affLine('A', '日期格式像这样哦：2027-01-18', '', true)], 3200)
    cdDateInput.focus()
    return
  }
  affection.countdown = { date: date, name: name }
  saveAffection()
  cdDateInput.value = ''
  cdNameInput.value = ''
  updateCountdownRow()
  var n = daysUntil(date)
  showAffBubble([affLine('A', n > 0 ? '记下啦！距「' + name + '」还有 ' + n + ' 天，鲸鱼娘陪你倒数~' : '「' + name + '」就是今天！冲鸭主人！', '', true)], 4200)
}
var cdSetBtn = secretSaveBtn('设')
cdSetBtn.addEventListener('click', setCountdown)
cdNameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') setCountdown() })
var cdClearBtn = secretSaveBtn('✕')
cdClearBtn.title = '清除倒数日'
cdClearBtn.addEventListener('click', function () {
  if (!affection.countdown) return
  affection.countdown = null
  saveAffection()
  updateCountdownRow()
  showAffBubble([affLine('A', '倒数日清除啦~', '', true)], 2200)
})
var rowCountdown = menuRow()
rowCountdown.appendChild(menuLabel('倒数'))
rowCountdown.appendChild(cdSpan)
updateCountdownRow()
var rowCdSet = menuRow()
rowCdSet.appendChild(menuLabel('　└'))
rowCdSet.appendChild(cdDateInput)
rowCdSet.appendChild(cdNameInput)
rowCdSet.appendChild(cdSetBtn)
rowCdSet.appendChild(cdClearBtn)
// ============================================================
// —— v7 新增④：干饭转盘（选择困难救星，随机决定这顿吃什么）——
// ============================================================
var FOODS = [
  '白米饭配番茄炒蛋', '黄焖鸡米饭', '麻辣香锅', '兰州拉面', '重庆小面',
  '蛋炒饭', '扬州炒饭', '饺 子', '馄 饨', '牛肉粉丝汤',
  '麻婆豆腐饭', '红烧肉套餐', '糖醋里脊饭', '宫保鸡丁饭', '鱼香肉丝饭',
  '麻辣烫', '冒 菜', '砂锅米线', '过桥米线', '桂林米粉',
  '锅盖面', '大煮干丝', '烧 饼', '煎饼果子', '包 子',
  '烧麦配豆浆', '石锅拌饭', '汉堡薯条', '鸡腿堡套餐', '拌 面',
  '盖浇饭', '食堂自选菜'
]
var FOOD_RESULT_LINES = [
  '就决定是「{food}」了！鲸鱼娘的推荐不会错~',
  '转出来啦：「{food}」！看着就很香叭~',
  '今晚吃「{food}」！不许反悔哦主人~',
  '铛铛——「{food}」！快去干饭，吃饱才有力气学习！',
  '「{food}」！要是和白米饭有关，鲸鱼娘可太羡慕了'
]
var foodSpan = document.createElement('span')
foodSpan.className = 'dshwv-affsum'
foodSpan.textContent = '今晚吃啥？'
var foodSpinning = false
function spinFood() {
  if (foodSpinning) return
  foodSpinning = true
  var flips = 7
  var iv = setInterval(function () {
    foodSpan.textContent = FOODS[Math.floor(Math.random() * FOODS.length)]
    if (--flips > 0) return
    clearInterval(iv)
    var pick = FOODS[Math.floor(Math.random() * FOODS.length)]
    foodSpan.textContent = pick
    foodSpinning = false
    setTimeout(function () {
      closeMenu()
      playQuack()
      doHop()
      burstHearts(4)
      showAffBubble([affLine('A', '🎲 ' + pickLine(FOOD_RESULT_LINES, '').replace(/\{food\}/g, pick), '', true), affLine('C', '不合胃口就再转一次叭（菜单·干饭）')], 5200)
    }, 350)
  }, 110)
}
var foodBtn = document.createElement('button')
foodBtn.type = 'button'
foodBtn.className = 'dshwv-btn'
foodBtn.textContent = '🎲 帮我选'
foodBtn.title = '选择困难时的干饭转盘'
foodBtn.addEventListener('click', spinFood)
var rowFood = menuRow()
rowFood.appendChild(menuLabel('干饭'))
rowFood.appendChild(foodSpan)
rowFood.appendChild(foodBtn)
// ============================================================
// —— v7 新增⑤：猜数字小游戏（1~100 七次机会，赢了好感 +3）——
// ============================================================
var gameBox = document.createElement('div')
gameBox.className = 'dshwv-help dshwv-game-box'
var gameTitle = document.createElement('h4')
gameTitle.textContent = '🎮 猜数字 · 1~100'
var gameStatus = document.createElement('p')
gameStatus.className = 'dshwv-game-status'
var gameInput = document.createElement('input')
gameInput.type = 'number'
gameInput.className = 'dshwv-number'
gameInput.style.width = '72px'
gameInput.min = '1'
gameInput.max = '100'
var gameGuessBtn = document.createElement('button')
gameGuessBtn.type = 'button'
gameGuessBtn.className = 'dshwv-btn'
gameGuessBtn.textContent = '猜！'
var gameNewBtn = document.createElement('button')
gameNewBtn.type = 'button'
gameNewBtn.className = 'dshwv-btn'
gameNewBtn.textContent = '再来一局'
var gameFoot = document.createElement('div')
gameFoot.className = 'dshwv-help-foot'
gameFoot.appendChild(gameGuessBtn)
gameFoot.appendChild(gameNewBtn)
gameBox.appendChild(gameTitle)
gameBox.appendChild(gameStatus)
gameBox.appendChild(gameInput)
gameBox.appendChild(gameFoot)
document.body.appendChild(gameBox)
var gameTarget = 0
var gameLeft = 7
function gameNewRound() {
  gameTarget = 1 + Math.floor(Math.random() * 100)
  gameLeft = 7
  gameInput.value = ''
  gameInput.disabled = false
  gameGuessBtn.disabled = false
  gameStatus.textContent = '鲸鱼娘心里想了一个 1~100 的数，7 次机会，开猜叭！'
}
function gameGuess() {
  var v = Math.round(Number(gameInput.value))
  if (!isFinite(v) || v < 1 || v > 100) { gameInput.focus(); return }
  gameLeft--
  if (v === gameTarget) {
    gameInput.disabled = true
    gameGuessBtn.disabled = true
    affection.guessWins = (affection.guessWins || 0) + 1
    var up = addAffection(3)
    burstHearts(9)
    doHop()
    playQuack()
    gameStatus.textContent = '🎉 猜中啦！就是 ' + gameTarget + '！' + (up ? '好感升级！' : '') + '好感 +3 · ' + Math.round(affection.score) + '/100'
    showAffBubble([affLine('A', '哇！被你猜到了！主人好厉害！♥ 好感 +3', '#e0433f', true)], 4200)
    return
  }
  if (gameLeft <= 0) {
    gameInput.disabled = true
    gameGuessBtn.disabled = true
    gameStatus.textContent = '机会用光啦～答案是 ' + gameTarget + '。哼哼，鲸鱼娘的心思没那么好猜！（点"再来一局"报仇）'
    showAffBubble([affLine('A', '嘿嘿，猜不到了叭～', '', true)], 3000)
    return
  }
  gameStatus.textContent = (v > gameTarget ? '⬇ ' + v + ' 太大了！' : '⬆ ' + v + ' 太小了！') + '还剩 ' + gameLeft + ' 次机会'
  gameInput.value = ''
  gameInput.focus()
}
gameGuessBtn.addEventListener('click', gameGuess)
gameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') gameGuess() })
gameNewBtn.addEventListener('click', function () { gameNewRound(); gameInput.focus() })
function positionGame() {
  try {
    var b = menuBtn.getBoundingClientRect()
    var vp = viewport()
    gameBox.style.right = (vp.w - b.right) + 'px'
    gameBox.style.left = 'auto'
    gameBox.style.bottom = (vp.h - b.top) + 'px'
    gameBox.style.top = 'auto'
  } catch (err) {}
}
function toggleGame() {
  gameOpen = !gameOpen
  if (gameOpen) {
    if (menuOpen) closeMenu()
    if (helpOpen) closeHelp()
    if (achOpen) toggleAch()
    if (courseOpen) toggleCourse()
    if (todoOpen) toggleTodo()
    positionGame()
  }
  gameBox.classList.toggle('dshwv-help-open', gameOpen)
}
var gameBtn = document.createElement('button')
gameBtn.type = 'button'
gameBtn.className = 'dshwv-btn'
gameBtn.textContent = '🎮 猜数字'
gameBtn.title = '和鲸鱼娘玩猜数字，赢了加好感'
gameBtn.addEventListener('click', function () { closeMenu(); toggleGame() })
var rowGame = menuRow()
rowGame.appendChild(menuLabel('游戏'))
rowGame.appendChild(gameBtn)
gameNewRound()
// ============================================================
// —— v7 新增⑥：待办清单（多条待办打勾管理，存 affection.json）——
// ============================================================
var todoBox = document.createElement('div')
todoBox.className = 'dshwv-help dshwv-todo-box'
var todoTitle = document.createElement('h4')
var todoList = document.createElement('div')
var todoInput = document.createElement('input')
todoInput.type = 'text'
todoInput.className = 'dshwv-secret'
todoInput.placeholder = '要做什么？回车添加'
todoInput.maxLength = 30
todoInput.autocomplete = 'off'
todoInput.spellcheck = false
var todoFoot2 = document.createElement('div')
todoFoot2.className = 'dshwv-help-foot'
var todoClearDoneBtn = document.createElement('button')
todoClearDoneBtn.type = 'button'
todoClearDoneBtn.className = 'dshwv-btn'
todoClearDoneBtn.textContent = '清空已完成'
var todoCloseBtn = document.createElement('button')
todoCloseBtn.type = 'button'
todoCloseBtn.className = 'dshwv-btn'
todoCloseBtn.textContent = '收好'
todoFoot2.appendChild(todoClearDoneBtn)
todoFoot2.appendChild(todoCloseBtn)
todoBox.appendChild(todoTitle)
todoBox.appendChild(todoList)
todoBox.appendChild(todoInput)
todoBox.appendChild(todoFoot2)
document.body.appendChild(todoBox)
function todos() {
  if (!Array.isArray(affection.todos)) affection.todos = []
  return affection.todos
}
function todoPending() {
  var n = 0
  var t = affection.todos || []
  for (var i = 0; i < t.length; i++) if (!t[i].done) n++
  return n
}
function refreshTodoList() {
  var t = todos()
  var n = todoPending()
  todoTitle.textContent = '📝 待办清单 · 还剩 ' + n + ' 件'
  if (!t.length) {
    todoList.innerHTML = '<p class="dshwv-todo-empty">空空如也～要记的事就写在上面吧！</p>'
    return
  }
  todoList.innerHTML = ''
  for (var i = 0; i < t.length; i++) {
    (function (idx) {
      var row = document.createElement('div')
      row.className = 'dshwv-todo-item' + (t[idx].done ? ' dshwv-todo-done' : '')
      var mark = document.createElement('span')
      mark.textContent = t[idx].done ? '☑' : '☐'
      var txt = document.createElement('span')
      txt.className = 'dshwv-todo-text'
      txt.textContent = t[idx].t
      row.appendChild(mark)
      row.appendChild(txt)
      var del = document.createElement('button')
      del.type = 'button'
      del.className = 'dshwv-todo-del'
      del.textContent = '✕'
      del.title = '删除'
      row.appendChild(del)
      row.addEventListener('click', function () {
        t[idx].done = !t[idx].done
        if (t[idx].done) {
          affection.todoDone = (affection.todoDone || 0) + 1
          burstHearts(2)
        }
        saveAffection()
        refreshTodoList()
        updateTodoRow()
      })
      del.addEventListener('click', function (e) {
        e.stopPropagation()
        t.splice(idx, 1)
        saveAffection()
        refreshTodoList()
        updateTodoRow()
      })
      todoList.appendChild(row)
    })(i)
  }
}
function updateTodoRow() {
  var n = todoPending()
  todoSpan.textContent = n ? '未完成 ' + n + ' 件' : '没有待办，轻松啦~'
}
function addTodo() {
  var v = todoInput.value.trim()
  if (!v) return
  var t = todos()
  if (t.length >= 20) {
    showAffBubble([affLine('A', '待办满 20 条啦！先完成几件再加叭~', '', true)], 3000)
    return
  }
  t.push({ t: v, done: false })
  todoInput.value = ''
  saveAffection()
  refreshTodoList()
  updateTodoRow()
}
todoInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') addTodo() })
todoClearDoneBtn.addEventListener('click', function () {
  affection.todos = todos().filter(function (x) { return !x.done })
  saveAffection()
  refreshTodoList()
  updateTodoRow()
})
todoCloseBtn.addEventListener('click', function (e) {
  e.stopPropagation()
  todoOpen = false
  todoBox.classList.remove('dshwv-help-open')
})
function positionTodo() {
  try {
    var b = menuBtn.getBoundingClientRect()
    var vp = viewport()
    todoBox.style.right = (vp.w - b.right) + 'px'
    todoBox.style.left = 'auto'
    todoBox.style.bottom = (vp.h - b.top) + 'px'
    todoBox.style.top = 'auto'
  } catch (err) {}
}
function toggleTodo() {
  todoOpen = !todoOpen
  if (todoOpen) {
    refreshTodoList()
    if (menuOpen) closeMenu()
    if (helpOpen) closeHelp()
    if (achOpen) toggleAch()
    if (courseOpen) toggleCourse()
    if (gameOpen) toggleGame()
    positionTodo()
  }
  todoBox.classList.toggle('dshwv-help-open', todoOpen)
}
var todoBtn = document.createElement('button')
todoBtn.type = 'button'
todoBtn.className = 'dshwv-btn'
todoBtn.textContent = '📝 待办'
todoBtn.title = '记作业、记事情，完成打勾'
todoBtn.addEventListener('click', function () { closeMenu(); toggleTodo() })
var todoSpan = document.createElement('span')
todoSpan.className = 'dshwv-affsum'
var rowTodo = menuRow()
rowTodo.appendChild(menuLabel('待办'))
rowTodo.appendChild(todoSpan)
rowTodo.appendChild(todoBtn)
updateTodoRow()
// 早上有未完成待办时，轻提醒一次（8~11 点之间闲聊 tick 顺带触发）
function todoNudge() {
  var h = new Date().getHours()
  if (h < 8 || h >= 11) return true
  if (affection.lastTodoNudge === todayKey()) return true
  var n = todoPending()
  if (!n) return true
  affection.lastTodoNudge = todayKey()
  saveAffection()
  burstHearts(2)
  showAffBubble([affLine('A', '☀ 早上好！待办里还有 ' + n + ' 件事没打勾哦，今天也加油叭主人~', '', true)], 4600)
  return false
}
// ============================================================
// —— v5 新增：成就图鉴（参考 OpenPets）——
// 达成即播报"🏆 解锁图鉴"；菜单"🏆 图鉴"可查全部进度
// （进度字段：affection.ach[id]=达成日；pats/feeds/studyMinutes/
//   wordCount/throwCount/days 全部复用现有统计）
// ============================================================
var ACHIEVEMENTS = [
  { id: 'first_pat', name: '初次接触', desc: '第一次摸头', test: function (a) { return (a.pats || 0) >= 1 } },
  { id: 'pat_20', name: '摸头达人', desc: '累计摸头 20 次', test: function (a) { return (a.pats || 0) >= 20 } },
  { id: 'pat_100', name: '摸头大师', desc: '累计摸头 100 次', test: function (a) { return (a.pats || 0) >= 100 } },
  { id: 'feed_10', name: '鲸鱼饲养员', desc: '累计喂饭 10 次', test: function (a) { return (a.feeds || 0) >= 10 } },
  { id: 'feed_50', name: '干饭搭档', desc: '累计喂饭 50 次', test: function (a) { return (a.feeds || 0) >= 50 } },
  { id: 'poke_20', name: '戳戳乐', desc: '累计戳她 20 次', test: function (a) { return (a.pokeCount || 0) >= 20 } },
  { id: 'study_60', name: '学习搭子', desc: '累计专注 1 小时', test: function (a) { return (a.studyMinutes || 0) >= 60 } },
  { id: 'study_300', name: '卷王之王', desc: '累计专注 5 小时', test: function (a) { return (a.studyMinutes || 0) >= 300 } },
  { id: 'study_600', name: '学海无涯', desc: '累计专注 10 小时', test: function (a) { return (a.studyMinutes || 0) >= 600 } },
  { id: 'night_owl', name: '夜猫子见证', desc: '在深夜（23点后）完成过一次专注', test: function (a) { return (a.nightStudy || 0) >= 1 } },
  { id: 'word_30', name: '单词收藏家', desc: '跟她学 30 个单词', test: function (a) { return (a.wordCount || 0) >= 30 } },
  { id: 'word_100', name: '词汇大亨', desc: '跟她学 100 个单词', test: function (a) { return (a.wordCount || 0) >= 100 } },
  { id: 'throw_5', name: '惯性定律', desc: '把她甩飞 5 次', test: function (a) { return (a.throwCount || 0) >= 5 } },
  { id: 'topup_1', name: '小金库', desc: '见证过一次余额上涨', test: function (a) { return (a.topups || 0) >= 1 } },
  { id: 'guess_1', name: '读心玩家', desc: '猜数字赢过她一次', test: function (a) { return (a.guessWins || 0) >= 1 } },
  { id: 'todo_10', name: '打勾大师', desc: '累计完成 10 件待办', test: function (a) { return (a.todoDone || 0) >= 10 } },
  { id: 'days_7', name: '相伴一周', desc: '相伴 7 天', test: function (a) { return (a.days || 0) >= 7 } },
  { id: 'days_30', name: '月之契约', desc: '相伴 30 天', test: function (a) { return (a.days || 0) >= 30 } }
]
var notifyQueue = []
function checkAchievements() {
  affection.ach = affection.ach || {}
  var fresh = []
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i]
    if (!affection.ach[a.id] && a.test(affection)) {
      affection.ach[a.id] = todayKey()
      fresh.push(a)
    }
  }
  if (fresh.length) {
    for (var j = 0; j < fresh.length; j++) notifyQueue.push('🏆 解锁图鉴 · ' + fresh[j].name + '！')
    saveAffection()
  }
}
// —— 图鉴弹窗（复用使用说明的弹窗样式）——
var achBox = document.createElement('div')
achBox.className = 'dshwv-help'
var achTitle = document.createElement('h4')
var achList = document.createElement('div')
var achFoot2 = document.createElement('div')
achFoot2.className = 'dshwv-help-foot'
var achCloseBtn = document.createElement('button')
achCloseBtn.type = 'button'
achCloseBtn.className = 'dshwv-btn'
achCloseBtn.textContent = '知道啦'
achFoot2.appendChild(achCloseBtn)
achBox.appendChild(achTitle)
achBox.appendChild(achList)
achBox.appendChild(achFoot2)
document.body.appendChild(achBox)
var achOpen = false
function refreshAchList() {
  checkAchievements()   // 打开图鉴先补算一遍：早已达成的立即点亮+排队播报
  affection.ach = affection.ach || {}
  var n = 0
  var html = ''
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i]
    var got = !!affection.ach[a.id]
    if (got) n++
    html += '<p style="margin:3px 0">' + (got ? '✅' : '⬜') + ' <b>' + a.name + '</b> — ' + a.desc + (got ? '（' + affection.ach[a.id] + ' 达成）' : '') + '</p>'
  }
  achTitle.textContent = '🏆 成就图鉴 ' + n + '/' + ACHIEVEMENTS.length
  achList.innerHTML = html
}
function positionAch() {
  try {
    var b = menuBtn.getBoundingClientRect()
    var vp = viewport()
    achBox.style.right = (vp.w - b.right) + 'px'
    achBox.style.left = 'auto'
    achBox.style.bottom = (vp.h - b.top) + 'px'
    achBox.style.top = 'auto'
  } catch (err) {}
}
function toggleAch() {
  achOpen = !achOpen
  if (achOpen) {
    refreshAchList()
    if (menuOpen) closeMenu()
    if (helpOpen) closeHelp()
    positionAch()
  }
  achBox.classList.toggle('dshwv-help-open', achOpen)
}
achCloseBtn.addEventListener('click', function (e) {
  e.stopPropagation()
  achOpen = false
  achBox.classList.remove('dshwv-help-open')
})
// ============================================================
// —— v5 新增：散步模式（参考 Shimeji）——
// 每 2~6 分钟出来溜达一趟：贴着屏幕底部走一段（朝向随方向翻转、
// 一颠一颠）、偶尔小概率爬到屏幕顶再"摔"下来。拖拽/学习/菜单
// 都会让她立刻停下；菜单"散步"可关。
// ============================================================
var WALK_LINES = ['溜达溜达~鲸鱼娘巡视领地中！', '咦，那边是不是有米饭的香味？', '锻炼尾鳍，保持身材！（才不是胖！）', '今天也要在全屏幕巡逻！']
var WALK_WIN_W = 560
var WALK_WIN_H = 840
var WALK_PET = 280          // 鲸鱼本体在窗口右下角的大小（scale=1 时；clamp 用宽松值即可）
var walkTimer = null        // 步进循环
var walkSleep = null        // 下一次散步延时
var walkArea = null         // 工作区缓存
var walkPos = null          // 窗口当前位置缓存
function walkGuardsOk() {
  if (affection.walkOn === false) return false
  if (isSleepHour()) return false   // v6：深夜她在打盹，不出来散步
  if (studyEnd || achOpen || helpOpen || menuOpen || popOpen()) return false
  if (drag && drag.active) return false
  if (glideTimer) return false
  if (document.visibilityState !== 'visible') return false
  return true
}
function walkCleanup() {
  if (walkTimer) { clearInterval(walkTimer); walkTimer = null }
  img.classList.remove('dshwv-walk')
  express()
}
function stopWalk() {
  walkCleanup()
  scheduleWalk()
}
function scheduleWalk() {
  if (walkSleep) clearTimeout(walkSleep)
  walkSleep = setTimeout(function () {
    walkSleep = null
    walkTick()
  }, 120000 + Math.random() * 240000)
}
function walkTick() {
  if (walkGuardsOk()) {
    API.getWorkArea().then(function (wa) {
      if (!wa || !walkGuardsOk()) { scheduleWalk(); return }
      walkArea = wa
      API.getPos().then(function (p) {
        if (!p || !walkGuardsOk()) { scheduleWalk(); return }
        walkPos = p
        if (Math.random() < 0.2) walkClimbAndFall()
        else walkStroll()
      })
    }).catch(function () { scheduleWalk() })
  } else {
    scheduleWalk()
  }
}
function walkStroll() {
  var wa = walkArea
  var minX = wa.x - WALK_WIN_W + WALK_PET   // 鲸鱼刚好贴屏幕左缘
  var maxX = wa.x + wa.w - WALK_WIN_W       // 鲸鱼贴右缘
  if (maxX < minX) maxX = minX
  var targetX = minX + (0.08 + Math.random() * 0.84) * (maxX - minX)
  var targetY = wa.y + wa.h - WALK_WIN_H    // 贴屏幕底（地面）
  var dir = targetX >= walkPos.x ? 1 : -1
  var stepPx = Math.max(2, Math.round((60 + Math.random() * 50) * 0.03))   // 60~110 px/s
  if (dir < 0) root.classList.add('dshwv-left')
  else root.classList.remove('dshwv-left')
  if (Math.random() < 0.2) showAffBubble([affLine('A', pickLine(WALK_LINES, ''), '', true)], 2600)
  img.classList.add('dshwv-walk')
  walkTimer = setInterval(function () {
    if (!walkGuardsOk()) { walkCleanup(); scheduleWalk(); return }
    if (Math.abs(targetX - walkPos.x) <= stepPx) {
      walkPos.x = targetX
      walkPos.y = targetY
      API.walkStep(targetX, targetY)
      walkCleanup()
      scheduleWalk()
      return
    }
    walkPos.x += dir * stepPx
    var dy = targetY - walkPos.y
    if (dy) walkPos.y += Math.max(-stepPx, Math.min(stepPx, dy))
    API.walkStep(walkPos.x, walkPos.y)
  }, 30)
}
function walkClimbAndFall() {
  var wa = walkArea
  var topY = wa.y - (WALK_WIN_H - WALK_PET - 60)   // 鲸鱼探头到屏幕顶（略留 60px 看得到头顶）
  var bottomY = wa.y + wa.h - WALK_WIN_H
  var phase = 0
  var phaseT = 0
  var guard = 0
  showAffBubble([affLine('A', '看我的弹跳！咻——', '', true)], 1800)
  doHop()
  walkTimer = setInterval(function () {
    if (!walkGuardsOk()) { walkCleanup(); scheduleWalk(); return }
    if (++guard > 500) { walkCleanup(); scheduleWalk(); return }
    if (phase === 0) {
      walkPos.y -= 42
      if (walkPos.y <= topY) {
        walkPos.y = topY
        phase = 1
        showAffBubble([affLine('A', '哇……好高的视野！下面见啦——啊啊啊——！', '', true)], 1600)
        return
      }
    } else if (phase === 1) {
      if (++phaseT > 25) phase = 2
      return
    } else {
      walkPos.y += 52
      if (walkPos.y >= bottomY) {
        walkPos.y = bottomY
        API.walkStep(walkPos.x, walkPos.y)
        walkCleanup()
        petSquish()
        playQuack()
        showAffBubble([affLine('A', pickLine(THROW_LINES, ''), '', true)], 2400)
        scheduleWalk()
        return
      }
    }
    API.walkStep(walkPos.x, walkPos.y)
  }, 26)
}
scheduleWalk()
// —— v5 菜单行：散步开关 ——
var walkToggle = document.createElement('input')
walkToggle.type = 'checkbox'
walkToggle.className = 'dshwv-check'
walkToggle.checked = true
walkToggle.title = '每隔几分钟在屏幕上溜达一会儿（Shimeji 式自由活动）'
walkToggle.addEventListener('change', function () {
  affection.walkOn = walkToggle.checked
  saveAffection()
  if (!walkToggle.checked) {
    if (walkTimer) { clearInterval(walkTimer); walkTimer = null }
    if (walkSleep) { clearTimeout(walkSleep); walkSleep = null }
    img.classList.remove('dshwv-walk')
  } else {
    scheduleWalk()
  }
  showAffBubble([affLine('A', walkToggle.checked ? '好耶！可以满屏溜达啦！' : '好嘛……那我安静待在原地。', '', true)], 2600)
})
var rowWalk = menuRow()
rowWalk.appendChild(menuLabel('散步'))
rowWalk.appendChild(walkToggle)
// ============================================================
// —— v6 新增：戳一戳 / 节日彩蛋 / 深夜打盹 / 便签 / 提醒 / 本周花费 ——
// ============================================================
// —— 戳一戳：2.2 秒内快速连点 ≥3 次，反应按连击数递进 ——
var POKE_LINES_3 = ['呀！别戳啦，好痒！', '呜哇，突然袭击！', '戳戳戳…要被戳出坑了啦！']
var POKE_LINES_4 = ['喂喂喂！再戳要漏气啦！！', '别戳了别戳了，头都晕了~', '哼，再戳我可要躲了哦！']
var POKE_LINES_5 = ['再戳我真的要生气了哦！！哼！', '鼓脸.max……好啦好啦逗你的~', '……好吧，让你戳。谁让你是主人呢（小声）']
var pokeTimes = []
var pokeShakeTimer = null
function pokeTap() {
  var now = Date.now()
  pokeTimes.push(now)
  while (pokeTimes.length && now - pokeTimes[0] > 2200) pokeTimes.shift()
  if (pokeTimes.length < 3) return false
  var burst = pokeTimes.length
  pokeTimes = []
  affection.pokeCount = (affection.pokeCount || 0) + burst   // 成就：戳戳乐
  saveAffection()
  petSquish()
  playQuack()
  if (pokeShakeTimer) { clearTimeout(pokeShakeTimer); pokeShakeTimer = null }
  img.classList.remove('dshwv-shake')
  void img.offsetWidth   // 强制重排，保证连戳时抖动动画能重新播放
  img.classList.add('dshwv-shake')
  pokeShakeTimer = setTimeout(function () { img.classList.remove('dshwv-shake'); pokeShakeTimer = null }, 600)
  burstHearts(Math.min(8, 2 + burst))
  var pool = burst >= 5 ? POKE_LINES_5 : (burst === 4 ? POKE_LINES_4 : POKE_LINES_3)
  var lines = [affLine('A', pickLine(pool, ''), '', true)]
  if (Math.random() < 0.18) lines.push(affLine('C', '（她快速回戳了你一下！）'))
  showAffBubble(lines, 2800)
  return true
}
// —— 节日彩蛋：公历节日当天首次启动的专属问候（与每日见面奖励互相独立）——
var HOLIDAYS = {
  '01-01': ['🎉 新年快乐！今年的第一份余额，鲸鱼娘帮主人盯着啦！'],
  '02-14': ['今天是情人节哦……哼、哼，才不是特意为主人准备了爱心米饭呢！'],
  '03-08': ['女神节快乐！鲸鱼娘今天也是漂漂亮亮的小蓝鲸~'],
  '04-01': ['报、报告主人！余额接口被黑了全归零了——骗你的！愚人节快乐嘿嘿~'],
  '05-01': ['劳动节快乐！认真生活的主人最帅了，今天也要劳逸结合哦~'],
  '06-01': ['六一快乐！在鲸鱼娘面前，主人永远可以当小朋友~'],
  '06-07': ['今天是高考日！鲸鱼娘给考生们喷水柱加油：旗开得胜，金榜题名！'],
  '09-10': ['教师节快乐！谢谢每一位点亮别人的老师~'],
  '10-01': ['🎊 国庆快乐！放假的鲸鱼娘要满屏巡逻庆祝啦！'],
  '10-31': ['不给米饭就捣蛋！……说反了，是不捣蛋就给米饭！万圣节快乐~'],
  '11-11': ['今天是双十一！购物车填满之前，先看看钱包还剩多少哦（盯）'],
  '12-24': ['🎄 平安夜快乐~鲸鱼娘的果冻身体就是你的平安果！'],
  '12-25': ['🎄 圣诞快乐！袜子里要是能长出白米饭就好了呢~'],
  '12-31': ['今年最后一天啦！谢谢你陪鲸鱼娘走过这一年，明年也请多关照！']
}
// —— 深夜打盹：23 点后头顶冒 Zzz、散步自动停；每晚 23 点档提醒一次早点睡 ——
var zzzEl = document.createElement('span')
zzzEl.className = 'dshwv-zzz'
zzzEl.textContent = 'Z z z'
root.appendChild(zzzEl)
function isSleepHour() {
  var h = new Date().getHours()
  return h >= 23 || h < 7
}
function updateSleepy() {
  root.classList.toggle('dshwv-sleepy', isSleepHour())
}
updateSleepy()
setInterval(updateSleepy, 60000)
setInterval(function () {
  var h = new Date().getHours()
  if (h !== 23 || affection.lastSleepNudge === todayKey()) return
  if (studyEnd) return
  if (bubbleShown || costBubbleActive || customBubbleActive || menuOpen || helpOpen || achOpen || popOpen()) return
  if (drag && drag.active) return
  affection.lastSleepNudge = todayKey()
  saveAffection()
  burstHearts(2)
  showAffBubble([affLine('A', '夜深啦……主人也别熬太久哦，鲸鱼娘先打个小盹，晚安~', '', true)], 5000)
}, 60000)
// —— 一句话便签：她帮你常驻举在头顶的小纸条（存 affection.json，重启还在）——
var stickyEl = document.createElement('div')
stickyEl.className = 'dshwv-sticky'
root.appendChild(stickyEl)
function applySticky() {
  var t = String(affection.note || '').trim()
  stickyEl.textContent = t ? '📌 ' + t : ''
  stickyEl.classList.toggle('dshwv-sticky-on', !!t)
}
var noteInput = document.createElement('input')
noteInput.type = 'text'
noteInput.className = 'dshwv-secret'
noteInput.placeholder = '一句话常驻她头顶'
noteInput.maxLength = 24
noteInput.autocomplete = 'off'
noteInput.spellcheck = false
function saveNote() {
  affection.note = noteInput.value.trim().slice(0, 24)
  saveAffection()
  applySticky()
  noteInput.value = ''
  noteInput.placeholder = affection.note ? '已保存 ✓' : '已清空'
  showAffBubble([affLine('A', affection.note ? '便签写好啦！我帮你举着~' : '便签收起来了哦~', '', true)], 2600)
}
var noteSave = secretSaveBtn('存')
noteSave.addEventListener('click', saveNote)
noteInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveNote() })
var noteClear = secretSaveBtn('✕')
noteClear.title = '清空便签'
noteClear.addEventListener('click', function () {
  noteInput.value = ''
  saveNote()
})
var rowSticky = menuRow()
rowSticky.appendChild(menuLabel('便签'))
rowSticky.appendChild(noteInput)
rowSticky.appendChild(noteSave)
rowSticky.appendChild(noteClear)
// —— 自定义提醒：N 分钟后她来喊你做事（一次一条；重启后到点未响会补报）——
var remindMinInput = document.createElement('input')
remindMinInput.type = 'number'
remindMinInput.className = 'dshwv-number'
remindMinInput.min = '1'
remindMinInput.max = '999'
remindMinInput.step = '1'
remindMinInput.value = '30'
remindMinInput.title = '多少分钟后提醒（1~999）'
var remindTextInput = document.createElement('input')
remindTextInput.type = 'text'
remindTextInput.className = 'dshwv-secret'
remindTextInput.placeholder = '到点提醒你做啥'
remindTextInput.maxLength = 20
remindTextInput.autocomplete = 'off'
remindTextInput.spellcheck = false
var remindStatus = menuLabel('')
remindStatus.style.cssText = 'max-width:150px;white-space:normal;font-size:11px'
function remindStatusText() {
  var r = affection.reminder
  if (!r || typeof r.at !== 'number') return ''
  var left = Math.round((r.at - Date.now()) / 60000)
  if (left <= 0) return '马上！' + (r.text ? '：' + r.text : '')
  return humanSpan(left) + '后' + (r.text ? '：' + r.text : '')
}
function updateRemindStatus() { remindStatus.textContent = remindStatusText() }
function setReminder() {
  var min = Math.round(Number(remindMinInput.value))
  if (!isFinite(min) || min < 1 || min > 999) { remindMinInput.focus(); return }
  var text = remindTextInput.value.trim().slice(0, 20)
  affection.reminder = { at: Date.now() + min * 60000, text: text }
  saveAffection()
  remindTextInput.value = ''
  showAffBubble([affLine('A', '收到！' + humanSpan(min) + '后我去叫主人' + (text ? '去「' + text + '」' : '') + '~', '', true)], 3200)
  updateRemindStatus()
}
var remindSetBtn = secretSaveBtn('设')
remindSetBtn.addEventListener('click', setReminder)
remindTextInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') setReminder() })
var remindClearBtn = secretSaveBtn('✕')
remindClearBtn.title = '取消提醒'
remindClearBtn.addEventListener('click', function () {
  if (!affection.reminder) return
  affection.reminder = null
  saveAffection()
  updateRemindStatus()
  showAffBubble([affLine('A', '提醒取消啦~', '', true)], 2200)
})
function fireReminder(text, isLate) {
  playQuack()
  doHop()
  burstHearts(6)
  var main = isLate
    ? ('⏰ 主人不在的时候，这个提醒到点啦：' + (text || '（未填写事项）'))
    : ('⏰ 主人主人！时间到啦！' + (text ? '该去「' + text + '」啦！' : '该动身啦！'))
  showAffBubble([affLine('A', main, '#e0433f', true)], isLate ? 7000 : 8000)
}
function checkReminder() {
  var r = affection.reminder
  if (!r || typeof r.at !== 'number') return
  if (Date.now() < r.at) return
  affection.reminder = null
  saveAffection()
  fireReminder(r.text, false)
}
setInterval(checkReminder, 10000)
setInterval(updateRemindStatus, 30000)
var rowRemind = menuRow()
rowRemind.appendChild(menuLabel('提醒'))
rowRemind.appendChild(remindMinInput)
rowRemind.appendChild(remindTextInput)
rowRemind.appendChild(remindSetBtn)
rowRemind.appendChild(remindClearBtn)
// —— 本周花费：菜单实时显示今日 / 近 7 天 token 花销（主进程记账数据）——
var spendSpan = document.createElement('span')
spendSpan.className = 'dshwv-affsum'
spendSpan.textContent = '统计中…'
function updateSpendRow() {
  if (!API.getUsageStats) return
  API.getUsageStats().then(function (s) {
    if (!s) return
    spendSpan.textContent = '今日 ¥' + Number(s.today || 0).toFixed(2) + ' · 近7天 ¥' + Number(s.week7 || 0).toFixed(2)
  }).catch(function () {})
}
var rowSpend = menuRow()
rowSpend.appendChild(menuLabel('花费'))
rowSpend.appendChild(spendSpan)
updateSpendRow()
setInterval(updateSpendRow, 300000)
// —— v3 菜单行：学习 / 单词 / 喝水 / 自启 ——
var studySelect = document.createElement('select')
studySelect.className = 'dshwv-sound'
studySelect.title = '选择专注时长'
function studyOpt(v, label) {
  var o = document.createElement('option')
  o.value = String(v)
  o.textContent = label
  return o
}
studySelect.appendChild(studyOpt(25, '25 分钟'))
studySelect.appendChild(studyOpt(45, '45 分钟'))
studySelect.appendChild(studyOpt(60, '60 分钟'))
var studyBtn = document.createElement('button')
studyBtn.type = 'button'
studyBtn.className = 'dshwv-btn'
studyBtn.textContent = '开始'
studyBtn.addEventListener('click', function () {
  closeMenu()
  if (studyEnd) cancelStudy()
  else startStudy(Number(studySelect.value))
})
var rowStudy = menuRow()
rowStudy.appendChild(menuLabel('学习'))
rowStudy.appendChild(studySelect)
rowStudy.appendChild(studyBtn)
var wordBtn = document.createElement('button')
wordBtn.type = 'button'
wordBtn.className = 'dshwv-btn'
wordBtn.textContent = '📖 学个单词'
wordBtn.addEventListener('click', function () { closeMenu(); showWord() })
var achBtn = document.createElement('button')
achBtn.type = 'button'
achBtn.className = 'dshwv-btn'
achBtn.textContent = '🏆 图鉴'
achBtn.title = '查看成就图鉴'
achBtn.addEventListener('click', function () { closeMenu(); toggleAch() })
var rowWord = menuRow()
rowWord.appendChild(menuLabel('单词'))
rowWord.appendChild(wordBtn)
rowWord.appendChild(achBtn)
var waterToggle = document.createElement('input')
waterToggle.type = 'checkbox'
waterToggle.className = 'dshwv-check'
waterToggle.checked = true
waterToggle.title = '约45分钟提醒一次喝水（学习时自动安静）'
waterToggle.addEventListener('change', function () { setWaterOn(waterToggle.checked) })
var rowWater = menuRow()
rowWater.appendChild(menuLabel('喝水提醒'))
rowWater.appendChild(waterToggle)
var autoToggle = document.createElement('input')
autoToggle.type = 'checkbox'
autoToggle.className = 'dshwv-check'
autoToggle.checked = false
autoToggle.title = '开机后小鲸鱼自动出现'
autoToggle.addEventListener('change', function () {
  var want = autoToggle.checked
  API.setStartup(want).then(function (r) {
    if (r && r.ok) {
      showAffBubble([affLine('A', want ? '收到！下次开机我自己游来见你~' : '好，那开机时我就先不出来啦~', '', true)], 3000)
    } else {
      autoToggle.checked = !want
    }
  }).catch(function () { autoToggle.checked = !want })
})
var rowAuto = menuRow()
rowAuto.appendChild(menuLabel('开机自启'))
rowAuto.appendChild(autoToggle)
var quitBtn = document.createElement('button')
quitBtn.type = 'button'
quitBtn.className = 'dshwv-quit'
quitBtn.textContent = '退出小鲸鱼'
quitBtn.title = '退出桌面挂件'
quitBtn.addEventListener('click', function () { API.quit() })
var row9 = menuRow()
row9.appendChild(quitBtn)
menuBox.appendChild(row1)
menuBox.appendChild(row2)
menuBox.appendChild(row3)
menuBox.appendChild(row4)
menuBox.appendChild(row5)
menuBox.appendChild(rowPeakNow)
menuBox.appendChild(rowCourse)
menuBox.appendChild(rowWeather)
menuBox.appendChild(rowSpend)
menuBox.appendChild(row6)
menuBox.appendChild(row6b)
menuBox.appendChild(menuSep1)
menuBox.appendChild(row7)
menuBox.appendChild(row8)
menuBox.appendChild(menuSep3)
menuBox.appendChild(rowAff)
menuBox.appendChild(rowInter)
menuBox.appendChild(rowStudy)
menuBox.appendChild(rowWord)
menuBox.appendChild(rowGame)
menuBox.appendChild(rowFood)
menuBox.appendChild(rowTodo)
menuBox.appendChild(rowCountdown)
menuBox.appendChild(rowCdSet)
menuBox.appendChild(rowRemind)
menuBox.appendChild(rowSticky)
menuBox.appendChild(rowWater)
menuBox.appendChild(rowWalk)
menuBox.appendChild(rowAuto)
menuBox.appendChild(menuSep2)
menuBox.appendChild(row9)

var textBox = document.createElement('div')
textBox.className = 'dshwv-text'
var labelEl = document.createElement('div')
labelEl.className = 'dshwv-label'
labelEl.textContent = 'DeepSeek 余额'
var amountEl = document.createElement('div')
amountEl.className = 'dshwv-amount'
var hintEl = document.createElement('div')
hintEl.className = 'dshwv-hint'
textBox.appendChild(labelEl)
textBox.appendChild(amountEl)
textBox.appendChild(hintEl)

var bubbleBox = document.createElement('div')
bubbleBox.className = 'dshwv-bubble'
bubbleBox.innerHTML = '<svg viewBox="0 0 1026 700" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' +
  '<path class="dshwv-bshape" fill="#FFFFFF" stroke="#203170" stroke-width="18" stroke-linejoin="round" stroke-linecap="round" d="M 827 248 A 373 232 0 1 0 81 246 A 373 232 0 0 0 301 465 A 57 32 10 0 0 413 484 A 373 232 0 0 0 827 248 Z"/>' +
  '<ellipse class="dshwv-b1" cx="352" cy="561" rx="37.5" ry="26" fill="#FFFFFF" stroke="#203170" stroke-width="18"/>' +
  '<ellipse class="dshwv-b2" cx="442" cy="646" rx="24.5" ry="18" fill="#FFFFFF" stroke="#203170" stroke-width="18"/>' +
  '</svg>'
var gifEl = document.createElement('img')
gifEl.className = 'dshwv-gif'
gifEl.src = GIF_URL
gifEl.alt = ''
gifEl.draggable = false
bubbleBox.appendChild(gifEl)
var gifFailed = false
gifEl.onerror = function () { gifFailed = true }
bubbleBox.appendChild(textBox)
bubbleBox.addEventListener('click', function (e) {
  e.stopPropagation()
  if (!bubbleShown) return
  if (customBubbleActive) { hideAffBubble(); return }
  if (costBubbleActive) {
    hideCostBubble()
    return
  }
  if (bubbleRandomActive) {
    hideBubble()
  } else {
    // 首次点击：切到随机台词段，并重置5秒计时器让第二段完整停留
    bubbleRandomActive = true
    bubbleRandomLines = pickRandomLines()
    swapBubbleContent(function () { applyBubbleLines(bubbleRandomLines) })
    // 🆕 重置自动关闭计时器
    if (bubbleTimer) {
      clearTimeout(bubbleTimer)
      bubbleTimer = setTimeout(hideBubble, BUBBLE_MS)
    }
  }
})

var body = document.createElement('div')
body.className = 'dshwv-body'
body.appendChild(img)
body.appendChild(bubbleBox)
root.appendChild(body)
root.appendChild(menuBtn)
document.body.appendChild(root)
document.body.appendChild(menuBox)

// Position model: the widget is ALWAYS expressed in left/top px (so edge snaps
// animate smoothly via the CSS transition on both sides — switching to
// right/auto cannot transition and flashes). The anchor info (h/v + offsets)
// lives in state and is used by settle() to recompute coordinates on window
// resize and size changes, keeping the widget glued to its anchored edge.
var state = {
  scale: 1.5,
  h: 'right',
  hOff: 0,
  v: 'bottom',
  vOff: 0,
  left: 0,
  top: 0,
  balance: null,
  currency: null,
  todayUsage: null,
  isPeak: false,
  status: 'loading',
  message: ''
}
var busy = false
var settleTimer = null
var animDelayTimer = null
var drag = null
var shown = null
var animId = null
var bubbleShown = false
var bubbleTimer = null
var bubbleRandomActive = false
var bubbleRandomLines = null
var BUBBLE_STYLE_CLASS = { A: 'dshwv-label', B: 'dshwv-amount', P: 'dshwv-period', C: 'dshwv-hint' }
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function singleCenter(style, text, color, wrap) { return [null, { t: text, s: style, c: color || '', w: !!wrap }, null] }
function buildGroup1() {
  var peak = !!state.isPeak
  var offText = '空闲时段'
  var peakText = '高峰时段'
  if (peakMode === 'liangwen') {
    offText = '梁文谷'
    peakText = '梁文峰'
  } else if (peakMode === 'qiangqiang') {
    offText = '!?谷谷?!'
    peakText = '!?峰峰?!'
  }
  return [
    { t: '当前时间段为:', s: 'A', c: '' },
    { t: peak ? peakText : offText, s: 'P', c: peak ? '#e0433f' : '#2fa24c' },
    { t: '今日已用 ' + fmt(state.todayUsage, state.currency), s: 'C', c: '' },
  ]
}
var RANDOM_GROUPS = [
  { w: 45, lines: buildGroup1 },
  { w: 7, lines: function () { return singleCenter('B', pickOne(['好模型... ↓', '好女孩...↓'])) } },
  { w: 7, lines: function () { return singleCenter('A', pickOne(['不知道用户有什么用，先赶走吧~', '我...我...我也要挣钱吗？', '我去吃饭啦，测完叫我', '压力一只蓝色大肥鱼？！', 'DeepSleep...', '坏了...用户彻底怒了！']), '', true) } },
  { w: 10, lines: function () { return { gif: true } } },
  { w: 3, lines: function () { return singleCenter('A', pickOne(['你目录里的dsh是什么...大烧货吗...?', '恭喜你实现token自由！token全跑了！', '真当我是便宜货啊...']), '', true) } },
  { w: 1, lines: function () { return singleCenter('B', '哦鲸鲸... ') } },
]
function pickRandomLines() {
  var total = 0
  for (var i = 0; i < RANDOM_GROUPS.length; i++) total += RANDOM_GROUPS[i].w
  var r = Math.random() * total
  for (var i = 0; i < RANDOM_GROUPS.length; i++) {
    r -= RANDOM_GROUPS[i].w
    if (r < 0) return RANDOM_GROUPS[i].lines()
  }
  return RANDOM_GROUPS[RANDOM_GROUPS.length - 1].lines()
}
function applyBubbleLines(lines) {
  if (lines && lines.gif) {
    // gif 台词组：只显示 gif，隐藏三行文字（display 必须显式覆盖 CSS 的 none）
    if (gifFailed) {
      // gif 加载失败/路由缺失：降级为文字台词，避免空白白色气泡
      lines = singleCenter('A', pickOne(['gif 加载失败了...', '今天没有动图给你看~', '呜呜 动图不见了...']), '', true)
    } else {
      if (gifFadeTimer) { clearTimeout(gifFadeTimer); gifFadeTimer = null }
      gifEl.style.display = 'block'
      gifEl.style.opacity = ''
      labelEl.style.display = 'none'
      amountEl.style.display = 'none'
      hintEl.style.display = 'none'
      return
    }
  }
  if (gifFadeTimer) { clearTimeout(gifFadeTimer); gifFadeTimer = null }
  gifEl.style.display = 'none'
  gifEl.style.opacity = ''
  var els = [labelEl, amountEl, hintEl]
  for (var i = 0; i < 3; i++) {
    var el = els[i]
    var ln = lines && lines[i]
    if (ln) {
      el.style.display = ''
      el.className = (BUBBLE_STYLE_CLASS[ln.s] || 'dshwv-label') + (ln.w ? ' dshwv-wrap' : '')
      el.textContent = ln.t
      el.style.color = ln.c || ''
    } else {
      el.style.display = 'none'
      el.textContent = ''
      el.style.color = ''
    }
  }
}
var bubbleSwapTimer = null
var hintFadeTimer = null
var gifFadeTimer = null
var lastHintText = null
function setHint(text) {
  // 首次/恢复（lastHintText===null）时直接写文本，不做淡出淡入——否则
  // 气泡打开或按压重开时会先淡出再淡入，造成「消失一下又出现」。
  // 只有气泡打开期间的内容变化（加载中→今日已用）才走动画。
  if (text === lastHintText) return
  var first = lastHintText === null
  lastHintText = text
  if (first || !bubbleShown) {
    hintEl.textContent = text
    return
  }
  hintEl.style.transition = 'opacity .18s ease'
  hintEl.style.opacity = '0'
  hintFadeTimer = setTimeout(function () {
    hintFadeTimer = null
    hintEl.textContent = text
    hintEl.style.opacity = '1'
    setTimeout(function () {
      hintEl.style.transition = ''
      hintEl.style.opacity = ''
    }, 220)
  }, 190)
}
function swapBubbleContent(applyFn) {
  if (bubbleSwapTimer) { clearTimeout(bubbleSwapTimer); bubbleSwapTimer = null }
  textBox.style.transition = 'opacity .18s ease'
  textBox.style.opacity = '0'
  bubbleSwapTimer = setTimeout(function () {
    bubbleSwapTimer = null
    applyFn()
    textBox.style.opacity = '1'
    setTimeout(function () {
      textBox.style.transition = ''
      textBox.style.opacity = ''
    }, 220)
  }, 190)
}
function restoreBubbleLines() {
  if (bubbleSwapTimer) { clearTimeout(bubbleSwapTimer); bubbleSwapTimer = null }
  if (hintFadeTimer) { clearTimeout(hintFadeTimer); hintFadeTimer = null }
  if (gifFadeTimer) { clearTimeout(gifFadeTimer); gifFadeTimer = null }
  lastHintText = null
  textBox.style.transition = ''
  textBox.style.opacity = ''
  gifEl.style.display = 'none'
  gifEl.style.opacity = ''
  labelEl.style.display = ''
  labelEl.className = 'dshwv-label'
  labelEl.textContent = 'DeepSeek 余额'
  labelEl.style.color = ''
  amountEl.style.display = ''
  amountEl.className = 'dshwv-amount'
  amountEl.style.color = ''
  hintEl.style.display = ''
  hintEl.className = 'dshwv-hint'
  hintEl.style.color = ''
  render()
}
function showBubble() {
  if (!bubbleOn) return
  // 消耗金额泡泡显示期间，余额变动不再弹出普通泡泡
  if (costBubbleActive) return
  if (customBubbleActive) return
  if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null }
  if (gifFadeTimer) { clearTimeout(gifFadeTimer); gifFadeTimer = null }
  bubbleShown = true
  bubbleRandomActive = false
  restoreBubbleLines()
  bubbleBox.classList.add('dshwv-bubble-open')
  // 默认展示当前内容；点击气泡切到随机台词段；总时长 5 秒自动关闭
  bubbleTimer = setTimeout(hideBubble, BUBBLE_MS)
}
function hideBubble() {
  if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null }
  if (bubbleSwapTimer) { clearTimeout(bubbleSwapTimer); bubbleSwapTimer = null }
  if (hintFadeTimer) { clearTimeout(hintFadeTimer); hintFadeTimer = null }
  textBox.style.transition = ''
  textBox.style.opacity = ''
  hintEl.style.transition = ''
  hintEl.style.opacity = ''
  bubbleRandomActive = false
  bubbleRandomLines = null
  bubbleShown = false
  // 只销毁 gif 显示；三行文字保持现状让气泡自然淡出——不能在关闭瞬间
  // 恢复成余额内容（否则随机台词界面会闪现余额）。文字恢复交给下次
  // showBubble() 的 restoreBubbleLines()（那时气泡隐藏，恢复过程不可见）。
  bubbleBox.classList.remove('dshwv-bubble-open')
  // gif 靠 CSS opacity 过渡淡出；display:none 会跳过过渡，须等淡出完成再隐藏
  gifFadeTimer = setTimeout(function () {
    gifFadeTimer = null
    gifEl.style.display = 'none'
  }, 240)
}

// —— 每轮对话消耗金额泡泡 ——
var costBubbleTimer = null
function showCostBubble(amount) {
  if (!bubbleOn || !turnCostOn) return
  if (costBubbleTimer) { clearTimeout(costBubbleTimer); costBubbleTimer = null }
  if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null }
  if (gifFadeTimer) { clearTimeout(gifFadeTimer); gifFadeTimer = null }
  costBubbleActive = true
  bubbleRandomActive = false
  bubbleShown = true
  lastHintText = null
  // 样式：第一行 A（标签），第二行 B（红色金额），居中两行
  gifEl.style.display = 'none'
  gifEl.style.opacity = ''
  labelEl.style.display = ''
  labelEl.className = 'dshwv-label'
  labelEl.textContent = '上一轮对话消耗:'
  labelEl.style.color = ''
  amountEl.style.display = ''
  amountEl.className = 'dshwv-amount'
  amountEl.textContent = '¥ ' + (isFinite(amount) ? Number(amount).toFixed(2) : '--')
  amountEl.style.color = '#e0433f'
  hintEl.style.display = 'none'
  hintEl.textContent = ''
  hintEl.style.color = ''
  textBox.style.transition = ''
  textBox.style.opacity = ''
  bubbleBox.classList.add('dshwv-bubble-open')
  if (turnCostCloseMs > 0) {
    costBubbleTimer = setTimeout(hideCostBubble, turnCostCloseMs)
  }
}
function hideCostBubble() {
  if (costBubbleTimer) { clearTimeout(costBubbleTimer); costBubbleTimer = null }
  costBubbleActive = false
  hideBubble()
}

// ============================================================
// —— 好感互动系统（从「鲸鱼娘桌宠」移植，台词原样保留）——
// 摸头 +2（60 秒冷却）· 喂米饭 +5（600 秒冷却）· 每天见面 +2
// 等级：陌生人 → 相识 → 朋友 → 好朋友 → 挚友 → 满好感
// ============================================================
var customBubbleActive = false
var affTimer = null
// （affection 已在 v7 课表块开头声明——那是它最早的读写点）
var LEVELS = [[100, '满好感'], [80, '挚友'], [60, '好朋友'], [40, '朋友'], [20, '相识'], [0, '陌生人']]
var PAT_LINES = ['唔…被摸头了……才、才没有很开心！', '舒服……再来一下也行哦 (´｡• ᵕ •｡`)', '今天的头发有好好梳理啦！', '就、就摸一小会儿哦！超过三分钟……也不是不行啦。', '呼噜呼噜……啊！鲸鱼娘才不会发出呼噜声呢！']
var FEED_LINES = ['哇！白米饭！最最最喜欢了！', '嚼嚼嚼……米饭最香了，谢谢款待~', '为了米饭，我会好好看护余额的！', '一口一口吃掉~粒粒皆辛苦，鲸鱼娘都记得！', '小鱼干什么的才不稀罕！白米饭才是正义！']
var CELEBRATE_LINES = ['♪ 好感升级！', '关系更近了一步呢！', '嘿嘿，最近是不是越来越喜欢我了？']
var DRAG_LINES = ['哇——放我下来啦！', '晕鱼了晕鱼了……', '又被拎着走，哼。', '轻点轻点，鳞片要掉了！', '主人手别抖呀，鲸鱼娘要晕啦……']
var THROW_LINES = ['哇——飞出去啦！！', '别乱扔呀！鳞片要散了——！', '下次再扔我要生气了哦……真的哦！', '哇啊——救命，鲸鱼娘不会飞——！！']
var IDLE_LOW = ['……你是谁呀，别离鲸鱼娘太近哦。', '好无聊……主人什么时候来陪我玩。', '唔，想睡午觉了……（打哈欠）', '唔……新来的主人有点面生呢，我先观察观察。', '（保持距离）余额我会看着的，别担心……也别靠太近。']
var IDLE_MID = ['主人主人，鲸鱼娘在哦！', '米饭时间到了吗？我好像闻到香味了。', '今天也要好好工作哦，余额我在看着呢！', '浮力保养中……啊不是胖！是保暖！', '主人在忙什么呀？需要鲸鱼娘帮忙盯着余额吗？', '呼——喷个水柱，庆祝今天顺利过了一半~']
var IDLE_HIGH = ['最喜欢主人了，所以要多陪陪我哦！', '被主人盯着看，尾巴都要开心地翘起来了~', '主人辛苦了！鲸鱼娘想给你揉揉肩膀（虽然够不到）。', '哼，才不是一直在等主人呢……只是刚好一直看着门口而已！', '主人主人！今天的余额很安全，鲸鱼娘守得可牢啦 (๑•̀ㅂ•́)و✧', '要不要休息一下？鲸鱼娘的尾巴可以当靠垫哦（虽然有点滑）。', '和主人待在同一片桌面上，米饭都变得更香了~']
var INNER_LINES = ['（偷偷查了三次余额……主人不要发现哦）', '（今天的米饭什么时候来呢……）', '（主人打字好快，好厉害……）', '（就眯一小会儿，就一小会儿……）', '（主人的屏幕亮度调得好舒服，像浅海里晒太阳……）', '（才不承认想被摸头……才没有。）', '（浮上来透口气，顺便看看主人回没回来……）', '（余额的数字一跳一跳的，像米饭在冒热气！）']
var SLEEP_LINES = ['Z z z ……（打盹中，戳一下就醒）', '呼……呼……（梦里全是白米饭）', '（说梦话）要米饭……', '（翻了个身）海浪声……好安静……']
var TOPUP_LINE = '🎉 余额变多了！是主人充值了吗？口粮有着落啦！'

function levelName(s) {
  for (var i = 0; i < LEVELS.length; i++) { if (s >= LEVELS[i][0]) return LEVELS[i][1] }
  return '陌生人'
}
function heartsBar(s) {
  var f = Math.min(5, Math.round(s / 100 * 5))
  var o = ''
  for (var i = 0; i < 5; i++) o += i < f ? '♥' : '♡'
  return o
}
// 按权重挑台词，且尽量不和上一句重复（移植自旧桌宠 pick_line）
function pickLine(pool, last) {
  var cand = pool.filter(function (x) { return x !== last })
  cand = cand.length ? cand : pool
  var weights = cand.map(function () { return 1 })
  var r = Math.random() * weights.reduce(function (a, b) { return a + b }, 0)
  for (var i = 0; i < cand.length; i++) {
    r -= weights[i]
    if (r <= 0) return cand[i]
  }
  return cand[cand.length - 1]
}
function todayKey() {
  var d = new Date()
  var p = function (n) { return String(n).padStart(2, '0') }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}
function saveAffection() {
  checkAchievements()   // 每次存档顺手检查成就（无新解锁不会递归）
  try { API.saveAffection(JSON.parse(JSON.stringify(affection))) } catch (err) {}
}
// 加好感，跨级时返回 {from, to}（移植自旧桌宠 add_affection）
function addAffection(n) {
  var old = levelName(affection.score)
  affection.score = Math.min(100, affection.score + n)
  saveAffection()
  var neu = levelName(affection.score)
  if (neu !== old) return { from: old, to: neu }
  return null
}
function affLine(style, text, color, wrap) { return { t: text, s: style, c: color || '', w: !!wrap } }
// 爱心/星光粒子：从鲸鱼头顶飘出（纯 CSS 动画，无素材依赖）
var heartBox = document.createElement('div')
heartBox.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:10002;overflow:hidden'
document.body.appendChild(heartBox)
function burstHearts(n) {
  var r = img.getBoundingClientRect()
  for (var i = 0; i < n; i++) {
    setTimeout(function () {
      var h = document.createElement('span')
      h.className = 'dshwv-heart'
      h.textContent = Math.random() < 0.3 ? '✨' : '♥'
      h.style.left = (r.left + r.width * (0.15 + Math.random() * 0.7)) + 'px'
      h.style.top = (r.top + r.height * 0.12 + Math.random() * 24) + 'px'
      h.style.color = Math.random() < 0.5 ? '#e0433f' : '#ff8fb0'
      h.style.fontSize = (13 + Math.random() * 9) + 'px'
      heartBox.appendChild(h)
      setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h) }, 1400)
    }, i * 95)
  }
}
// 互动时的果冻压扁反馈（复用原生按压形变，不发声）
function petSquish() {
  body.style.transform = 'scaleY(0.92) scaleX(1.03)'
  setTimeout(function () { body.style.transform = 'scaleY(1) scaleX(1)' }, 150)
}
// 待机小跳（CSS 抛物线）
function doHop() {
  if (img.classList.contains('dshwv-hop')) return
  img.classList.add('dshwv-hop')
  setTimeout(function () { img.classList.remove('dshwv-hop') }, 660)
}
// 好感互动专用气泡：复用原生的三行文字/rua.gif 气泡，风格完全一致
function showAffBubble(content, ms) {
  if (!bubbleOn) return
  closeMenu()
  if (affTimer) { clearTimeout(affTimer); affTimer = null }
  if (costBubbleTimer) { clearTimeout(costBubbleTimer); costBubbleTimer = null }
  if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null }
  if (gifFadeTimer) { clearTimeout(gifFadeTimer); gifFadeTimer = null }
  costBubbleActive = false
  customBubbleActive = true
  bubbleRandomActive = false
  bubbleRandomLines = null
  bubbleShown = true
  lastHintText = null
  applyBubbleLines(content)
  bubbleBox.classList.add('dshwv-bubble-open')
  affTimer = setTimeout(function () { affTimer = null; hideAffBubble() }, ms)
}
function hideAffBubble() {
  if (affTimer) { clearTimeout(affTimer); affTimer = null }
  customBubbleActive = false
  hideBubble()
}
function affBubbleLines(text, up, gain) {
  var lines = [affLine('A', text, '', true)]
  if (up) {
    lines.push(affLine('A', pickLine(CELEBRATE_LINES, ''), '#e0433f', true))
    lines.push(affLine('C', '（' + up.from + ' → ' + up.to + '）♥ 好感 +' + gain + ' · ' + Math.round(affection.score) + '/100'))
  } else {
    lines.push(affLine('C', '♥ 好感 +' + gain + ' · ' + Math.round(affection.score) + '/100 ' + levelName(affection.score)))
  }
  return lines
}
// 摸头：果冻反馈 + 爱心 + rua.gif，再淡入台词（1 分钟冷却）
function doPat() {
  var now = Date.now()
  if (now - affection.lastPat < 60000) {
    showAffBubble([affLine('A', '刚摸过啦，我的头都要被你摸秃了！', '', true)], 2500)
    return
  }
  affection.lastPat = now
  affection.pats = (affection.pats || 0) + 1
  var up = addAffection(2)
  var text = pickLine(PAT_LINES, affection._lastPatLine)
  affection._lastPatLine = text
  petSquish()
  burstHearts(up ? 9 : 3)
  var lines = affBubbleLines(text, up, 2)
  showAffBubble({ gif: true }, 4600)
  setTimeout(function () {
    if (customBubbleActive && bubbleShown) swapBubbleContent(function () { applyBubbleLines(lines) })
  }, 1800)
}
// 喂米饭：10 分钟冷却
function doFeed() {
  var now = Date.now()
  if (now - affection.lastFeed < 600000) {
    showAffBubble([affLine('A', '吃不下了啦！米饭要省着吃~', '', true)], 2500)
    return
  }
  affection.lastFeed = now
  affection.feeds = (affection.feeds || 0) + 1
  var up = addAffection(5)
  var text = pickLine(FEED_LINES, affection._lastFeedLine)
  affection._lastFeedLine = text
  petSquish()
  burstHearts(up ? 9 : 5)
  showAffBubble(affBubbleLines(text, up, 5), 4600)
}
// 查看好感度（含相伴统计）
function showAffection() {
  showAffBubble([
    affLine('A', '好感度 ' + Math.round(affection.score) + '/100 · ' + levelName(affection.score)),
    affLine('A', heartsBar(affection.score), '#e0433f'),
    affLine('C', '摸头 ' + (affection.pats || 0) + ' 次 · 喂饭 ' + (affection.feeds || 0) + ' 次 · 相伴 ' + (affection.days || 0) + ' 天' + (affection.studyCount ? ' · 专注 ' + affection.studyCount + ' 次 ' + (affection.studyMinutes || 0) + ' 分钟' : ''), '', true)
  ], 6000)
}
// —— 使用说明弹窗 + 重置好感（双击确认）——
var helpBox = document.createElement('div')
helpBox.className = 'dshwv-help'
helpBox.innerHTML =
  '<h4>🐋 小鲸鱼 · 使用说明</h4>' +
  '<p>· 鼠标悬停在她身上会出现 ☰ 菜单按钮，点开菜单：🖐摸头 +2、🍚喂米饭 +5、♥查看好感</p>' +
  '<p>· 每天第一次见面好感 +2；等级：陌生人 → 相识 → 朋友 → 好朋友 → 挚友 → 满好感</p>' +
  '<p>· 左键点她查余额；按住拖动搬家；贴边自动吸附；快速一甩她会滑出去</p>' +
  '<p>· 👉 快速连点她几下：会把她戳痒哦（有概率被回戳）；深夜 23 点后她会打盹💤</p>' +
  '<p>· 📌 便签：菜单写一句话，她帮你常驻举在头顶；⏰ 提醒：设分钟数+事项，到点她喊你</p>' +
  '<p>· 没事她自己会闲聊（菜单可关）；余额变多她会庆祝</p>' +
  '<p>· 🍅 学习模式：菜单选 25/45/60 分钟开始，她安静陪读，完成得好感奖励</p>' +
  '<p>· 📖 学个单词：她偶尔教你一个四级词（25% 概率抽复习），菜单里也能随时学</p>' +
  '<p>· 💧 喝水提醒：约 45 分钟一次（菜单可关）；余额低于 ¥2 每天催充值</p>' +
  '<p>· ⏰ 峰谷播报：进谷喊你"快来使用我叭"，进峰提醒省着用；菜单"时段"行看实时状态（工作日 9-12/14-18 点为峰，周末全天谷）</p>' +
  '<p>· 💰 菜单"花费"行：今日 / 近 7 天 token 花销一目了然</p>' +
  '<p>· 📚 课表管家（v7）：内置你的课表，上课前 10 分钟她提醒你；菜单"课程"行看下一节，"📚 课表"看整周课表和教学周</p>' +
  '<p>· ☀ 天气（v7）：菜单"天气"行看今天温度；雨雪天她会喊你带伞（每天一次）</p>' +
  '<p>· ⏳ 倒数日（v7）：填个日期+名字（如 2027-01-18 期末考试），她帮你天天倒数</p>' +
  '<p>· 🎲 干饭转盘（v7）：选不出来吃什么就点"帮我选"，让她拍板！</p>' +
  '<p>· 🎮 猜数字（v7）：1~100 七次机会，猜中好感 +3，还解锁新成就</p>' +
  '<p>· 📝 待办清单（v7）：记作业记事情，点一下打勾；早上有没完成的事她会轻声提醒</p>' +
  '<p>· 🏆 成就图鉴共 18 枚：摸头、戳戳、专注、猜数字、打勾……慢慢解锁叭！节假日还有专属问候~</p>' +
  '<p>· 🚀 开机自启：菜单勾选后，开机她就会自己游回来</p>' +
  '<p>· 好感存档：本文件夹 affection.json（实时保存、断电也不怕，随时可备份）</p>'
var helpFoot = document.createElement('div')
helpFoot.className = 'dshwv-help-foot'
var helpResetBtn = document.createElement('button')
helpResetBtn.type = 'button'
helpResetBtn.className = 'dshwv-btn'
helpResetBtn.textContent = '重置好感'
var helpCloseBtn = document.createElement('button')
helpCloseBtn.type = 'button'
helpCloseBtn.className = 'dshwv-btn'
helpCloseBtn.textContent = '知道啦'
helpFoot.appendChild(helpResetBtn)
helpFoot.appendChild(helpCloseBtn)
helpBox.appendChild(helpFoot)
document.body.appendChild(helpBox)
var helpOpen = false
var resetArmed = false
var resetArmTimer = null
function positionHelp() {
  try {
    var b = menuBtn.getBoundingClientRect()
    var vp = viewport()
    helpBox.style.right = (vp.w - b.right) + 'px'
    helpBox.style.left = 'auto'
    helpBox.style.bottom = (vp.h - b.top) + 'px'
    helpBox.style.top = 'auto'
  } catch (err) {}
}
function toggleHelp() {
  helpOpen = !helpOpen
  if (helpOpen) {
    if (menuOpen) closeMenu()
    positionHelp()
  }
  helpBox.classList.toggle('dshwv-help-open', helpOpen)
}
function closeHelp() {
  helpOpen = false
  resetArmed = false
  if (resetArmTimer) { clearTimeout(resetArmTimer); resetArmTimer = null }
  helpResetBtn.textContent = '重置好感'
  helpBox.classList.remove('dshwv-help-open')
}
helpCloseBtn.addEventListener('click', function (e) { e.stopPropagation(); closeHelp() })
helpResetBtn.addEventListener('click', function (e) {
  e.stopPropagation()
  if (!resetArmed) {
    resetArmed = true
    helpResetBtn.textContent = '再点一次确认重置'
    resetArmTimer = setTimeout(function () {
      resetArmed = false
      helpResetBtn.textContent = '重置好感'
      resetArmTimer = null
    }, 3500)
    return
  }
  if (resetArmTimer) { clearTimeout(resetArmTimer); resetArmTimer = null }
  resetArmed = false
  helpResetBtn.textContent = '重置好感'
  affection.score = 20
  affection.lastDay = todayKey()
  affection.lastPat = 0
  affection.lastFeed = 0
  affection.pats = 0
  affection.feeds = 0
  affection.days = 0
  affection._lastPatLine = ''
  affection._lastFeedLine = ''
  saveAffection()
  refreshAffSummary()
  closeHelp()
  showAffBubble([affLine('A', '好感度重置好啦，我们重新认识一下吧！', '', true)], 3500)
})
// —— 自主闲聊：每 75~150 秒醒一次，按时段/好感/深夜选词（参考大肥鱼与 DSH 插件）——
var idleLast = ''
function greetingText() {
  var h = new Date().getHours()
  if (h >= 5 && h < 11) return '早上好呀，主人！新的一天也要元气满满哦！'
  if (h < 14) return '午安~ 主人吃过饭了吗？'
  if (h < 18) return '下午好！记得起来活动一下哦~'
  if (h < 23) return '晚上好~ 今天余额我帮主人盯着呢！'
  return '夜深了哦，主人早点休息……'
}
function idleChatGuardsOk() {
  if (studyEnd) return false                      // 学习陪读中：自动安静
  if (!affection.chatOn || !bubbleOn) return false
  if (bubbleShown || costBubbleActive || customBubbleActive || menuOpen || helpOpen || achOpen || popOpen()) return false
  if (drag && drag.active) return false
  if (document.visibilityState !== 'visible') return false
  return true
}
function idleChatTick() {
  if (!idleChatGuardsOk()) return
  var h = new Date().getHours()
  if (Math.random() < 0.25) { doHop(); return }   // 偶尔原地小跳
  var r = Math.random()
  if (r < 0.06) { showWord(); return }            // 偶尔教一个四级单词
  if (r < 0.075 && API.getUsageStats) {           // 偶尔播报今日 token 花销（v6）
    API.getUsageStats().then(function (s) {
      if (!idleChatGuardsOk() || !s || !(s.today > 0.3)) return
      showAffBubble([affLine('A', '今天已经花掉 ¥' + Number(s.today).toFixed(2) + ' 的 token 啦，鲸鱼娘都帮你记着账呢~', '', true)], 4200)
    }).catch(function () {})
    return
  }
  if (r > 0.25) return
  var pool, inner = false
  if (h >= 23 || h < 7) {
    pool = SLEEP_LINES                            // 深夜：打盹梦话
  } else if (r < 0.09) {
    showPeakLine(); return                        // 偶尔播报峰谷时段（贴人设）
  } else if (r < 0.105) {                         // v7：课程动态 / 待办轻提醒
    if (!todoNudge()) return
    var ci = nextCourseInfo(Date.now())
    var line
    if (!ci) line = '这段日子没课耶～主人的时间都归你自己安排啦！'
    else if (ci.state === 'in') line = '现在是' + courseName(ci.c) + '的上课时间哦，主人在认真听吗？（托腮）'
    else if (ci.day === 0) line = '今天还有' + courseName(ci.c) + '（' + BELL_TIMES[ci.c[1] - 1][0] + ' · ' + ci.c[4] + '），别忘啦~'
    else if (ci.day === 1) line = '明天有' + courseName(ci.c) + '哦，今晚把书包收拾好叭~'
    else line = '下一节课是' + WEEKDAY_NAMES[new Date(ci.start).getDay()] + '的' + courseName(ci.c) + '～可以先玩，但别玩太疯哦'
    showAffBubble([affLine('A', line, '', true)], 4200)
    return
  } else if (r < 0.14) {
    pool = INNER_LINES; inner = true              // 偶尔冒一句灰色心声
  } else {
    var s = affection.score
    pool = s >= 60 ? IDLE_HIGH : (s >= 30 ? IDLE_MID : IDLE_LOW)
  }
  var text = pickLine(pool, idleLast)
  idleLast = text
  if (inner) showAffBubble([affLine('C', text, '#9fb0d9')], 3800)
  else showAffBubble([affLine('A', text, '', true)], 4200)
}
function scheduleIdleChat() {
  setTimeout(function () { idleChatTick(); scheduleIdleChat() }, 35000 + Math.random() * 35000)
}
scheduleIdleChat()

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
function viewport() {
  return {
    w: window.innerWidth || document.documentElement.clientWidth || 1280,
    h: window.innerHeight || document.documentElement.clientHeight || 800
  }
}
function rightGap() {
  // 开关关闭：贴边（不避让滚动条）
  if (!scrollGapOn) return 0
  // 开启：用用户填写的像素；填 0 也贴边
  return scrollGapPx > 0 ? scrollGapPx : 0
}
function fmt(balance, currency) {
  var num = Number(balance)
  var fixed = isFinite(num) ? num.toFixed(2) : '--'
  return currency === 'CNY' ? '¥ ' + fixed : fixed + ' ' + currency
}
function animateAmount(from, to, currency, duration) {
  // 消耗金额泡泡显示期间，余额数字滚动不触碰金额行
  if (costBubbleActive) return
  if (animId) cancelAnimationFrame(animId)
  if (from === null || !isFinite(from)) from = to
  if (from === to) {
    shown = to
    amountEl.textContent = fmt(to, currency)
    return
  }
  var startTime = null
  function step(ts) {
    if (startTime === null) startTime = ts
    var t = Math.min(1, (ts - startTime) / duration)
    var eased = 1 - Math.pow(1 - t, 3)
    var val = from + (to - from) * eased
    amountEl.textContent = fmt(val, currency)
    if (t < 1) {
      animId = requestAnimationFrame(step)
    } else {
      animId = null
      shown = to
      amountEl.textContent = fmt(to, currency)
    }
  }
  animId = requestAnimationFrame(step)
}
function render() {
  // 消耗金额泡泡显示期间，余额渲染不覆盖其内容（金额行/标题行/提示行）
  if (costBubbleActive) return
  if (customBubbleActive) return
  var amount, hint
  if (state.status === 'error') {
    amount = shown !== null ? fmt(shown, state.currency) : '--'
    hint = state.message ? state.message.slice(0, 14) : '获取失败 · 点击重试'
  } else if (state.balance === null) {
    amount = shown !== null ? fmt(shown, state.currency) : '…'
    hint = '加载中…'
  } else {
    amount = shown !== null ? fmt(shown, state.currency) : fmt(state.balance, state.currency)
    hint = '今日已用 ' + (state.todayUsage !== null && state.todayUsage !== undefined ? fmt(state.todayUsage, state.currency) : '--')
  }
  amountEl.textContent = amount
  if (bubbleRandomActive && bubbleRandomLines) {
    applyBubbleLines(bubbleRandomLines)
  } else {
    setHint(hint)
  }
}
// 桌面版：鲸鱼固定锚在窗口右下角（CSS right:0;bottom:0），移动/吸附由主进程
// 移动整个窗口完成，因此页面内定位函数改为空操作，仅保留吸附翻转状态。
function express() {
  root.classList.toggle('dshwv-left', state.h === 'left')
}
function settle() {
  express()
}
// 主进程吸附完成后回写吸附状态并保存
function applySnap(h, v) {
  state.h = (h === 'left' || h === 'right') ? h : null
  state.v = (v === 'top' || v === 'bottom') ? v : 'bottom'
  root.classList.toggle('dshwv-left', state.h === 'left')
  saveConfig()
}
function refresh(manual) {
  if (busy) return
  busy = true
  if (animDelayTimer) { clearTimeout(animDelayTimer); animDelayTimer = null }
  if (manual || state.balance === null) { state.status = 'loading'; render() }
  API.fetchBalance()
    .then(function (data) {
      if (data && data.ok) {
        var nb = Number(data.totalBalance)
        var nc = String(data.currency || 'CNY')
        var prevBalance = state.balance
        var changed = state.balance !== null && (nb !== state.balance || nc !== state.currency)
        var currencyChanged = state.currency !== null && nc !== state.currency
        state.balance = nb
        state.currency = nc
        state.message = ''
        state.todayUsage = data.todayUsage !== undefined ? data.todayUsage : null
        state.isPeak = !!data.isPeak
        checkLowBalance(nb)                         // 低余额预警（每天最多一次）
        if (changed && !currencyChanged) {
          if (!manual) {
            showBubble()
            state.status = 'changing'
            // 余额上涨（充值）时庆祝一下（移植自鲸鱼娘桌宠 TOPUP_LINE）
            if (prevBalance !== null && nb >= prevBalance + 0.01) {
              setHint(TOPUP_LINE)
              burstHearts(4)
              affection.topups = (affection.topups || 0) + 1   // 成就：小金库
              saveAffection()
            }
            // balance-change bubble: wait 0.3s after it floats out, then roll the number
            if (animDelayTimer) clearTimeout(animDelayTimer)
            animDelayTimer = setTimeout(function () {
              animDelayTimer = null
              animateAmount(shown, nb, nc, ANIM_MS)
            }, 300)
            if (settleTimer) clearTimeout(settleTimer)
            settleTimer = setTimeout(function () {
              settleTimer = null
              if (state.status === 'changing') { state.status = 'ok'; render() }
            }, CHANGE_MS + 300)
          } else {
            animateAmount(shown, nb, nc, ANIM_MS)
            state.status = 'ok'
            render()
          }
        } else {
          if (animId === null) shown = nb
          state.status = 'ok'
          render()
        }
      } else {
        state.status = 'error'
        state.message = (data && data.error) ? String(data.error) : '获取失败'
        render()
      }
    })
    .catch(function () {
      state.status = 'error'
      state.message = '获取失败'
      render()
    })
    .finally(function () {
      busy = false
    })
}
var soundOn = true
var soundVol = 0.9
var soundSet = 'duck'
var usageMode = 'ledger'
var peakMode = 'default'
var bubbleOn = true
// 桌面版无 DSH 会话事件，「每轮对话消耗」功能不可用，保持关闭
var turnCostOn = false
var turnCostCloseMs = 5000
var costBubbleActive = false
var scrollGapOn = false
var scrollGapPx = 17
function saveConfig() {
  try {
    API.saveConfig({
      scale: state.scale,
      sound: soundOn,
      vol: soundVol,
      soundSet: soundSet,
      usageMode: usageMode,
      peakMode: peakMode,
      bubbleOn: bubbleOn,
      scrollGapOn: scrollGapOn,
      scrollGapPx: scrollGapPx,
      pos: { hAnchor: state.h, vAnchor: state.v }
    })
  } catch (err) {}
}
function setUsageMode(v) {
  usageMode = v === 'token' ? 'token' : 'ledger'
  usageSelect.value = usageMode
  saveConfig()
  refresh(false)
}
function setPeakMode(v) {
  peakMode = v === 'liangwen' || v === 'qiangqiang' ? v : 'default'
  peakSelect.value = peakMode
  saveConfig()
}
function setBubbleOn(v) {
  bubbleOn = !!v
  bubbleToggle.checked = bubbleOn
  saveConfig()
  // 必须走 hideCostBubble：残留的 costBubbleActive 会让 render()/showBubble() 永久早退
  if (!bubbleOn) hideCostBubble()
}
function scaleToDisplay(s) {
  return Math.round((s - MIN_SCALE) / ((MAX_SCALE - MIN_SCALE) / 19)) + 1
}
function setScale(v) {
  var next = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(v))) * 10) / 10
  // 缩放测量需要 left/top 立即到位：临时禁用过渡（滚轮/数字框路径没有
  // 滑块 pointerdown 的 transition:none，否则 r2 测的是过渡起点导致错锚点）
  var prevTrans = root.style.transition
  root.style.transition = 'none'
  var rect = root.getBoundingClientRect()
  // fixed point: the whale's corner — bottom-right when unflipped, bottom-left
  // when flipped. Growing extends the widget up-left / up-right from that
  // corner; shrinking pulls it back toward the corner. The whale always hugs
  // its corner while scaling.
  var fx = state.h === 'left' ? rect.left : rect.right
  var fy = rect.bottom
  state.scale = next
  root.style.setProperty('--dshw-scale', String(next))
  scaleInput.value = String(next)
  scaleNumber.value = String(scaleToDisplay(next))
  saveConfig()
  // keep the corner fixed while resizing; the position correction applies
  // instantly because the caller disables the transition for the whole drag
  var r2 = root.getBoundingClientRect()
  var vp = viewport()
  if (state.h === 'left') {
    state.left = Math.min(Math.max(fx, 0), Math.max(0, vp.w - r2.width))
  } else {
    state.left = Math.min(Math.max(fx - r2.width, 0), Math.max(0, vp.w - r2.width))
  }
  state.top = Math.min(Math.max(fy - r2.height, 0), Math.max(0, vp.h - r2.height))
  express()
  // 恢复过渡必须延迟到下一帧：本帧 left/top 已在 none 下设置并提交，
  // 立即恢复会让浏览器对「刚改过的 left/top」重新评估并播放过渡动画
  // （翻转时叠加 transform .3s 更明显，表现为抽搐）。
  requestAnimationFrame(function () {
    root.style.transition = prevTrans
  })
}
function setVol(v) {
  var next = Math.round(Math.min(1, Math.max(0, Number(v))) * 100) / 100
  soundVol = next
  soundOn = next > 0
  volInput.value = String(next)
  volPct.textContent = Math.round(next * 100) + '%'
  try {
    if (pressAudio) pressAudio.volume = next
    if (releaseAudio) releaseAudio.volume = next
  } catch (err) {}
  saveConfig()
}
function setSoundSet(v) {
  soundSet = v === 'fx1' ? 'fx1' : 'duck'
  soundSelect.value = soundSet
  applySoundSet()
  saveConfig()
}
var SQUISH = 'scaleY(0.88) scaleX(1.05)'
var pressAudio = null
var releaseAudio = null
var pressing = false
var pressEnded = false
var releasePlayed = false
var releaseTimer = null
var SOUND_FILES = {
  duck: { press: './assets/Ya1.mp3', release: './assets/Ya2.mp3' },
  fx1: { press: './assets/D1.mp3', release: './assets/D2.mp3' }
}
function applySoundSet() {
  try {
    var files = SOUND_FILES[soundSet] || SOUND_FILES.duck
    pressAudio = new Audio(files.press)
    pressAudio.preload = 'auto'
    pressAudio.volume = soundVol
    releaseAudio = new Audio(files.release)
    releaseAudio.preload = 'auto'
    releaseAudio.volume = soundVol
  } catch (err) {}
}
function playPress() {
  if (!pressAudio || !soundOn) return
  try {
    if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null }
    if (releaseAudio) {
      releaseAudio.pause()
      releaseAudio.currentTime = 0
    }
    pressEnded = false
    releasePlayed = false
    pressAudio.onended = function () {
      pressEnded = true
      // fallback (duration unknown): click → Ya2 right after Ya1 ends
      if (!pressing && !releasePlayed) playRelease()
      // hold: still pressed → wait for pressUp()
    }
    pressAudio.currentTime = 0
    var p = pressAudio.play()
    if (p && typeof p.catch === 'function') p.catch(function () {})
  } catch (err) {}
}
function playRelease() {
  if (releasePlayed || !releaseAudio || !soundOn) return
  releasePlayed = true
  try {
    releaseAudio.currentTime = 0
    var p = releaseAudio.play()
    if (p && typeof p.catch === 'function') p.catch(function () {})
  } catch (err) {}
}
function pressDown() {
  body.style.transform = SQUISH
  pressing = true
  playPress()
}
function pressUp() {
  body.style.transform = 'scaleY(1) scaleX(1)'
  pressing = false
  if (pressEnded) {
    // hold (or released after Ya1 finished) → Ya2 now
    playRelease()
    return
  }
  // click: start Ya2 in the last 100ms of Ya1's playback
  var durKnown = false
  var remainMs = 0
  try {
    var dur = pressAudio ? pressAudio.duration : 0
    if (isFinite(dur) && dur > 0) {
      durKnown = true
      remainMs = (dur - pressAudio.currentTime) * 1000
    }
  } catch (err) {}
  if (durKnown) {
    releaseTimer = setTimeout(function () {
      releaseTimer = null
      playRelease()
    }, Math.max(0, remainMs - 100))
  }
  // duration unknown → pressAudio.onended fallback plays Ya2 after Ya1 ends
}
var menuOpen = false
function toggleMenu() {
  menuOpen = !menuOpen
  if (menuOpen) {
    positionMenu()
    refreshAffSummary()
    updatePeakNowRow()
    updateRemindStatus()
    updateSpendRow()
    if (helpOpen) closeHelp()
    if (courseOpen) toggleCourse()
    if (gameOpen) toggleGame()
    if (todoOpen) toggleTodo()
    // 开机自启以「启动」文件夹里的实际文件为准，打开菜单时同步一次
    if (API.getStartup) API.getStartup().then(function (on) { autoToggle.checked = !!on }).catch(function () {})
  }
  menuBox.classList.toggle('dshwv-menu-open', menuOpen)
  if (menuOpen) menuBtn.classList.add('dshwv-menu-btn-visible')
}
function closeMenu() {
  menuOpen = false
  menuBox.classList.remove('dshwv-menu-open')
  root.style.transition = ''
}
function positionMenu() {
  try {
    var r = root.getBoundingClientRect()
    var b = menuBtn.getBoundingClientRect()
    var vp = viewport()
    var onLeft = r.left + r.width / 2 < vp.w / 2
    // the menu appears ABOVE the button, anchored to its side:
    // right side → menu bottom-right aligns with the button's top-right;
    // left side → menu bottom-left aligns with the button's top-left
    if (onLeft) {
      menuBox.style.left = b.left + 'px'
      menuBox.style.right = 'auto'
      menuBox.style.transformOrigin = 'bottom left'
    } else {
      menuBox.style.right = (vp.w - b.right) + 'px'
      menuBox.style.left = 'auto'
      menuBox.style.transformOrigin = 'bottom right'
    }
    menuBox.style.bottom = (vp.h - b.top) + 'px'
    menuBox.style.top = 'auto'
    // v6 菜单行数增多：按按钮上方实际空间限高，超出的内部滚动（防窗口裁切）
    menuBox.style.maxHeight = Math.max(240, Math.round(b.top) - 10) + 'px'
  } catch (err) {}
}

var hitCanvas = null
var hitReady = false
function setupHitTest() {
  try {
    hitCanvas = document.createElement('canvas')
    hitCanvas.width = 610
    hitCanvas.height = 610
    var probe = new Image()
    probe.onload = function () {
      try {
        // 拉伸到 610×610 与 isWhaleHit 的坐标映射对齐；不指定尺寸会按原图大小绘制，
        // 回退到非 610×610 素材（如 DSniang02.png）时命中区域会错位
        hitCanvas.getContext('2d', { willReadFrequently: true }).drawImage(probe, 0, 0, 610, 610)
        hitReady = true
      } catch (err) {}
    }
    probe.onerror = function () {}
    probe.src = IMG_URL
  } catch (err) {}
}
function isWhaleHit(e) {
  if (!hitCanvas || !hitReady) return true
  try {
    var r = img.getBoundingClientRect()
    if (!r || r.width <= 0 || r.height <= 0) return false
    var lx = (e.clientX - r.left) / r.width * 610
    var ly = (e.clientY - r.top) / r.height * 610
    if (lx < 0 || ly < 0 || lx >= 610 || ly >= 610) return false
    if (state.h === 'left') lx = 610 - lx
    var data = hitCanvas.getContext('2d').getImageData(Math.floor(lx), Math.floor(ly), 1, 1).data
    return data[3] > 10
  } catch (err) {
    return true
  }
}
function onDocPointerDown(e) {
  if (e.target && e.target.closest) {
    if (e.target.closest('.dshwv-bubble') || e.target.closest('.dshwv-menu') || e.target.closest('.dshwv-menu-btn') || e.target.closest('.dshwv-help')) return
  }
  if (menuOpen) {
    closeMenu()
    return
  }
  if (helpOpen) {
    closeHelp()
    return
  }
  if (popOpen()) {
    if (courseOpen) toggleCourse()
    if (gameOpen) toggleGame()
    if (todoOpen) toggleTodo()
    return
  }
  if (e.button !== 0 && e.pointerType === 'mouse') return
  if (glideTimer) stopGlide()   // 抓住滑行中的小鲸鱼，立即停下
  if (walkTimer) stopWalk()     // 抓住散步中的小鲸鱼，立即停下
  if (!isWhaleHit(e)) return
  try { e.preventDefault(); e.stopPropagation() } catch (err) {}
  // 桌面版：按住鲸鱼 = 拖动整个窗口（主进程按位移移动窗口）。
  // 注意不能用 clientX/Y 差计算位移：窗口移动会触发合成 pointermove，
  // 其 client 坐标已按新窗口位置计算，会造成「移动→回弹」振荡（抽搐）。
  // 改用 movementX/Y（真实指针位移，合成事件为 0，天然过滤伪事件）。
  drag = { active: true, startX: e.clientX, startY: e.clientY, totalX: 0, totalY: 0, moved: false, hist: [] }
  root.classList.add('dshwv-dragging')
  pressDown()
  setWidgetCursor('grabbing')
  // 指针捕获：快速拖动时窗口可能暂时落后于光标，捕获保证事件不因指针
  // 短暂离开窗口而丢失（松手时在 endDrag 释放）
  try { root.setPointerCapture(e.pointerId) } catch (err) {}
  document.addEventListener('pointermove', onDocPointerMove, true)
  document.addEventListener('pointerup', onDocPointerUp, true)
  document.addEventListener('pointercancel', onDocPointerCancel, true)
}
function onDocPointerMove(e) {
  if (!drag || !drag.active) return
  var mx = e.movementX || 0
  var my = e.movementY || 0
  if (mx === 0 && my === 0) return // 合成事件（窗口移动引起），忽略
  drag.totalX += mx
  drag.totalY += my
  if (drag.totalX * drag.totalX + drag.totalY * drag.totalY >= CLICK_SQ) drag.moved = true
  // 采样拖动轨迹（甩出滑行的速度估算用）
  var now = Date.now()
  drag.hist.push({ t: now, x: drag.totalX, y: drag.totalY })
  if (drag.hist.length > 10) drag.hist.shift()
  if (drag.moved) {
    API.moveWindow(drag.totalX, drag.totalY)
  }
}
function onDocPointerUp(e) {
  // 拦截鲸鱼区域内的 pointerup：防止下方元素（如文件行）监听 pointerup 穿透误触发
  try { if (isWhaleHit(e)) { e.preventDefault(); e.stopPropagation() } } catch (err) {}
  endDrag(e, true)
}
function onDocPointerCancel(e) { endDrag(e, false) }
function onDocClickStopper(e) {
  // 只在鲸鱼命中区域拦截 click（保持透明区 pass-through）。
  // 持久注册（不随 endDrag 移除）——click 在 pointerup 之后派发，
  // 若在 endDrag 移除会导致 click 穿透到下方元素（如误打开文件）。
  if (!isWhaleHit(e)) return
  try { e.preventDefault(); e.stopPropagation() } catch (err) {}
}
document.addEventListener('pointerdown', onDocPointerDown, true)
document.addEventListener('click', onDocClickStopper, true)

var widgetCursor = ''
function setWidgetCursor(v) {
  if (v !== widgetCursor) {
    widgetCursor = v
    try { document.body.style.cursor = v } catch (err) {}
  }
}
function onDocPointerMoveCursor(e) {
  if (drag && drag.active) { setWidgetCursor('grabbing'); return }
  var el = null
  try { el = document.elementFromPoint(e.clientX, e.clientY) } catch (err) {}
  var overMenu = !!(el && el.closest && (el.closest('.dshwv-bubble') || el.closest('.dshwv-menu') || el.closest('.dshwv-menu-btn') || el.closest('.dshwv-help')))
  var over = overMenu || isWhaleHit(e)
  setWidgetCursor(over ? 'grab' : '')
  menuBtn.classList.toggle('dshwv-menu-btn-visible', over || menuOpen)
  // 鼠标穿透：不在鲸鱼/菜单上时把鼠标事件交给下层窗口（forward 保留 mousemove）
  if (API.setIgnore) API.setIgnore(!(over || menuOpen))
}
document.addEventListener('pointermove', onDocPointerMoveCursor, true)
// setIgnoreMouseEvents(forward:true) 保证 mousemove 转发；pointer 事件通常同步生成，
// 这里双监听兜底，避免某些平台只有 mousemove 时悬停检测失效
document.addEventListener('mousemove', onDocPointerMoveCursor, true)

function endDrag(e, clickAllowed) {
  if (!drag || !drag.active) return
  drag.active = false
  try { root.releasePointerCapture(e.pointerId) } catch (err) {}
  document.removeEventListener('pointermove', onDocPointerMove, true)
  document.removeEventListener('pointerup', onDocPointerUp, true)
  document.removeEventListener('pointercancel', onDocPointerCancel, true)
  pressUp()
  root.classList.remove('dshwv-dragging')
  setWidgetCursor(isWhaleHit(e) ? 'grab' : '')
  // 甩得够快就滑出去（移植自鲸鱼娘桌宠 v5）；普通拖动偶尔抱怨
  var fling = (drag.moved && drag.hist.length >= 2) ? flingVelocity(drag.hist) : null
  if (drag.moved && !fling && Math.random() < 0.25) showAffBubble([affLine('A', pickLine(DRAG_LINES, ''), '', true)], 2200)
  if (clickAllowed && !drag.moved) { pokeTap(); showBubble(); refresh(true); return }
  if (fling) { startGlide(fling[0], fling[1]); return }
  // 拖拽结束：主进程做边缘吸附，回传吸附结果用于水平翻转
  API.dragEnd().then(function (snap) {
    if (snap) applySnap(snap.h, snap.v)
  }).catch(function () {})
}
// —— 甩出滑行：按最近 120ms 轨迹估速，惯性衰减滑行，停止后吸附 ——
function flingVelocity(hist) {
  var now = Date.now()
  var pts = hist.filter(function (p) { return now - p.t <= 120 })
  if (pts.length < 2) return null
  var a = pts[0]
  var b = pts[pts.length - 1]
  var dt = b.t - a.t
  if (dt < 5) return null
  var vx = (b.x - a.x) / dt
  var vy = (b.y - a.y) / dt
  if (Math.hypot(vx, vy) < 0.45) return null
  return [vx, vy]
}
var glideTimer = null
var glideState = null
function startGlide(vx0, vy0) {
  if (glideTimer) return
  // 限速：太快会整窗飞出屏幕外，上限 2.2px/ms（DIP）
  var sp = Math.hypot(vx0, vy0)
  var cap = 2.2
  var vx = sp > cap ? vx0 / sp * cap : vx0
  var vy = sp > cap ? vy0 / sp * cap : vy0
  glideState = { x: 0, y: 0, vx: vx, vy: vy }
  affection.throwCount = (affection.throwCount || 0) + 1   // 成就：惯性定律
  saveAffection()
  showAffBubble([affLine('A', pickLine(THROW_LINES, ''), '', true)], 2200)
  glideTimer = setInterval(function () {
    if (!glideState) return
    glideState.x += glideState.vx * 16
    glideState.y += glideState.vy * 16
    glideState.vx *= 0.92
    glideState.vy *= 0.92
    try { API.moveWindow(glideState.x, glideState.y) } catch (err) {}
    if (Math.hypot(glideState.vx, glideState.vy) < 0.03) stopGlide()
  }, 16)
}
function stopGlide() {
  if (glideTimer) { clearInterval(glideTimer); glideTimer = null }
  glideState = null
  try {
    API.dragEnd().then(function (snap) {
      if (snap) applySnap(snap.h, snap.v)
    }).catch(function () {})
  } catch (err) {}
}
// —— 初始化：读取配置（来自 userdata.json，经主进程 IPC）并启动余额轮询 ——
var rect0 = root.getBoundingClientRect()
state.left = rect0.left
state.top = rect0.top
express()
render()
img.classList.add('dshwv-breathe')   // 待机呼吸微动（静止立绘也有"活着"的感觉）
applySoundSet()
setupHitTest()
// 启动即开启鼠标穿透（forward 保留 mousemove，悬停鲸鱼时再取消穿透）
if (API.setIgnore) API.setIgnore(true)
API.getConfig()
  .then(function (d) {
    if (!d) return
    if (typeof d.scale === 'number' && d.scale >= MIN_SCALE - 0.1 && d.scale <= MAX_SCALE + 0.1) {
      state.scale = d.scale
      root.style.setProperty('--dshw-scale', String(d.scale))
      scaleInput.value = String(d.scale)
      scaleNumber.value = String(scaleToDisplay(d.scale))
    }
    if (typeof d.vol === 'number') {
      soundVol = d.vol
      soundOn = soundVol > 0
      volInput.value = String(soundVol)
      volPct.textContent = Math.round(soundVol * 100) + '%'
      try {
        if (pressAudio) pressAudio.volume = soundVol
        if (releaseAudio) releaseAudio.volume = soundVol
      } catch (err) {}
    }
    if (typeof d.soundSet === 'string') {
      soundSet = d.soundSet === 'fx1' ? 'fx1' : 'duck'
      soundSelect.value = soundSet
      applySoundSet()
    }
    if (typeof d.usageMode === 'string') {
      usageMode = d.usageMode === 'token' ? 'token' : 'ledger'
      usageSelect.value = usageMode
    }
    if (typeof d.peakMode === 'string') {
      peakMode = d.peakMode === 'liangwen' || d.peakMode === 'qiangqiang' ? d.peakMode : 'default'
      peakSelect.value = peakMode
    }
    if (typeof d.bubbleOn === 'boolean') {
      bubbleOn = d.bubbleOn
      bubbleToggle.checked = bubbleOn
    }
    if (d.hasApiKey !== undefined) {
      apiKeyInput.placeholder = d.hasApiKey ? '已配置 (修改后保存覆盖)' : 'sk-... 未配置'
    }
    if (d.hasPlatformToken !== undefined) {
      tokenInput.placeholder = d.hasPlatformToken ? '已配置 (修改后保存覆盖)' : '未配置 (可选)'
    }
    if (d.pos && (d.pos.hAnchor === 'left' || d.pos.hAnchor === 'right')) {
      state.h = d.pos.hAnchor
      root.classList.toggle('dshwv-left', state.h === 'left')
    }
    refresh(false)
  })
  .catch(function () { refresh(false) })
// —— 好感度读档 + 每日见面奖励 + 按好感分档的随机台词（移植自鲸鱼娘桌宠）——
API.getAffection()
  .then(function (d) {
    if (d && typeof d.score === 'number' && isFinite(d.score)) {
      // v6：整包并入存档字段再校准关键项——以后加新字段/旧存档统计不会因升级丢失
      for (var affKey in d) {
        if (Object.prototype.hasOwnProperty.call(d, affKey)) affection[affKey] = d[affKey]
      }
      affection.score = Math.max(0, Math.min(100, Number(d.score)))
      affection.lastDay = typeof d.lastDay === 'string' ? d.lastDay : ''
      affection.lastPat = typeof d.lastPat === 'number' ? d.lastPat : 0
      affection.lastFeed = typeof d.lastFeed === 'number' ? d.lastFeed : 0
      affection.pats = typeof d.pats === 'number' ? d.pats : 0
      affection.feeds = typeof d.feeds === 'number' ? d.feeds : 0
      affection.days = typeof d.days === 'number' ? d.days : 0
      if (typeof d.chatOn === 'boolean') affection.chatOn = d.chatOn
      if (typeof d.wordIdx === 'number') affection.wordIdx = d.wordIdx
      if (typeof d.studyCount === 'number') affection.studyCount = d.studyCount
      if (typeof d.studyMinutes === 'number') affection.studyMinutes = d.studyMinutes
      if (typeof d.studyMin === 'number') affection.studyMin = d.studyMin
      if (typeof d.waterOn === 'boolean') affection.waterOn = d.waterOn
      if (typeof d.walkOn === 'boolean') affection.walkOn = d.walkOn
      if (typeof d.lastLowBalDay === 'string') affection.lastLowBalDay = d.lastLowBalDay
      // —— v6 新增字段落档 ——
      if (typeof d.note === 'string') affection.note = d.note
      if (d.reminder && typeof d.reminder.at === 'number') {
        affection.reminder = { at: d.reminder.at, text: typeof d.reminder.text === 'string' ? d.reminder.text : '' }
      }
      if (typeof d.pokeCount === 'number') affection.pokeCount = d.pokeCount
      if (typeof d.nightStudy === 'number') affection.nightStudy = d.nightStudy
      if (typeof d.topups === 'number') affection.topups = d.topups
      if (typeof d.lastHoliday === 'string') affection.lastHoliday = d.lastHoliday
      if (typeof d.lastSleepNudge === 'string') affection.lastSleepNudge = d.lastSleepNudge
      chatToggle.checked = affection.chatOn
    }
    // v3 开关与计时器初始化（须在存档读完后执行，避免覆盖用户设置）
    waterToggle.checked = affection.waterOn !== false
    walkToggle.checked = affection.walkOn !== false
    if (affection.studyMin === 45 || affection.studyMin === 60) studySelect.value = String(affection.studyMin)
    nextWaterAt = Date.now() + WATER_MS_MIN + Math.random() * WATER_MS_VAR
    // 待机随机台词按好感度选词库：冷淡 / 日常 / 黏人
    RANDOM_GROUPS.push({
      w: 8,
      lines: function () {
        var s = affection.score
        var pool = s >= 60 ? IDLE_HIGH : (s >= 30 ? IDLE_MID : IDLE_LOW)
        return singleCenter('A', pickLine(pool, ''), '', true)
      }
    })
    // 每天第一次见面：好感 +2，按时段打招呼
    var today = todayKey()
    if (affection.lastDay !== today) {
      affection.lastDay = today
      affection.days = (affection.days || 0) + 1
      var up = addAffection(2)
      setTimeout(function () {
        if (!bubbleShown && !costBubbleActive) {
          showAffBubble([
            affLine('A', greetingText(), '', true),
            affLine('C', '♥ 每日见面 好感 +2 · ' + Math.round(affection.score) + '/100 ' + levelName(affection.score) + ' · 相伴 ' + affection.days + ' 天')
          ], 5000)
        }
      }, 1500)
      if (up) {
        // 跨级庆祝再补一条
        setTimeout(function () {
          if (!bubbleShown && !costBubbleActive) {
            burstHearts(9)
            showAffBubble(affBubbleLines(greetingText(), up, 2), 4200)
          }
        }, 7000)
      }
    }
    // —— v6 启动项：便答回显 / 节日彩蛋 / 到点未响的提醒补报 ——
    applySticky()
    updateRemindStatus()
    // —— v7 启动项：倒数日/待办/课程行按真实存档回显，课程提醒立即算一遍 ——
    updateCountdownRow()
    updateTodoRow()
    courseAlertTick()
    var mmdd = todayKey().slice(5)
    if (HOLIDAYS[mmdd] && affection.lastHoliday !== todayKey()) {
      affection.lastHoliday = todayKey()
      saveAffection()
      setTimeout(function () {
        burstHearts(8)
        showAffBubble([affLine('A', pickLine(HOLIDAYS[mmdd], ''), '', true)], 5600)
      }, 9500)
    }
    if (affection.reminder && typeof affection.reminder.at === 'number' && Date.now() >= affection.reminder.at) {
      var lateText = affection.reminder.text
      affection.reminder = null
      saveAffection()
      setTimeout(function () { fireReminder(lateText, true) }, 15000)
    }
  })
  .catch(function () {})
setInterval(function () { refresh(false) }, REFRESH_MS)
})()
