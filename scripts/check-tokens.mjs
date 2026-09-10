// Cada `var(--algo)` de las hojas de estilo tiene que existir de verdad.
//
//   npm run check:tokens
//
// Por qué existe. El medidor de contraste lee los tokens del objeto de temas y
// mide pares de colores. Nunca comprueba que ese color llegue al navegador con
// el nombre que la hoja de estilo pide. Y no llegaba: `surface2` se convertía en
// `--surface2` mientras diecisiete reglas escribían `var(--surface-2)`. Esa
// variable no existió nunca. Cada sitio que la usaba se quedaba sin fondo, en
// los dos temas, sin un solo error en consola y con el contraste en verde,
// porque un fondo que no se pinta deja ver el del padre y eso mide bien.
//
// Un color declarado y un color aplicado son dos cosas distintas. Esto comprueba
// la segunda, que es la que ve la persona.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { cssVarName, THEMES } from '../src/renderer/src/assets/themes.ts'

const DIR = 'src/renderer/src/assets'

/** Variables que NO son del tema y se definen en la propia hoja. Van declaradas. */
const PROPIAS = new Set(['--ease', '--lat-ancha', '--lat-estrecha'])

const tokens = new Set(Object.keys(THEMES[0].tokens).map((k) => cssVarName(k)))

const hojas = readdirSync(DIR).filter((f) => f.endsWith('.css'))
const usos = new Map()
const definidas = new Set()

for (const hoja of hojas) {
  const texto = readFileSync(join(DIR, hoja), 'utf8')
  texto.split(/\r?\n/).forEach((linea, i) => {
    for (const m of linea.matchAll(/--[a-z0-9-]+\s*:/gi)) definidas.add(m[0].replace(/\s*:$/, ''))
    for (const m of linea.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
      if (!usos.has(m[1])) usos.set(m[1], [])
      usos.get(m[1]).push(`${hoja}:${i + 1}`)
    }
  })
}

const huerfanas = []
for (const [nombre, sitios] of usos) {
  if (tokens.has(nombre) || PROPIAS.has(nombre) || definidas.has(nombre)) continue
  huerfanas.push({ nombre, sitios })
}

// El otro lado: tokens del tema que nadie usa. No es un fallo, es limpieza.
const sinUsar = [...tokens].filter((t) => !usos.has(t))

for (const h of huerfanas) {
  console.log(`FALLA ${h.nombre} no existe · ${h.sitios.length} uso(s): ${h.sitios.slice(0, 4).join(', ')}`)
}

console.log(`\n${usos.size} variables distintas usadas en ${hojas.length} hojas`)
console.log(`${tokens.size} tokens en el tema`)
if (sinUsar.length) console.log(`Tokens que nadie usa (no es un fallo): ${sinUsar.join(', ')}`)

// Los dos temas tienen que traer exactamente las mismas claves, o al cambiar de
// tema una variable se quedaría con el valor del anterior.
const claves = THEMES.map((t) => Object.keys(t.tokens).sort().join('|'))
const mismasClaves = claves.every((c) => c === claves[0])
console.log(`Los ${THEMES.length} temas declaran los mismos tokens: ${mismasClaves ? 'sí' : 'NO'}`)

const fallos = huerfanas.length + (mismasClaves ? 0 : 1)
console.log(fallos === 0 ? '\nTOKENS OK · toda variable usada existe' : `\nTOKENS: ${fallos} problemas`)
process.exit(fallos === 0 ? 0 : 1)
