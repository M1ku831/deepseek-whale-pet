// ============================================================================
// dsh-whale-widget 桌面版 —— preload（contextBridge）
// 渲染层只能通过 window.whaleAPI 与主进程通信，拿不到 Node / Electron 能力。
// ============================================================================
'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('whaleAPI', {
  getConfig: () => ipcRenderer.invoke('whale:getConfig'),
  saveConfig: (cfg) => ipcRenderer.invoke('whale:saveConfig', cfg),
  setApiKey: (key) => ipcRenderer.invoke('whale:setApiKey', key),
  setPlatformToken: (token) => ipcRenderer.invoke('whale:setPlatformToken', token),
  fetchBalance: () => ipcRenderer.invoke('whale:fetchBalance'),
  fetchLastTurn: () => ipcRenderer.invoke('whale:fetchLastTurn'),
  getUsageStats: () => ipcRenderer.invoke('whale:getUsageStats'),
  getWeather: () => ipcRenderer.invoke('whale:getWeather'),
  moveWindow: (dx, dy) => ipcRenderer.invoke('whale:moveWindow', dx, dy),
  dragEnd: () => ipcRenderer.invoke('whale:dragEnd'),
  quit: () => ipcRenderer.invoke('whale:quit'),
  setIgnore: (ignore) => ipcRenderer.send('whale:setIgnore', ignore),
  getAffection: () => ipcRenderer.invoke('whale:getAffection'),
  saveAffection: (data) => ipcRenderer.invoke('whale:saveAffection', data),
  getStartup: () => ipcRenderer.invoke('whale:getStartup'),
  setStartup: (on) => ipcRenderer.invoke('whale:setStartup', on),
  getWorkArea: () => ipcRenderer.invoke('whale:getWorkArea'),
  getPos: () => ipcRenderer.invoke('whale:getPos'),
  walkStep: (x, y) => ipcRenderer.invoke('whale:walkStep', x, y),
})
