import { contextBridge, ipcRenderer } from 'electron'
import type { UpdateState } from '../core/update-state'
import type { MesaApi } from './api'

const api: MesaApi = {
  isTest: ipcRenderer.sendSync('mesa:isTest') === true,
  version: String(ipcRenderer.sendSync('mesa:version')),
  campaigns: () => ipcRenderer.invoke('mesa:campaigns'),
  createCampaign: (name) => ipcRenderer.invoke('mesa:createCampaign', name),
  host: (portText, campaign) => ipcRenderer.invoke('mesa:host', portText, campaign),
  campaign: () => ipcRenderer.invoke('mesa:campaign'),
  onCampaign: (fn) => {
    const listener = (_e: unknown, info: Parameters<typeof fn>[0]): void => fn(info)
    ipcRenderer.on('mesa:campaign', listener)
    return () => ipcRenderer.removeListener('mesa:campaign', listener)
  },
  openFolder: () => ipcRenderer.invoke('mesa:openFolder'),
  addFiles: (section) => ipcRenderer.invoke('mesa:addFiles', section),
  assetBytes: (hash) => ipcRenderer.invoke('mesa:assetBytes', hash),
  saveCena: (name, replace) => ipcRenderer.invoke('mesa:saveCena', name, replace),
  loadCena: (name) => ipcRenderer.invoke('mesa:loadCena', name),
  stopHost: () => ipcRenderer.invoke('mesa:stopHost'),
  addresses: () => ipcRenderer.invoke('mesa:addresses'),
  copy: (text) => ipcRenderer.invoke('mesa:copy', text),
  importMap: () => ipcRenderer.invoke('mesa:importMap'),
  loadPalette: () => ipcRenderer.invoke('mesa:loadPalette'),
  exportMesa: () => ipcRenderer.invoke('mesa:exportMesa'),
  importMesa: () => ipcRenderer.invoke('mesa:importMesa'),
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
