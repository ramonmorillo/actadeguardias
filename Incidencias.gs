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

// ── Crear ──────────────────────────────────────────────────────────────────

function createIncidencia(token, data) {
  try {
    var user = requireEditPermission(token);
    requireField(data.idParte,     'Parte asociado');
    requireField(data.descripcion, 'Descripción');
    requireField(data.area,        'Área');
    requireField(data.tipoEntrada, 'Tipo de entrada');

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
      data.area,
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
        row[campos[key]] = (key === 'fechaEvento') ? new Date(data[key]) : data[key];
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
