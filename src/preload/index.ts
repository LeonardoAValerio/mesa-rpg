import { contextBridge, ipcRenderer } from 'electron'
import type { MesaApi } from './api'

const api: MesaApi = {
  isTest: ipcRenderer.sendSync('mesa:isTest') === true,
  host: (portText) => ipcRenderer.invoke('mesa:host', portText),
  stopHost: () => ipcRenderer.invoke('mesa:stopHost'),
  addresses: () => ipcRenderer.invoke('mesa:addresses'),
  copy: (text) => ipcRenderer.invoke('mesa:copy', text),
  importMap: () => ipcRenderer.invoke('mesa:importMap'),
  importTokens: () => ipcRenderer.invoke('mesa:importTokens'),
  loadPalette: () => ipcRenderer.invoke('mesa:loadPalette'),
  cacheGet: (hash) => ipcRenderer.invoke('mesa:cacheGet', hash),
  cachePut: (hash, bytes) => ipcRenderer.invoke('mesa:cachePut', hash, bytes)
}

contextBridge.exposeInMainWorld('mesa', api)
