# Contraste medido

Generado por `node scripts/check-contrast.mjs --md`. No se edita a mano.

Cada par se mide con la fórmula de luminancia relativa de WCAG 2.1.
Umbral 4.5:1 para texto normal, 3:1 para texto grande y para el borde o
relleno que comunica un estado. La rejilla y las líneas divisorias son
decorativas y solo se vigila que no desaparezcan (1.2:1).

Última corrida: 2026-09-10 · 124/124 pares pasan.

## Blanco clásico

| Elemento | Estado | Fondo | Texto | Ratio | Umbral | Veredicto |
|---|---|---|---|---|---|---|
| Barra lateral · texto de una fila | normal | `#ffffff` | `#162b3d` | 14.51:1 | 4.5 | pasa |
| Barra lateral · titulo de grupo | normal | `#ffffff` | `#5b6f7f` | 5.22:1 | 4.5 | pasa |
| Barra lateral · semaforo, texto | normal | `#ffffff` | `#5b6f7f` | 5.22:1 | 4.5 | pasa |
| Barra lateral · icono | relleno | `#ffffff` | `#004b93` | 8.65:1 | 3 | pasa |
| Barra lateral · nombre del producto | grande | `#ffffff` | `#004b93` | 8.65:1 | 3 | pasa |
| Barra lateral · borde derecho | relleno | `#ffffff` | `#6e8ca1` | 3.54:1 | 3 | pasa |
| Barra lateral · fila al pasar el cursor | normal | `#f0f7fc` | `#162b3d` | 13.42:1 | 4.5 | pasa |
| Barra lateral · punto de accion encendida | relleno | `#ffffff` | `#0076ce` | 4.68:1 | 3 | pasa |
| Barra lateral · contorno de accion encendida | relleno | `#ffffff` | `#0076ce` | 4.68:1 | 3 | pasa |
| Barra lateral · fila deshabilitada | normal | `#fbfdff` | `#5b6f7f` | 5.12:1 | 4.5 | pasa |
| Barra lateral · avatar de sesion | normal | `#004b93` | `#ffffff` | 8.65:1 | 4.5 | pasa |
| Franja superior · titulo de seccion | grande | `#ffffff` | `#004b93` | 8.65:1 | 3 | pasa |
| Franja superior · subtitulo | normal | `#ffffff` | `#5b6f7f` | 5.22:1 | 4.5 | pasa |
| Texto de página | normal | `#f5f9fc` | `#162b3d` | 13.71:1 | 4.5 | pasa |
| Texto de tarjeta | normal | `#ffffff` | `#162b3d` | 14.51:1 | 4.5 | pasa |
| Texto secundario | normal | `#ffffff` | `#5b6f7f` | 5.22:1 | 4.5 | pasa |
| Texto secundario sobre página | normal | `#f5f9fc` | `#5b6f7f` | 4.93:1 | 4.5 | pasa |
| Texto secundario sobre superficie sutil | normal | `#fbfdff` | `#5b6f7f` | 5.12:1 | 4.5 | pasa |
| Encabezado de sección | grande | `#ffffff` | `#004b93` | 8.65:1 | 3 | pasa |
| Encabezado de tabla | normal | `#eaf6fd` | `#004b93` | 7.87:1 | 4.5 | pasa |
| Etiqueta de filtro activo (chip) | normal | `#eaf6fd` | `#004b93` | 7.87:1 | 4.5 | pasa |
| Botón principal | normal | `#0076ce` | `#ffffff` | 4.68:1 | 4.5 | pasa |
| Botón principal | hover | `#004b93` | `#ffffff` | 8.65:1 | 4.5 | pasa |
| Botón principal contra la página | relleno | `#f5f9fc` | `#0076ce` | 4.43:1 | 3 | pasa |
| Botón secundario | normal | `#ffffff` | `#004b93` | 8.65:1 | 4.5 | pasa |
| Borde de campo | relleno | `#ffffff` | `#6e8ca1` | 3.54:1 | 3 | pasa |
| Anillo de foco | foco | `#ffffff` | `#0076ce` | 4.68:1 | 3 | pasa |
| Anillo de foco sobre página | foco | `#f5f9fc` | `#0076ce` | 4.43:1 | 3 | pasa |
| Anillo de foco sobre selección | foco+elegido | `#eaf6fd` | `#0076ce` | 4.26:1 | 3 | pasa |
| Fila de tabla | hover | `#f0f7fc` | `#162b3d` | 13.42:1 | 4.5 | pasa |
| Fila de tabla | elegida | `#eaf6fd` | `#162b3d` | 13.20:1 | 4.5 | pasa |
| Fila de tabla elegida, texto secundario | elegida | `#eaf6fd` | `#5b6f7f` | 4.75:1 | 4.5 | pasa |
| Opción de desplegable | normal | `#ffffff` | `#162b3d` | 14.51:1 | 4.5 | pasa |
| Candidato de duplicado | elegido | `#eaf6fd` | `#162b3d` | 13.20:1 | 4.5 | pasa |
| Tarjeta del selector | normal | `#ffffff` | `#162b3d` | 14.51:1 | 4.5 | pasa |
| Tarjeta del selector | hover | `#f0f7fc` | `#162b3d` | 13.42:1 | 4.5 | pasa |
| Tarjeta del selector | elegida | `#eaf6fd` | `#004b93` | 7.87:1 | 4.5 | pasa |
| Badge de confianza alta | normal | `#dcede3` | `#1c6b47` | 5.32:1 | 4.5 | pasa |
| Badge de confianza media | normal | `#f7ebd6` | `#7a4f0a` | 6.04:1 | 4.5 | pasa |
| Badge de confianza baja | normal | `#f8e4e1` | `#9e362b` | 5.69:1 | 4.5 | pasa |
| Aviso ámbar | normal | `#fff8e5` | `#4a3a10` | 10.41:1 | 4.5 | pasa |
| Aviso ámbar, borde | relleno | `#fff8e5` | `#8a5a0c` | 5.58:1 | 3 | pasa |
| Resaltado de evidencia | resaltado | `#ffe98a` | `#1c1a12` | 14.33:1 | 4.5 | pasa |
| Texto seleccionado con el ratón | selección | `#ffe98a` | `#1c1a12` | 14.33:1 | 4.5 | pasa |
| Borde del resaltado, dentro | relleno | `#ffe98a` | `#a37d00` | 3.15:1 | 3 | pasa |
| Borde del resaltado sobre el texto de la nota | relleno | `#eaf6fd` | `#a37d00` | 3.48:1 | 3 | pasa |
| Borde del resaltado sobre la tarjeta | relleno | `#ffffff` | `#a37d00` | 3.82:1 | 3 | pasa |
| Barra de gráfico elegida | elegida | `#ffffff` | `#004b93` | 8.65:1 | 3 | pasa |
| Barra de gráfico atenuada | no elegida | `#ffffff` | `#6693b6` | 3.27:1 | 3 | pasa |
| Rejilla del gráfico | relleno | `#ffffff` | `#dde8f0` | 1.24:1 | 1.2 | pasa |
| Línea divisoria | relleno | `#ffffff` | `#d8e5ed` | 1.28:1 | 1.2 | pasa |
| Texto deshabilitado | deshabilitado | `#ffffff` | `#5b6f7f` | 5.22:1 | 3 | pasa |
| Chip de columna elegida | elegida | `#eaf6fd` | `#004b93` | 7.87:1 | 4.5 | pasa |
| Tarjeta de reporte elegida | elegida | `#eaf6fd` | `#004b93` | 7.87:1 | 4.5 | pasa |
| Tarjeta de reporte elegida, descripción | elegida | `#eaf6fd` | `#5b6f7f` | 4.75:1 | 4.5 | pasa |
| Candidato de duplicado, borde | elegido | `#ffffff` | `#0076ce` | 4.68:1 | 3 | pasa |
| Pestaña activa | elegida | `#ffffff` | `#004b93` | 8.65:1 | 3 | pasa |
| Botón fantasma activado | elegido | `#eaf6fd` | `#004b93` | 7.87:1 | 4.5 | pasa |
| Fila abierta de la tabla | abierta | `#eaf6fd` | `#162b3d` | 13.20:1 | 4.5 | pasa |
| Botón deshabilitado | deshabilitado | `#fbfdff` | `#5b6f7f` | 5.12:1 | 4.5 | pasa |
| Botón deshabilitado, borde | deshabilitado | `#fbfdff` | `#d8e5ed` | 1.26:1 | 1.2 | pasa |
| Botón deshabilitado contra uno activo | deshabilitado | `#fbfdff` | `#0076ce` | 4.59:1 | 3 | pasa |

## Negro

| Elemento | Estado | Fondo | Texto | Ratio | Umbral | Veredicto |
|---|---|---|---|---|---|---|
| Barra lateral · texto de una fila | normal | `#0a0b0d` | `#f4f6f8` | 18.17:1 | 4.5 | pasa |
| Barra lateral · titulo de grupo | normal | `#0a0b0d` | `#adb9c4` | 9.86:1 | 4.5 | pasa |
| Barra lateral · semaforo, texto | normal | `#0a0b0d` | `#adb9c4` | 9.86:1 | 4.5 | pasa |
| Barra lateral · icono | relleno | `#0a0b0d` | `#9ad4f8` | 12.33:1 | 3 | pasa |
| Barra lateral · nombre del producto | grande | `#0a0b0d` | `#9ad4f8` | 12.33:1 | 3 | pasa |
| Barra lateral · borde derecho | relleno | `#0a0b0d` | `#6b7681` | 4.25:1 | 3 | pasa |
| Barra lateral · fila al pasar el cursor | normal | `#23272c` | `#f4f6f8` | 13.87:1 | 4.5 | pasa |
| Barra lateral · punto de accion encendida | relleno | `#0a0b0d` | `#4fb3f0` | 8.47:1 | 3 | pasa |
| Barra lateral · contorno de accion encendida | relleno | `#0a0b0d` | `#4fb3f0` | 8.47:1 | 3 | pasa |
| Barra lateral · fila deshabilitada | normal | `#1b1e22` | `#adb9c4` | 8.37:1 | 4.5 | pasa |
| Barra lateral · avatar de sesion | normal | `#9ad4f8` | `#04121d` | 11.85:1 | 4.5 | pasa |
| Franja superior · titulo de seccion | grande | `#0a0b0d` | `#9ad4f8` | 12.33:1 | 3 | pasa |
| Franja superior · subtitulo | normal | `#0a0b0d` | `#adb9c4` | 9.86:1 | 4.5 | pasa |
| Texto de página | normal | `#000000` | `#f4f6f8` | 19.38:1 | 4.5 | pasa |
| Texto de tarjeta | normal | `#141619` | `#f4f6f8` | 16.73:1 | 4.5 | pasa |
| Texto secundario | normal | `#141619` | `#adb9c4` | 9.07:1 | 4.5 | pasa |
| Texto secundario sobre página | normal | `#000000` | `#adb9c4` | 10.51:1 | 4.5 | pasa |
| Texto secundario sobre superficie sutil | normal | `#1b1e22` | `#adb9c4` | 8.37:1 | 4.5 | pasa |
| Encabezado de sección | grande | `#141619` | `#9ad4f8` | 11.35:1 | 3 | pasa |
| Encabezado de tabla | normal | `#12222e` | `#cfe6f5` | 12.59:1 | 4.5 | pasa |
| Etiqueta de filtro activo (chip) | normal | `#12222e` | `#cfe6f5` | 12.59:1 | 4.5 | pasa |
| Botón principal | normal | `#4fb3f0` | `#04121d` | 8.15:1 | 4.5 | pasa |
| Botón principal | hover | `#9ad4f8` | `#04121d` | 11.85:1 | 4.5 | pasa |
| Botón principal contra la página | relleno | `#000000` | `#4fb3f0` | 9.04:1 | 3 | pasa |
| Botón secundario | normal | `#141619` | `#9ad4f8` | 11.35:1 | 4.5 | pasa |
| Borde de campo | relleno | `#141619` | `#6b7681` | 3.91:1 | 3 | pasa |
| Anillo de foco | foco | `#141619` | `#7ecbff` | 10.25:1 | 3 | pasa |
| Anillo de foco sobre página | foco | `#000000` | `#7ecbff` | 11.87:1 | 3 | pasa |
| Anillo de foco sobre selección | foco+elegido | `#12222e` | `#7ecbff` | 9.18:1 | 3 | pasa |
| Fila de tabla | hover | `#23272c` | `#f4f6f8` | 13.87:1 | 4.5 | pasa |
| Fila de tabla | elegida | `#12222e` | `#f4f6f8` | 14.98:1 | 4.5 | pasa |
| Fila de tabla elegida, texto secundario | elegida | `#12222e` | `#adb9c4` | 8.12:1 | 4.5 | pasa |
| Opción de desplegable | normal | `#141619` | `#f4f6f8` | 16.73:1 | 4.5 | pasa |
| Candidato de duplicado | elegido | `#12222e` | `#f4f6f8` | 14.98:1 | 4.5 | pasa |
| Tarjeta del selector | normal | `#141619` | `#f4f6f8` | 16.73:1 | 4.5 | pasa |
| Tarjeta del selector | hover | `#23272c` | `#f4f6f8` | 13.87:1 | 4.5 | pasa |
| Tarjeta del selector | elegida | `#12222e` | `#cfe6f5` | 12.59:1 | 4.5 | pasa |
| Badge de confianza alta | normal | `#0c3a2b` | `#6fd3a5` | 6.97:1 | 4.5 | pasa |
| Badge de confianza media | normal | `#3d2c0f` | `#ecbc74` | 7.67:1 | 4.5 | pasa |
| Badge de confianza baja | normal | `#4a1d17` | `#f2a094` | 6.92:1 | 4.5 | pasa |
| Aviso ámbar | normal | `#33270e` | `#f6e6c8` | 11.88:1 | 4.5 | pasa |
| Aviso ámbar, borde | relleno | `#33270e` | `#ecbc74` | 8.36:1 | 3 | pasa |
| Resaltado de evidencia | resaltado | `#ffe98a` | `#1c1a12` | 14.33:1 | 4.5 | pasa |
| Texto seleccionado con el ratón | selección | `#ffe98a` | `#1c1a12` | 14.33:1 | 4.5 | pasa |
| Borde del resaltado, dentro | relleno | `#ffe98a` | `#a37d00` | 3.15:1 | 3 | pasa |
| Borde del resaltado sobre el texto de la nota | relleno | `#12222e` | `#a37d00` | 4.24:1 | 3 | pasa |
| Borde del resaltado sobre la tarjeta | relleno | `#141619` | `#a37d00` | 4.74:1 | 3 | pasa |
| Barra de gráfico elegida | elegida | `#141619` | `#9ad4f8` | 11.35:1 | 3 | pasa |
| Barra de gráfico atenuada | no elegida | `#141619` | `#5c8fb0` | 5.19:1 | 3 | pasa |
| Rejilla del gráfico | relleno | `#141619` | `#2a3037` | 1.36:1 | 1.2 | pasa |
| Línea divisoria | relleno | `#141619` | `#343a41` | 1.58:1 | 1.2 | pasa |
| Texto deshabilitado | deshabilitado | `#141619` | `#adb9c4` | 9.07:1 | 3 | pasa |
| Chip de columna elegida | elegida | `#12222e` | `#cfe6f5` | 12.59:1 | 4.5 | pasa |
| Tarjeta de reporte elegida | elegida | `#12222e` | `#cfe6f5` | 12.59:1 | 4.5 | pasa |
| Tarjeta de reporte elegida, descripción | elegida | `#12222e` | `#adb9c4` | 8.12:1 | 4.5 | pasa |
| Candidato de duplicado, borde | elegido | `#141619` | `#4fb3f0` | 7.80:1 | 3 | pasa |
| Pestaña activa | elegida | `#141619` | `#9ad4f8` | 11.35:1 | 3 | pasa |
| Botón fantasma activado | elegido | `#12222e` | `#cfe6f5` | 12.59:1 | 4.5 | pasa |
| Fila abierta de la tabla | abierta | `#12222e` | `#f4f6f8` | 14.98:1 | 4.5 | pasa |
| Botón deshabilitado | deshabilitado | `#1b1e22` | `#adb9c4` | 8.37:1 | 4.5 | pasa |
| Botón deshabilitado, borde | deshabilitado | `#1b1e22` | `#343a41` | 1.46:1 | 1.2 | pasa |
| Botón deshabilitado contra uno activo | deshabilitado | `#1b1e22` | `#4fb3f0` | 7.20:1 | 3 | pasa |

## Lo que estaba fallando antes del Bloque 4B

| Elemento | Antes | Ratio antes | Ahora | Ratio ahora |
|---|---|---|---|---|
| Anillo de foco sobre blanco | `#caecff` sobre `#ffffff` | 1.16:1 | `#0076ce` sobre `#ffffff` | 4.68:1 |
| Anillo de foco sobre azul cielo | `#caecff` sobre `#eaf6fd` | 1.09:1 | `#0076ce` sobre `#eaf6fd` | 4.44:1 |
| Borde de campo de formulario | `#aec7d7` sobre `#ffffff` | 1.75:1 | `#6e8ca1` sobre `#ffffff` | 3.54:1 |
| Badge de confianza media | `#8a5a0c` sobre `#f5e8d2` | 4.42:1 | `#7a4f0a` sobre `#f7ebd6` | 5.44:1 |
| Badge de confianza baja | `#9e362b` sobre `#f5e1de` | 4.46:1 | `#9e362b` sobre `#f8e4e1` | 4.58:1 |
| Borde del resaltado de evidencia | `#e0bd3c` sobre `#ffe98a` | 1.42:1 | `#a37d00` sobre `#ffe98a` | 3.15:1 |

El resaltado de evidencia es el diferenciador del producto, así que su par
amarillo/tinta es idéntico en los tres temas: el `<mark>` lleva su propio
fondo, y lo que cambia por tema es el fondo que tiene alrededor. Lo que se
mide contra ese fondo es el borde de 2 px del resaltado, que pasa 3:1 en los
tres. Así el resaltado nunca depende solo del color.
