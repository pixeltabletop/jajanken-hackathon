# MAM · Medical Asset Management

Aplicación de escritorio para Windows que convierte notas de campo de técnicos
en registros estructurados de base instalada, con inteligencia artificial **100 %
local** vía el SDK de QVAC. Hackathon ISD Summit 2026, Track 01 de Philips.
Entrega: viernes 2026-09-11, 08:00 hora de Panamá.

Antes de tocar nada, leer `DECISIONES.md`. Es el registro de qué se decidió y por
qué, y la regla de la casa es que **si no está ahí, no se decidió**.
`docs/BLUEPRINT.md` es el documento de diseño original y tiene partes
desactualizadas a propósito: lleva su propio aviso.

## Comandos

```bash
npm ci                               # instalar. NUNCA copiar node_modules (D19)
npm run dev                          # Electron en desarrollo
npm run check                        # tipos + contraste declarado + sin red
npm run smoke                        # el motor completo sin Electron
npm run smoke:semaforo               # el estado de los modelos no miente
npm run bench:all                    # el banco de mediciones, ~10 min
npm run build:win                    # instalador NSIS en dist/
```

Con la aplicación abierta con `npm run dev -- -- --remote-debugging-port=9222`:

```bash
node scripts/e2e-4b.mjs              # 84 comprobaciones sobre la app real
node scripts/check-contrast-vivo.mjs # contraste elemento por elemento
node scripts/smoke-semaforo-vivo.mjs # matar el motor y ver si la pantalla lo dice
```

## Tres cosas que cuestan una hora si no se saben

1. **El recargado en caliente solo cubre el renderer.** Un cambio en `src/main/`
   exige cerrar y volver a abrir la aplicación, o la verificación mide código
   viejo y el resultado miente.
2. **Si `npm run dev` dice "Electron uninstall"**, ver la D22: con Node 24 en
   Windows el postinstall descarga el zip de Electron pero no lo extrae, y hay
   que hacerlo a mano con `Expand-Archive`.
3. **La auditoría en vivo necesita datos únicos por corrida.** Si se repite con
   los mismos, pasa la primera vez y falla después.

## Arquitectura

```
src/main/      proceso principal. Aquí vive TODA la inferencia.
  qvac/        carga de modelos, extracción, transcripción, deduplicación, consulta
  store.ts     almacén en disco, JSON. No hay base de datos ni servidor.
  ipc.ts       la única frontera entre la interfaz y el motor
src/shared/    código puro compartido: motor de consulta, columnas, tipos
src/renderer/  React. No importa el SDK y no puede: no tiene acceso a Node.
```

## Reglas que no se negocian

- **Cero red.** La inferencia corre en el dispositivo. Una llamada a una API en
  la nube descalifica el proyecto entero. `npm run check:sin-red` lo comprueba
  sobre el código que se empaqueta, y falla si aparece `fetch`, un socket, una
  dirección externa u otro proveedor de IA.
- **El modelo extrae, el código clasifica.** Gemma devuelve texto y evidencia.
  Contar, agrupar, promediar y resolver contra el catálogo lo hace código
  determinista en `src/shared/query-engine.ts`. Cambiar esto rompe las cifras.
- **Cada dato lleva su cita.** La evidencia se valida como subcadena del texto
  original antes de guardarse. Es el diferenciador del producto, no un adorno.
- **Los colores salen de `src/renderer/src/assets/themes.ts`.** Un color escrito
  a mano en una hoja de estilo rompe el cambio de tema y la medición de
  contraste a la vez.
- **Nada de deshabilitar con `opacity`.** A 55 % el texto cae a 1,59:1 y deja de
  ser legible. Hay tokens propios para eso.

## Modelos, exactos

| Para qué | Modelo | Configuración medida |
|---|---|---|
| Extracción | `GEMMA4_2B_MULTIMODAL_Q4_K_M` | `ctx_size: 4096`, temperatura 0, semilla 42, `json_schema` |
| Voz | `WHISPER_BASE_Q8_0` | `language: 'es'`, `translate: false`, catálogo en `initial_prompt` |
| Deduplicación | `EMBEDDINGGEMMA_300M_Q8_0` | por ranking, **nunca** por umbral fijo |

Cambiar cualquiera de estos invalida las mediciones del banco, que son la
evidencia que sostiene el entregable.
