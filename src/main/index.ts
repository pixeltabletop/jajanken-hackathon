// Bootstrap de Electron. Aquí no vive lógica: crea la ventana, registra IPC
// y dispara el calentamiento de modelos en segundo plano.

import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpc } from './ipc.ts'
import { buildCanonical } from './qvac/dedup.ts'
import * as models from './qvac/models.ts'
import { createStore } from './store.ts'

function createWindow(): void {
  const w = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  w.on('ready-to-show', () => w.show())
  if (is.dev && process.env.ELECTRON_RENDERER_URL) w.loadURL(process.env.ELECTRON_RENDERER_URL)
  else w.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.jajanken.fieldlens')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))

  // El SDK lee esta variable al arrancar su worker, que ocurre en el primer loadModel.
  process.env.QVAC_CONFIG_PATH ??= join(app.getAppPath(), 'qvac.config.json')

  const store = createStore({
    userDataDir: app.getPath('userData'),
    seedDir: join(app.getAppPath(), 'data')
  })

  registerIpc(store)
  createWindow()

  // No bloquea la ventana. El renderer sondea models:status hasta ver los tres en ready.
  const customers = await store.customers()
  void models.warmup(customers.map((c) => c.name)).then(async (st) => {
    // Vectores canónicos listos antes de la primera deduplicación: ~50 ms por cliente
    // con el modelo caliente, y se cachean en userData/embeddings.json.
    if (st.embed.state !== 'ready') return
    try {
      const { cache, embedded } = await buildCanonical(models.requireModel('embed'), customers, await store.getVectors())
      if (embedded > 0) await store.setVectors(cache)
    } catch (e) {
      console.error('[precalculo de vectores]', e)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void models.unloadAll()
})
