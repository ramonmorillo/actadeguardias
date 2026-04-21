/**
 * Gestión de archivos adjuntos en Google Drive.
 * Los archivos se suben codificados en base64 desde el cliente.
 */

var MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

// ── Carpeta Drive ──────────────────────────────────────────────────────────

function getDriveFolderId() {
  var stored = getConfigValue('DRIVE_FOLDER_ID');
  if (stored) {
    try { DriveApp.getFolderById(stored); return stored; } catch (e) { /* carpeta borrada */ }
  }
  var folder = DriveApp.createFolder(
    'Adjuntos_GuardiasFarmacia_' + new Date().getFullYear()
  );
  setConfigValue('DRIVE_FOLDER_ID', folder.getId());
  return folder.getId();
}

// ── Mapper fila → objeto ───────────────────────────────────────────────────

function rowToAdjunto(row) {
  var schemaAdj = getAdjuntosSchema();
  return {
    id:           rowVal(row, schemaAdj.ID),
    idIncidencia: rowVal(row, schemaAdj.ID_INCIDENCIA),
    idParte:      rowVal(row, schemaAdj.ID_PARTE),
    nombre:       rowVal(row, schemaAdj.NOMBRE_ARCHIVO),
    url:          rowVal(row, schemaAdj.URL_DRIVE),
    idDrive:      rowVal(row, schemaAdj.ID_DRIVE),
    fechaSubida:  toISO(rowVal(row, schemaAdj.FECHA_SUBIDA)),
    subidoPor:    rowVal(row, schemaAdj.SUBIDO_POR),
    tipo:         rowVal(row, schemaAdj.TIPO_ARCHIVO),
    tamanyo:      rowVal(row, schemaAdj.TAMANYO),
    tamanyoLegible: formatBytes(rowVal(row, schemaAdj.TAMANYO))
  };
}

// ── Subir archivo ──────────────────────────────────────────────────────────

/**
 * Sube un archivo a Drive y lo registra en la hoja Adjuntos.
 * @param {string} token       Token de sesión.
 * @param {string} incidenciaId
 * @param {string} parteId
 * @param {string} fileName
 * @param {string} base64Data  Contenido del archivo en base64 (sin prefijo data:…)
 * @param {string} mimeType
 */
function uploadAdjunto(token, incidenciaId, parteId, fileName, base64Data, mimeType) {
  try {
    var user  = requireEditPermission(token);
    var email = user.email;

    if (!base64Data || base64Data.length < 4) throw new Error('El archivo está vacío.');

    // Estimación del tamaño original (base64 → bytes ≈ × 0.75)
    var estimatedBytes = Math.floor(base64Data.length * 0.75);
    if (estimatedBytes > MAX_FILE_BYTES) {
      throw new Error('El archivo supera el tamaño máximo de 5 MB.');
    }

    var decoded = Utilities.base64Decode(base64Data);
    var blob    = Utilities.newBlob(decoded, mimeType || 'application/octet-stream', fileName);

    var folder  = DriveApp.getFolderById(getDriveFolderId());
    var file    = folder.createFile(blob);
    // Acceso de lectura para cualquiera con el enlace (dentro del dominio)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var id  = generateId('ADJ');
    var now = new Date();

    appendRow(CONFIG.SHEETS.ADJUNTOS, [
      id,
      incidenciaId,
      parteId,
      fileName,
      file.getUrl(),
      file.getId(),
      now,
      email,
      mimeType,
      blob.getBytes().length
    ]);

    // Actualiza flag tieneAdjuntos en la incidencia
    marcarConAdjuntos(incidenciaId);

    return ok({ id: id, url: file.getUrl(), nombre: fileName }, 'Archivo adjuntado.');
  } catch (e) {
    logErr('uploadAdjunto', e);
    return fail(e.message);
  }
}

// ── Consultar ──────────────────────────────────────────────────────────────

function getAdjuntosByIncidencia(incidenciaId) {
  try {
    var schemaAdj = getAdjuntosSchema();
    var data = getAllRaw(CONFIG.SHEETS.ADJUNTOS);
    if (data.length <= 1) return ok([]);
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (normalizeIdKey(rowVal(data[i], schemaAdj.ID_INCIDENCIA)) === normalizeIdKey(incidenciaId) &&
          rowVal(data[i], schemaAdj.ID)) {
        list.push(rowToAdjunto(data[i]));
      }
    }
    return ok(list);
  } catch (e) {
    logErr('getAdjuntosByIncidencia', e);
    return fail(e.message);
  }
}

function getAdjuntosByParte(parteId) {
  try {
    var schemaAdj = getAdjuntosSchema();
    var data = getAllRaw(CONFIG.SHEETS.ADJUNTOS);
    if (data.length <= 1) return ok([]);
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (normalizeIdKey(rowVal(data[i], schemaAdj.ID_PARTE)) === normalizeIdKey(parteId) &&
          rowVal(data[i], schemaAdj.ID)) {
        list.push(rowToAdjunto(data[i]));
      }
    }
    return ok(list);
  } catch (e) {
    logErr('getAdjuntosByParte', e);
    return fail(e.message);
  }
}

// ── Eliminar ───────────────────────────────────────────────────────────────

function deleteAdjunto(token, id) {
  try {
    requireEditPermission(token);
    var schemaAdj = getAdjuntosSchema();
    var result = findRow(CONFIG.SHEETS.ADJUNTOS, schemaAdj.ID, normalizeIdKey(id));
    if (!result) throw new Error('Adjunto no encontrado.');

    // Mover a papelera en Drive (no elimina permanentemente)
    try {
      DriveApp.getFileById(rowVal(result.row, schemaAdj.ID_DRIVE)).setTrashed(true);
    } catch (e) { /* el archivo ya no existe en Drive */ }

    deleteRowByIndex(CONFIG.SHEETS.ADJUNTOS, result.rowIndex);
    return ok(null, 'Adjunto eliminado.');
  } catch (e) {
    logErr('deleteAdjunto', e);
    return fail(e.message);
  }
}
