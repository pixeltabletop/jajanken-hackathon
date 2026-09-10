// Comprueba la limpieza de locks huerfanos SIN arrancar el worker ni cargar modelos.
//
// Los casos viven en un directorio temporal. Para no matar nada, el PID muerto
// es uno fuera del rango que Windows usa y el vivo es el proceso padre.

/* eslint-disable @typescript-eslint/explicit-function-return-type -- .mjs no admite anotaciones TypeScript. */

import { lstat, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import { limpiarLocksQvacHuerfanos } from '../src/main/qvac/models.ts'

let fallos = 0
const ok = (cond, texto) => {
  if (cond) console.log(`  OK   ${texto}`)
  else {
    fallos++
    console.log(`  FALLA ${texto}`)
  }
}

async function existe(ruta) {
  try {
    await lstat(ruta)
    return true
  } catch (e) {
    if (e?.code === 'ENOENT') return false
    throw e
  }
}

const raiz = await mkdtemp(join(os.tmpdir(), 'mam-locks-qvac-'))

console.log('Locks huerfanos de QVAC\n')

try {
  // -------------------------------------------------------------- PID muerto
  {
    const dir = join(raiz, 'muerto')
    await mkdir(dir)
    const lock = join(dir, '.worker.lock')
    await writeFile(lock, '{"pid":2147483647,"desde":"prueba"}')
    const borrados = await limpiarLocksQvacHuerfanos(dir)
    ok(!(await existe(lock)), 'un lock con PID muerto se borra')
    ok(borrados.length === 1 && borrados[0] === lock, 'la limpieza informa el lock borrado')
  }

  // --------------------------------------------------------------- PID vivo
  {
    const dir = join(raiz, 'vivo')
    await mkdir(dir)
    const vivo = join(dir, '.worker.lock')
    const propio = join(dir, '.cache.lock')
    await writeFile(vivo, `pid=${process.ppid}`)
    await writeFile(propio, `pid: ${process.pid}`)
    await limpiarLocksQvacHuerfanos(dir)
    ok(await existe(vivo), 'un lock con PID vivo NO se borra')
    ok(await existe(propio), 'el lock del propio proceso NO se borra')
  }

  // ------------------------------------------------------ ilegible o sin PID
  {
    const dir = join(raiz, 'ambiguo')
    await mkdir(dir)
    const ilegible = join(dir, '.worker.lock')
    const sinPid = join(dir, '.cache.lock')
    // Una carpeta con el nombre del lock fuerza un fallo de lectura portable.
    await mkdir(ilegible)
    await writeFile(sinPid, 'contenido sin identificador de proceso')
    await limpiarLocksQvacHuerfanos(dir)
    ok(await existe(ilegible), 'un lock ilegible NO se borra')
    ok(await existe(sinPid), 'un lock sin PID NO se borra')
  }

  // --------------------------------------------------------- ningun archivo
  {
    const dir = join(raiz, 'ausentes')
    await mkdir(dir)
    let borrados = null
    try {
      borrados = await limpiarLocksQvacHuerfanos(dir)
    } catch {
      borrados = null
    }
    ok(Array.isArray(borrados) && borrados.length === 0, 'la ausencia de locks no es un error')
  }
} finally {
  await rm(raiz, { recursive: true, force: true })
}

console.log(`\n${fallos === 0 ? 'Locks correctos.' : `${fallos} comprobaciones fallidas.`}`)
process.exit(fallos === 0 ? 0 : 1)
