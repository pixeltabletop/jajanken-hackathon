# FieldLens — Guion de demostración

1. Abrir FieldLens desde el acceso directo de Windows.
2. Mostrar que la aplicación indica `100% local · sin nube`.
3. Pulsar `Dictar` y decir una observación corta sobre un hospital y un equipo.
4. Detener el dictado y revisar el texto transcrito por Whisper local.
5. Pulsar `Interpretar con QVAC`.
6. Mostrar los campos extraídos y la pregunta por el dato faltante.
7. Corregir un campo si hace falta y guardar la observación.
8. Mostrar la alerta de posible duplicado si coincide con un registro sintético.
9. Filtrar la base instalada por país o modalidad.
10. Mostrar equipos de siete años o más y la métrica de confianza.

## Prueba offline

Antes de presentar, desconectar Wi-Fi. Abrir FieldLens y repetir los pasos 3 a 9. El dictado, la extracción, el guardado y los filtros deben seguir funcionando porque QVAC, Whisper, los modelos y los datos están en la laptop.

## Datos de prueba

Los veinte registros sintéticos provienen de `reference/Dummy_Installed_Base_Hackathon.xlsx`. El archivo original no se modifica. Los nuevos registros se guardan localmente en los datos de la aplicación.
