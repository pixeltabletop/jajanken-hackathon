import { contextBridge, ipcRenderer } from 'electron'

// Superficie única del renderer hacia el proceso principal. Tipada en index.d.ts.
contextBridge.exposeInMainWorld('api', {
  modelsStatus: () => ipcRenderer.invoke('models:status'),
  modelsWarmup: () => ipcRenderer.invoke('models:warmup'),
  timings: () => ipcRenderer.invoke('timings:get'),
  cities: () => ipcRenderer.invoke('data:cities'),
  transcribe: (wav: Uint8Array) => ipcRenderer.invoke('audio:transcribe', { wav }),
  extract: (text: string, language: 'es' | 'en', source?: 'Voice' | 'Text') =>
    ipcRenderer.invoke('obs:extract', { text, language, source }),
  dedup: (facility: string, city: string | null) => ipcRenderer.invoke('obs:dedup', { facility, city }),
  save: (observation: unknown) => ipcRenderer.invoke('obs:save', observation),
  list: () => ipcRenderer.invoke('obs:list'),
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (patch: { operator?: string; theme?: string }) => ipcRenderer.invoke('settings:set', patch),
  report: (req: unknown, action: 'save' | 'open' | 'mail') => ipcRenderer.invoke('report:generate', { req, action }),
  queryParse: (question: string) => ipcRenderer.invoke('query:parse', { question })
})
