/**
 * CRUD de Incidencias dentro de un Parte de Guardia.
 * Todas las funciones de escritura reciben el token de sesión como primer parámetro.
 */

// ── Mapper fila → objeto ───────────────────────────────────────────────────

function rowToIncidencia(row) {
  return {
    id:               row[COLS.INCIDENCIAS.ID],
    idParte:          row[COLS.INCIDENCIAS.ID_PARTE],
    fechaEvento:      toISO(row[COLS.INCIDENCIAS.FECHA_EVENTO]),
    area:             row[COLS.INCIDENCIAS.AREA],
    tipoEntrada:      row[COLS.INCIDENCIAS.TIPO_ENTRADA],
    descripcion:      row[COLS.INCIDENCIAS.DESCRIPCION],
    actuacion:        row[COLS.INCIDENCIAS.ACTUACION],
    medicamentos:     row[COLS.INCIDENCIAS.MEDICAMENTOS],
    servicio:         row[COLS.INCIDENCIAS.SERVICIO],
    prioridad:        row[COLS.INCIDENCIAS.PRIORIDAD],
    etiquetas:        row[COLS.INCIDENCIAS.ETIQUETAS],
    registradoPor:    row[COLS.INCIDENCIAS.REGISTRADO_POR],
    fechaRegistro:    toISO(row[COLS.INCIDENCIAS.FECHA_REGISTRO]),
    fechaModificacion:toISO(row[COLS.INCIDENCIAS.FECHA_MODIFICACION]),
    modificadoPor:    row[COLS.INCIDENCIAS.MODIFICADO_POR],
    estado:           row[COLS.INCIDENCIAS.ESTADO],
    seguimiento:      row[COLS.INCIDENCIAS.SEGUIMIENTO],
    tieneAdjuntos:    !!row[COLS.INCIDENCIAS.TIENE_ADJUNTOS]
  };
}

function validateAreaIncidencia(area) {
  requireField(area, 'Área');
  var c = getCatalogos();
  if (c && c.success && c.data && c.data.Area && c.data.Area.length) {
    if (c.data.Area.indexOf(area) === -1) {
      throw new Error('Área no válida: ' + area);
    }
  }
  return area;
}

// ── Crear ──────────────────────────────────────────────────────────────────

function createIncidencia(token, data) {
  try {
    var user = requireEditPermission(token);
    requireField(data.idParte,     'Parte asociado');
    requireField(data.descripcion, 'Descripción');
    requireField(data.area,        'Área');
    requireField(data.tipoEntrada, 'Tipo de entrada');
    var areaValidada = validateAreaIncidencia(data.area);

    var warnings = checkSensitiveData([
      { name: 'Descripción', value: data.descripcion },
      { name: 'Actuación',   value: data.actuacion || '' },
      { name: 'Seguimiento', value: data.seguimiento || '' }
    ]);

    var id  = generateId('INC');
    var now = new Date();

    appendRow(CONFIG.SHEETS.INCIDENCIAS, [
      id,
      data.idParte,
      data.fechaEvento ? new Date(data.fechaEvento) : now,
      areaValidada,
      data.tipoEntrada,
      data.descripcion,
      data.actuacion    || '',
      data.medicamentos || '',
      data.servicio     || '',
      data.prioridad    || 'media',
      data.etiquetas    || '',
      user.email, now, now, user.email,
      data.estado       || CONFIG.ESTADOS_INCIDENCIA.ABIERTA,
      data.seguimiento  || '',
      false
    ]);

    return ok({ id: id, warnings: warnings }, 'Incidencia registrada.');
  } catch (e) {
    logErr('createIncidencia', e);
    return fail(e.message);
  }
}

// ── Leer ───────────────────────────────────────────────────────────────────

function getIncidencia(id) {
  try {
    var result = findRow(CONFIG.SHEETS.INCIDENCIAS, COLS.INCIDENCIAS.ID, id);
    if (!result) return fail('Incidencia no encontrada: ' + id);
    return ok(rowToIncidencia(result.row));
  } catch (e) {
    logErr('getIncidencia', e);
    return fail(e.message);
  }
}

function listIncidenciasByParte(parteId) {
  try {
    var data = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
    if (data.length <= 1) return ok([]);
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][COLS.INCIDENCIAS.ID_PARTE] === parteId && data[i][COLS.INCIDENCIAS.ID]) {
        list.push(rowToIncidencia(data[i]));
      }
    }
    list.sort(function(a, b) { return new Date(a.fechaEvento) - new Date(b.fechaEvento); });
    return ok(list);
  } catch (e) {
    logErr('listIncidenciasByParte', e);
    return fail(e.message);
  }
}

// ── Actualizar ─────────────────────────────────────────────────────────────

function updateIncidencia(token, id, data) {
  try {
    var user   = requireEditPermission(token);
    var result = findRow(CONFIG.SHEETS.INCIDENCIAS, COLS.INCIDENCIAS.ID, id);
    if (!result) throw new Error('Incidencia no encontrada.');

    var row    = result.row.slice();
    var campos = {
      fechaEvento:  COLS.INCIDENCIAS.FECHA_EVENTO,
      area:         COLS.INCIDENCIAS.AREA,
      tipoEntrada:  COLS.INCIDENCIAS.TIPO_ENTRADA,
      descripcion:  COLS.INCIDENCIAS.DESCRIPCION,
      actuacion:    COLS.INCIDENCIAS.ACTUACION,
      medicamentos: COLS.INCIDENCIAS.MEDICAMENTOS,
      servicio:     COLS.INCIDENCIAS.SERVICIO,
      prioridad:    COLS.INCIDENCIAS.PRIORIDAD,
      etiquetas:    COLS.INCIDENCIAS.ETIQUETAS,
      estado:       COLS.INCIDENCIAS.ESTADO,
      seguimiento:  COLS.INCIDENCIAS.SEGUIMIENTO
    };

    Object.keys(campos).forEach(function(key) {
      if (data[key] !== undefined) {
        if (key === 'fechaEvento') {
          row[campos[key]] = new Date(data[key]);
        } else if (key === 'area') {
          row[campos[key]] = validateAreaIncidencia(data[key]);
        } else {
          row[campos[key]] = data[key];
        }
      }
    });

    row[COLS.INCIDENCIAS.FECHA_MODIFICACION] = new Date();
    row[COLS.INCIDENCIAS.MODIFICADO_POR]     = user.email;

    updateRow(CONFIG.SHEETS.INCIDENCIAS, result.rowIndex, row);

    var warnings = checkSensitiveData([
      { name: 'Descripción', value: data.descripcion || '' },
      { name: 'Actuación',   value: data.actuacion   || '' }
    ]);

    return ok({ id: id, warnings: warnings }, 'Incidencia actualizada.');
  } catch (e) {
    logErr('updateIncidencia', e);
    return fail(e.message);
  }
}

function updateEstadoIncidencia(token, id, nuevoEstado) {
  return updateIncidencia(token, id, { estado: nuevoEstado });
}

/** Interno: marca tieneAdjuntos = true. Llamado desde Adjuntos.gs. */
function marcarConAdjuntos(incidenciaId) {
  var result = findRow(CONFIG.SHEETS.INCIDENCIAS, COLS.INCIDENCIAS.ID, incidenciaId);
  if (result) {
    setCellValue(CONFIG.SHEETS.INCIDENCIAS, result.rowIndex, COLS.INCIDENCIAS.TIENE_ADJUNTOS, true);
  }
}

// ── Eliminar ───────────────────────────────────────────────────────────────

/**
 * Elimina una incidencia y sus adjuntos asociados (solo admin).
 * Los archivos de Drive se mueven a la papelera.
 */
function deleteIncidencia(token, id) {
  try {
    requireAdminPermission(token);
    var result = findRow(CONFIG.SHEETS.INCIDENCIAS, COLS.INCIDENCIAS.ID, id);
    if (!result) throw new Error('Incidencia no encontrada.');

    // Eliminar adjuntos en Drive y en la hoja (recorrido inverso para evitar desplazamiento de filas)
    var adjData = getAllRaw(CONFIG.SHEETS.ADJUNTOS);
    for (var i = adjData.length - 1; i >= 1; i--) {
      if (adjData[i][COLS.ADJUNTOS.ID_INCIDENCIA] === id && adjData[i][COLS.ADJUNTOS.ID]) {
        try { DriveApp.getFileById(adjData[i][COLS.ADJUNTOS.ID_DRIVE]).setTrashed(true); } catch (e) {}
        deleteRowByIndex(CONFIG.SHEETS.ADJUNTOS, i + 1);
      }
    }

    deleteRowByIndex(CONFIG.SHEETS.INCIDENCIAS, result.rowIndex);
    return ok(null, 'Incidencia eliminada correctamente.');
  } catch (e) {
    logErr('deleteIncidencia', e);
    return fail(e.message);
  }
}
