# Avisos y alcance de la licencia

El archivo `LICENSE` es la licencia MIT, en su texto canónico en inglés. Está
así a propósito: la traducción al español que llevaba antes, con estas
exclusiones pegadas debajo, hacía que GitHub no reconociera la licencia y la
ficha del repositorio no dijera **MIT**. El texto legal va suelto; lo que
delimita su alcance vive aquí.

La licencia MIT cubre **el código propio del equipo Jajanken**. No cubre:

- **Electron, Chromium, React** y el resto de dependencias, cada una bajo su
  propia licencia.
- **El SDK de QVAC** de Tether, bajo los términos de Tether.
- **Los modelos** `GEMMA4_2B_MULTIMODAL_Q4_K_M`, `WHISPER_BASE_Q8_0` y
  `EMBEDDINGGEMMA_300M_Q8_0`, del catálogo de QVAC, bajo Apache-2.0. Se
  descargan del catálogo: no se redistribuyen en este repositorio ni están
  entrenados ni ajustados por nosotros.
- **La marca y el logotipo de Philips**, propiedad de Koninklijke Philips N.V.
  Este proyecto es un prototipo para el reto de Philips del Hackathon ISD
  Summit 2026 y **no es un producto oficial de Philips**.
- **El brief del reto y su workbook de datos ficticios**, documentos de Philips
  que no se redistribuyen en este repositorio.

## Sobre los datos de demostración

Los datos que trae la aplicación son sintéticos y están declarados como tales
en cada archivo:

- `data/seed-philips.json` se deriva de la hoja *Dummy Installed Base* del
  workbook del reto, cuyos clientes, marcas y observaciones son ficticios por
  declaración de Philips. No se corrigió ninguna cifra.
- `data/seed-panama.json` son diez centros de salud **inventados** con la
  convención DemoCare. Las ciudades son ciudades reales de Panamá, porque el
  filtro geográfico tiene que probarse contra un mapa que existe. Ninguna
  institución real aparece en los datos ni en la interfaz.
