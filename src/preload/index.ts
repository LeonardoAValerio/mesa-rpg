import { contextBridge, ipcRenderer } from 'electron'
import type { UpdateState } from '../core/update-state'
import type { MesaApi } from './api'

const api: MesaApi = {
  isTest: ipcRenderer.sendSync('mesa:isTest') === true,
  version: String(ipcRenderer.sendSync('mesa:version')),
  host: (portText) => ipcRenderer.invoke('mesa:host', portText),
  stopHost: () => ipcRenderer.invoke('mesa:stopHost'),
  addresses: () => ipcRenderer.invoke('mesa:addresses'),
  copy: (text) => ipcRenderer.invoke('mesa:copy', text),
  importMap: () => ipcRenderer.invoke('mesa:importMap'),
  importTokens: () => ipcRenderer.invoke('mesa:importTokens'),
  loadPalette: () => ipcRenderer.invoke('mesa:loadPalette'),
  saveScene: () => ipcRenderer.invoke('mesa:saveScene'),
  loadScene: () => ipcRenderer.invoke('mesa:loadScene'),
  cacheGet: (hash) => ipcRenderer.invoke('mesa:cacheGet', hash),
  cachePut: (hash, bytes) => ipcRenderer.invoke('mesa:cachePut', hash, bytes),
  updateState: () => ipcRenderer.invoke('mesa:update-state'),
  onUpdateState: (fn) => {
    const listener = (_e: unknown, state: UpdateState): void => fn(state)
    ipcRenderer.on('mesa:update-state', listener)
    return () => void ipcRenderer.off('mesa:update-state', listener)
  },
  installUpdate: () => ipcRenderer.invoke('mesa:update-install')
}

contextBridge.exposeInMainWorld('mesa', api)
