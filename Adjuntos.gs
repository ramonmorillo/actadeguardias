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
  return {
    id:           row[COLS.ADJUNTOS.ID],
    idIncidencia: row[COLS.ADJUNTOS.ID_INCIDENCIA],
    idParte:      row[COLS.ADJUNTOS.ID_PARTE],
    nombre:       row[COLS.ADJUNTOS.NOMBRE_ARCHIVO],
    url:          row[COLS.ADJUNTOS.URL_DRIVE],
    idDrive:      row[COLS.ADJUNTOS.ID_DRIVE],
    fechaSubida:  toISO(row[COLS.ADJUNTOS.FECHA_SUBIDA]),
    subidoPor:    row[COLS.ADJUNTOS.SUBIDO_POR],
    tipo:         row[COLS.ADJUNTOS.TIPO_ARCHIVO],
    tamanyo:      row[COLS.ADJUNTOS.TAMANYO],
    tamanyoLegible: formatBytes(row[COLS.ADJUNTOS.TAMANYO])
  };
}

// ── Subir archivo ──────────────────────────────────────────────────────────

/**
 * Sube un archivo a Drive y lo registra en la hoja Adjuntos.
 * @param {string} incidenciaId
 * @param {string} parteId
 * @param {string} fileName
 * @param {string} base64Data  Contenido del archivo en base64 (sin prefijo data:…)
 * @param {string} mimeType
 */
function uploadAdjunto(incidenciaId, parteId, fileName, base64Data, mimeType) {
  try {
    requireEditPermission();
    var email = getCurrentUser();

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
    var data = getAllRaw(CONFIG.SHEETS.ADJUNTOS);
    if (data.length <= 1) return ok([]);
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][COLS.ADJUNTOS.ID_INCIDENCIA] === incidenciaId && data[i][COLS.ADJUNTOS.ID]) {
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
    var data = getAllRaw(CONFIG.SHEETS.ADJUNTOS);
    if (data.length <= 1) return ok([]);
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][COLS.ADJUNTOS.ID_PARTE] === parteId && data[i][COLS.ADJUNTOS.ID]) {
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

function deleteAdjunto(id) {
  try {
    requireEditPermission();
    var result = findRow(CONFIG.SHEETS.ADJUNTOS, COLS.ADJUNTOS.ID, id);
    if (!result) throw new Error('Adjunto no encontrado.');

    // Mover a papelera en Drive (no elimina permanentemente)
    try {
      DriveApp.getFileById(result.row[COLS.ADJUNTOS.ID_DRIVE]).setTrashed(true);
    } catch (e) { /* el archivo ya no existe en Drive */ }

    deleteRowByIndex(CONFIG.SHEETS.ADJUNTOS, result.rowIndex);
    return ok(null, 'Adjunto eliminado.');
  } catch (e) {
    logErr('deleteAdjunto', e);
    return fail(e.message);
  }
}
