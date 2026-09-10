# Eco · Jajanken

Inteligencia de base instalada con IA 100% local. De la voz al dato, sin nube.

Entrega del equipo Jajanken para el **Track 01 de Philips** (Customer Installed
Base Intelligence) del ISD Summit 2026.

> El README completo lo escribe el Bloque 8 siguiendo el Anexo C del blueprint
> (qué es, bases preexistentes, hardware, instalación, modelos y
> cuantizaciones, reproducción del banco, verificación offline, limitaciones,
> trabajo futuro y licencias). Lo de abajo es lo que ya está verificado y no
> puede perderse por el camino.

## Nada sale de esta computadora, y nada entra

La extracción, la transcripción, la deduplicación y la interpretación de la
pregunta en español corren dentro del proceso principal de Electron con QVAC.
No hay servidor detrás.

**Todos los recursos viajan dentro del paquete.** El logo animado del arranque
(`src/renderer/src/assets/logo/*.webm`) se empaqueta con la aplicación y **no se
descarga en tiempo de ejecución**: Chromium reproduce WebM sin dependencia
adicional. No se cargan fuentes remotas ni ningún otro recurso de red. La
verificación del Bloque 4B comprueba, contra la app en ejecución, que no queda
ni una petición fuera de `localhost`.

El botón de correo abre el cliente de correo del usuario con un `mailto:`; el PDF
se guarda antes en disco porque un adjunto no viaja por ahí. **La aplicación no
envía nada por su cuenta.**

## Comandos

```bash
npm ci                                    # nunca copiar node_modules (D19)
npm run dev -- -- --remote-debugging-port=9222
npm run check                             # tipos + contraste medido en los tres temas
npm run smoke                             # el motor sin Electron
npm run bench:all                         # reproduce el banco de mediciones
node scripts/e2e-cycle.mjs                # ciclo de registro contra la app viva
node scripts/e2e-4b.mjs                   # verificación del Bloque 4B, 60 comprobaciones
```

Si `npm run dev` dice "Electron uninstall", ver **D22** en `DECISIONES.md`: el
binario se extrae a mano.

## Dónde está todo

| Qué | Dónde |
|---|---|
| Diseño, fuente de verdad | `docs/BLUEPRINT.md` |
| Decisiones con evidencia | `DECISIONES.md` |
| Contraste medido por tema | `docs/contraste.md` |
| Cambios que afectan al guion del video | `docs/GUION-VIDEO-CAMBIOS.md` |
| Mediciones crudas | `bench/` |

## Aviso

Prototipo del equipo Jajanken para el reto Philips · Hackathon ISD Summit 2026 ·
**No es un producto oficial de Philips.** Todos los clientes, marcas y equipos de
los datos son sintéticos: 13 sitios del workbook de Philips y 10 sitios ficticios
de Panamá. Ninguna cifra describe una institución real.
