# Acta de Guardias — Farmacia Hospitalaria

Aplicación web interna sobre **Google Apps Script + Google Sheets + Google Drive** para registrar, consultar y analizar las incidencias de los partes de guardia de fin de semana, puentes y festivos.

---

## Estructura de archivos

```
├── appsscript.json      # Manifiesto del proyecto Apps Script
├── Code.gs              # doGet(), include(), inicializarAplicacion()
├── Config.gs            # Constantes globales y definición de columnas
├── Utils.gs             # IDs, fechas, detección de datos sensibles, respuestas
├── SheetService.gs      # Capa de acceso a Sheets (CRUD genérico)
├── Permisos.gs          # Roles (admin/editor/lector), autenticación Google
├── Partes.gs            # CRUD de Partes de Guardia
├── Incidencias.gs       # CRUD de Incidencias
├── Adjuntos.gs          # Subida y gestión de ficheros en Drive
├── Busqueda.gs          # Búsqueda avanzada con filtros múltiples
├── Informes.gs          # Generación de informes, exportación CSV y PDF
├── Estadisticas.gs      # Cálculo de estadísticas para gráficos
├── Setup.gs             # Inicialización de hojas, catálogos y datos de ejemplo
└── index.html           # SPA (Bootstrap 5 + Chart.js), toda la interfaz de usuario
```

---

## Modelo de datos en Google Sheets

### Hoja `Config`
| Clave | Valor | Descripcion |
|---|---|---|
| APP_NAME | Acta de Guardias… | Nombre |
| VERSION | 1.0.0 | |
| DRIVE_FOLDER_ID | (ID auto) | Carpeta de adjuntos |
| MAX_FILE_MB | 5 | Límite de adjunto en MB |
| ITEMS_PER_PAGE | 25 | Paginación |
| ADMIN_EMAIL | | Email del admin |

### Hoja `Usuarios`
| Email | Nombre | Rol | Activo | FechaAlta |
|---|---|---|---|---|
| admin@farmacia.es | … | admin/editor/lector | TRUE/FALSE | fecha |

### Hoja `PartesGuardia`
| ID | FechaInicio | FechaFin | TipoPeriodo | Profesionales | CreadoPor | FechaCreacion | UltimaModificacion | ModificadoPor | Estado | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| PG-20250419-12345 | … | … | Fin de semana | Ana García, … | email | fecha | fecha | email | borrador/cerrado | texto |

### Hoja `Incidencias`
| ID | IDParte | FechaEvento | Area | TipoEntrada | Descripcion | Actuacion | Medicamentos | ServicioUbicacion | Prioridad | Etiquetas | RegistradoPor | FechaRegistro | FechaModificacion | ModificadoPor | Estado | Seguimiento | TieneAdjuntos |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| INC-… | PG-… | fecha | UCI | Incidencia clínica | texto | texto | Piperacilina… | UCI | alta | etiq,etiq | email | fecha | fecha | email | abierta/resuelta | texto | TRUE/FALSE |

### Hoja `Adjuntos`
| ID | IDIncidencia | IDParte | NombreArchivo | URLDrive | IDDrive | FechaSubida | SubidoPor | TipoArchivo | Tamanyo |
|---|---|---|---|---|---|---|---|---|---|
| ADJ-… | INC-… | PG-… | documento.pdf | https://drive… | 1BcD… | fecha | email | application/pdf | 102400 |

### Hoja `Catalogos`
| Tipo | Valor | Descripcion | Activo | Orden |
|---|---|---|---|---|
| Area | UCI | | TRUE | 7 |
| TipoEntrada | Desabastecimiento | | TRUE | 3 |
| Prioridad | crítica | | TRUE | 4 |
| TipoPeriodo | Puente | | TRUE | 2 |

---

## Instrucciones de despliegue paso a paso

### Paso 1 — Crear la hoja de cálculo

1. Ve a [Google Sheets](https://sheets.google.com) y crea una hoja de cálculo nueva.
2. Ponle nombre: **"Acta de Guardias - Farmacia"**.

### Paso 2 — Abrir el editor de Apps Script

1. En la hoja de cálculo: **Extensiones → Apps Script**.
2. Esto abre el editor vinculado a la hoja.

### Paso 3 — Crear los archivos del proyecto

**Opción A — Manualmente:**

Crea un archivo `.gs` por cada fichero (**Archivo → Nuevo → Script**):

```
Code.gs  Config.gs  Utils.gs  SheetService.gs  Permisos.gs
Partes.gs  Incidencias.gs  Adjuntos.gs  Busqueda.gs
Informes.gs  Estadisticas.gs  Setup.gs
```

Copia y pega el contenido de cada fichero en su pestaña correspondiente.

Para `index.html`: **Archivo → Nuevo → Archivo HTML**, nómbralo `index` y pega el contenido.

**Opción B — Con clasp (recomendada):**

```bash
npm install -g @google/clasp
clasp login
# Crear proyecto vinculado a la hoja de cálculo existente:
clasp create --type webapp --title "Guardias Farmacia" --rootDir .
# O vincular a una hoja ya existente:
clasp clone <scriptId>
clasp push
```

El `scriptId` está en la URL del editor de Apps Script: `script.google.com/d/<scriptId>/edit`.

### Paso 4 — Actualizar `appsscript.json`

En el editor: **Configuración del proyecto → Mostrar el archivo "appsscript.json"**.
Reemplaza el contenido con:

```json
{
  "timeZone": "Europe/Madrid",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_ACCESSING",
    "access": "DOMAIN"
  }
}
```

### Paso 5 — Inicializar la hoja de cálculo

1. En el editor de Apps Script, selecciona la función **`inicializarAplicacion`** en el menú desplegable.
2. Pulsa **Ejecutar**.
3. Acepta los permisos que solicite (Google Sheets, Drive, sesión de usuario).
4. Comprueba que en tu hoja de cálculo aparecen las hojas: `Config`, `Usuarios`, `PartesGuardia`, `Incidencias`, `Adjuntos`, `Catalogos`.

> Esta función crea todas las hojas, cabeceras, catálogos y datos de ejemplo realistas.
> **Solo debe ejecutarse una vez.** Si la vuelves a ejecutar no duplica datos (comprueba si ya existen filas).

### Paso 6 — Añadirte como administrador

1. Abre la hoja `Usuarios` en tu hoja de cálculo.
2. Añade una fila con tu email de Google, tu nombre, rol `admin`, valor `TRUE` en Activo, y la fecha de hoy.
3. Opcionalmente, en la hoja `Config`, rellena el valor de la clave `ADMIN_EMAIL` con tu email.

### Paso 7 — Desplegar como aplicación web

1. En el editor de Apps Script: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configuración:
   - **Ejecutar como:** `Usuario que accede a la aplicación` ← **imprescindible** para la trazabilidad por usuario.
   - **Quién puede acceder:** `Solo los usuarios del dominio` (o "Cualquier usuario de Google" si no tenéis dominio propio).
4. Pulsa **Implementar** y copia la URL generada.
5. Distribuye la URL al servicio de farmacia.

### Paso 8 — Actualizaciones futuras

Cada vez que modifiques el código:
1. **Implementar → Gestionar implementaciones**.
2. Editar la implementación activa → seleccionar **Nueva versión**.
3. Guardar.

---

## Configuración de permisos y usuarios

### Roles disponibles

| Rol | Crear/editar partes | Crear/editar incidencias | Subir adjuntos | Gestionar usuarios | Reabrir partes cerrados |
|---|:---:|:---:|:---:|:---:|:---:|
| `admin` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `editor` | ✓ | ✓ | ✓ | ✗ | ✗ |
| `lector` | ✗ | ✗ | ✗ | ✗ | ✗ |

### Añadir usuarios

**Manual:** Edita la hoja `Usuarios` directamente con las columnas: `Email, Nombre, Rol, Activo (TRUE), FechaAlta`.

**Auto-registro:** Si un usuario con cuenta Google accede a la app sin estar en la lista, queda registrado automáticamente con rol `lector`.

**Cambiar rol:** Un `admin` puede editar la celda de `Rol` directamente en la hoja `Usuarios`.

### Modificar catálogos

Los catálogos (Áreas, Tipos de entrada, Prioridades, Tipos de periodo) se gestionan en la hoja `Catalogos`:
- Para desactivar un valor: poner `FALSE` en la columna `Activo`.
- Para añadir un valor nuevo: añadir una fila nueva con `Tipo`, `Valor`, descripción, `TRUE` y número de orden.

---

## Configuración de la carpeta de Drive para adjuntos

La primera vez que se sube un adjunto, la app crea automáticamente la carpeta `Adjuntos_GuardiasFarmacia_<año>` en el Drive del usuario que ejecuta el script, y guarda su ID en `Config → DRIVE_FOLDER_ID`.

**Para usar una carpeta preexistente:**
1. Crea o localiza la carpeta en Google Drive.
2. Copia el ID de la URL: `drive.google.com/drive/folders/<ID>`.
3. En la hoja `Config`, en la fila `DRIVE_FOLDER_ID`, pega ese ID.
4. Comparte la carpeta con los usuarios del servicio (al menos con permisos de comentarista).

---

## Limitaciones conocidas y mejoras futuras

### Limitaciones de Google Apps Script

| Limitación | Impacto | Mejora futura |
|---|---|---|
| Tiempo máximo de ejecución: 6 min | Búsquedas lentas con >10.000 incidencias | Índices auxiliares o Cloud Firestore |
| Sin transacciones atómicas | Riesgo de sobreescritura si dos usuarios editan a la vez | LockService de Apps Script |
| Adjuntos max. ~5 MB por archivo | No apto para vídeos o ficheros grandes | Google Drive upload directo desde cliente |
| Sin WebSockets | Sin actualizaciones en tiempo real | Polling o Firebase Realtime DB |
| Cuota de ejecución diaria (6 h/día) | Puede limitarse en uso intensivo | Migración a Cloud Run |
| Permisos basados en hoja de cálculo | Sin IdP corporativo ni SSO avanzado | Integración con Google Cloud IAM |

### Mejoras futuras sugeridas

- Notificaciones automáticas por email al registrar incidencias críticas.
- Exportación a Excel (XLSX) además de CSV.
- Sistema de comentarios y hilo de seguimiento por incidencia.
- Integración con CIMA-AEMPS para validar nombres de medicamentos.
- Panel de administración de catálogos desde la propia interfaz.
- Historial de versiones por incidencia (quién cambió qué).
- Firma y validación de partes cerrados con timestamp verificado.
- Búsqueda full-text con Google Cloud Search.

---

## Pruebas manuales sugeridas

### Inicialización
- [ ] `inicializarAplicacion()` → 6 hojas creadas con cabeceras y datos de ejemplo.
- [ ] La hoja `Config` muestra todas las claves con valores correctos.

### Acceso y autenticación
- [ ] Abrir la URL de la web app → la navbar muestra nombre y rol del usuario activo.
- [ ] Un usuario no listado accede → queda registrado como `lector`.

### Dashboard
- [ ] KPIs muestran valores numéricos (no "—").
- [ ] La tabla de partes recientes muestra los partes de ejemplo.
- [ ] La tabla de incidencias abiertas muestra datos de ejemplo.

### Crear y editar un parte
- [ ] "Nuevo parte" → rellenar todos los campos → Guardar → aparece en el histórico.
- [ ] "Editar parte" → modificar observaciones → Guardar → cambios reflejados.
- [ ] "Cerrar parte" → estado cambia a "cerrado" → botón de edición desaparece para editores.

### Incidencias
- [ ] Añadir incidencia con prioridad "crítica" → borde rojo en la tarjeta.
- [ ] Editar incidencia → cambiar estado a "resuelta" → badge verde.
- [ ] Introducir "NHC: 123456" en descripción → aparece aviso de privacidad en toast.
- [ ] Filtrar por área dentro de un parte → se reducen las tarjetas.

### Adjuntos
- [ ] Guardar incidencia → subir PDF < 5 MB → aparece enlace en el modal.
- [ ] Abrir el enlace → abre el archivo en Drive.
- [ ] Eliminar adjunto → desaparece de la lista y el fichero va a la papelera de Drive.

### Búsqueda avanzada
- [ ] Buscar texto libre → resultados paginados.
- [ ] Filtrar por prioridad "crítica" → solo aparecen incidencias críticas.
- [ ] Filtrar "Con adjuntos: sí" → solo las que tienen adjuntos.
- [ ] Paginación: página 1, 2 → funciona el botón "Siguiente".

### Informes
- [ ] Seleccionar fechas del periodo de ejemplo → Generar informe → KPIs y tabla correctos.
- [ ] Exportar CSV → descargar y abrir en Excel → columnas con datos correctos y sin errores de encoding.
- [ ] Imprimir/PDF → se abre ventana del navegador con el informe maquetado listo para imprimir.

### Estadísticas
- [ ] La pestaña muestra 6 gráficos con datos reales.
- [ ] Cambiar rango de fechas → Actualizar → gráficos se recargan con los nuevos valores.

### Permisos
- [ ] Usuario `lector`: no ve botones de crear/editar. Solo lectura.
- [ ] Usuario `editor`: puede crear partes e incidencias. No puede reabrir un parte cerrado.
- [ ] Usuario `admin`: puede reabrir partes cerrados y cambiar roles.
