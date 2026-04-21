/**
 * CRUD de Incidencias dentro de un Parte de Guardia.
 * Todas las funciones de escritura reciben el token de sesión como primer parámetro.
 */

// ── Mapper fila → objeto ───────────────────────────────────────────────────

function getIncidenciasSchema() {
  var raw = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
  var headers = (raw && raw.length) ? raw[0] : [];
  var map = {};
  headers.forEach(function(h, i) {
    var key = (h || '').toString().toLowerCase().replace(/[\s_]+/g, '');
    map[key] = i;
  });

  var findIdx = function(posibles, fallback) {
    for (var i = 0; i < posibles.length; i++) {
      if (map[posibles[i]] !== undefined) return map[posibles[i]];
    }
    return fallback;
  };

  return {
    ID: findIdx(['id'], COLS.INCIDENCIAS.ID),
    ID_PARTE: findIdx(['idparte', 'id_parte'], COLS.INCIDENCIAS.ID_PARTE),
    FECHA_EVENTO: findIdx(['fechaevento'], COLS.INCIDENCIAS.FECHA_EVENTO),
    AREA: findIdx(['area'], COLS.INCIDENCIAS.AREA),
    TIPO_ENTRADA: findIdx(['tipoentrada'], COLS.INCIDENCIAS.TIPO_ENTRADA),
    DESCRIPCION: findIdx(['descripcion'], COLS.INCIDENCIAS.DESCRIPCION),
    ACTUACION: findIdx(['actuacion'], COLS.INCIDENCIAS.ACTUACION),
    MEDICAMENTOS: findIdx(['medicamentos'], COLS.INCIDENCIAS.MEDICAMENTOS),
    SERVICIO: findIdx(['servicioubicacion', 'servicio'], COLS.INCIDENCIAS.SERVICIO),
    PRIORIDAD: findIdx(['prioridad'], COLS.INCIDENCIAS.PRIORIDAD),
    ETIQUETAS: findIdx(['etiquetas'], COLS.INCIDENCIAS.ETIQUETAS),
    REGISTRADO_POR: findIdx(['registradopor'], COLS.INCIDENCIAS.REGISTRADO_POR),
    FECHA_REGISTRO: findIdx(['fecharegistro'], COLS.INCIDENCIAS.FECHA_REGISTRO),
    FECHA_MODIFICACION: findIdx(['fechamodificacion'], COLS.INCIDENCIAS.FECHA_MODIFICACION),
    MODIFICADO_POR: findIdx(['modificadopor'], COLS.INCIDENCIAS.MODIFICADO_POR),
    ESTADO: findIdx(['estado'], COLS.INCIDENCIAS.ESTADO),
    SEGUIMIENTO: findIdx(['seguimiento'], COLS.INCIDENCIAS.SEGUIMIENTO),
    TIENE_ADJUNTOS: findIdx(['tieneadjuntos'], COLS.INCIDENCIAS.TIENE_ADJUNTOS)
  };
}

function rowToIncidencia(row, schemaArg) {
  var schema = schemaArg || getIncidenciasSchema();
  return {
    id:               rowVal(row, schema.ID),
    idParte:          rowVal(row, schema.ID_PARTE),
    fechaEvento:      toISO(rowVal(row, schema.FECHA_EVENTO)),
    area:             rowVal(row, schema.AREA),
    tipoEntrada:      rowVal(row, schema.TIPO_ENTRADA),
    descripcion:      rowVal(row, schema.DESCRIPCION),
    actuacion:        rowVal(row, schema.ACTUACION),
    medicamentos:     rowVal(row, schema.MEDICAMENTOS),
    servicio:         rowVal(row, schema.SERVICIO),
    prioridad:        rowVal(row, schema.PRIORIDAD),
    etiquetas:        rowVal(row, schema.ETIQUETAS),
    registradoPor:    rowVal(row, schema.REGISTRADO_POR),
    fechaRegistro:    toISO(rowVal(row, schema.FECHA_REGISTRO)),
    fechaModificacion:toISO(rowVal(row, schema.FECHA_MODIFICACION)),
    modificadoPor:    rowVal(row, schema.MODIFICADO_POR),
    estado:           rowVal(row, schema.ESTADO),
    seguimiento:      rowVal(row, schema.SEGUIMIENTO),
    tieneAdjuntos:    !!rowVal(row, schema.TIENE_ADJUNTOS)
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
    var idParte = normalizeIdKey(requireField(data.idParte, 'Parte asociado'));
    requireField(data.descripcion, 'Descripción');
    requireField(data.area,        'Área');
    requireField(data.tipoEntrada, 'Tipo de entrada');
    var areaValidada = validateAreaIncidencia(data.area);
    var schemaPartes = getPartesSchema();
    var partesRaw = getAllRaw(CONFIG.SHEETS.PARTES);
    var parte = null;
    for (var p = 1; p < partesRaw.length; p++) {
      if (normalizeIdKey(rowVal(partesRaw[p], schemaPartes.ID)) === idParte) {
        parte = { row: partesRaw[p] };
        break;
      }
    }
    if (!parte) throw new Error('Parte no encontrado: ' + idParte);
    if (rowVal(parte.row, schemaPartes.ESTADO) === CONFIG.ESTADOS_PARTE.CERRADO &&
        user.rol !== CONFIG.ROLES.ADMIN) {
      throw new Error('El parte está cerrado. Solo un administrador puede añadir incidencias.');
    }

    var warnings = checkSensitiveData([
      { name: 'Descripción', value: data.descripcion },
      { name: 'Actuación',   value: data.actuacion || '' },
      { name: 'Seguimiento', value: data.seguimiento || '' }
    ]);

    var id  = generateId('INC');
    var now = new Date();

    var schemaInc = getIncidenciasSchema();
    var row = [];
    row[schemaInc.ID] = id;
    row[schemaInc.ID_PARTE] = idParte;
    row[schemaInc.FECHA_EVENTO] = data.fechaEvento ? new Date(data.fechaEvento) : now;
    row[schemaInc.AREA] = areaValidada;
    row[schemaInc.TIPO_ENTRADA] = data.tipoEntrada;
    row[schemaInc.DESCRIPCION] = data.descripcion;
    row[schemaInc.ACTUACION] = data.actuacion || '';
    row[schemaInc.MEDICAMENTOS] = data.medicamentos || '';
    row[schemaInc.SERVICIO] = data.servicio || '';
    row[schemaInc.PRIORIDAD] = data.prioridad || 'media';
    row[schemaInc.ETIQUETAS] = data.etiquetas || '';
    row[schemaInc.REGISTRADO_POR] = user.email;
    row[schemaInc.FECHA_REGISTRO] = now;
    row[schemaInc.FECHA_MODIFICACION] = now;
    row[schemaInc.MODIFICADO_POR] = user.email;
    row[schemaInc.ESTADO] = data.estado || CONFIG.ESTADOS_INCIDENCIA.ABIERTA;
    row[schemaInc.SEGUIMIENTO] = data.seguimiento || '';
    row[schemaInc.TIENE_ADJUNTOS] = false;
    appendRow(CONFIG.SHEETS.INCIDENCIAS, row);

    return ok({ id: id, warnings: warnings }, 'Incidencia registrada.');
  } catch (e) {
    logErr('createIncidencia', e);
    return fail(e.message);
  }
}

// ── Leer ───────────────────────────────────────────────────────────────────

function getIncidencia(id) {
  try {
    var schema = getIncidenciasSchema();
    var data = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
    var key = normalizeIdKey(id);
    for (var i = 1; i < data.length; i++) {
      if (normalizeIdKey(rowVal(data[i], schema.ID)) === key) {
        return ok(rowToIncidencia(data[i], schema));
      }
    }
    return fail('Incidencia no encontrada: ' + id);
  } catch (e) {
    logErr('getIncidencia', e);
    return fail(e.message);
  }
}

function listIncidenciasByParte(parteId) {
  try {
    var schema = getIncidenciasSchema();
    var parteKey = normalizeIdKey(parteId);
    var data = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
    if (data.length <= 1) return ok([]);
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (normalizeIdKey(rowVal(data[i], schema.ID_PARTE)) === parteKey &&
          normalizeIdKey(rowVal(data[i], schema.ID))) {
        list.push(rowToIncidencia(data[i], schema));
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
