import { contextBridge, ipcRenderer } from 'electron'
import type { MesaApi } from './api'

const api: MesaApi = {
  isTest: ipcRenderer.sendSync('mesa:isTest') === true,
  host: (portText) => ipcRenderer.invoke('mesa:host', portText),
  stopHost: () => ipcRenderer.invoke('mesa:stopHost'),
  addresses: () => ipcRenderer.invoke('mesa:addresses'),
  copy: (text) => ipcRenderer.invoke('mesa:copy', text),
  importMap: () => ipcRenderer.invoke('mesa:importMap')
}

contextBridge.exposeInMainWorld('mesa', api)
