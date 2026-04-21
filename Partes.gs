/**
 * CRUD de Partes de Guardia.
 * Todas las funciones de escritura reciben el token de sesión como primer parámetro.
 */

// ── Mapper fila → objeto ───────────────────────────────────────────────────

function rowToParte(row) {
  var profesionalesList = parseListValue(row[COLS.PARTES.PROFESIONALES]);
  var areasList = parseListValue(row[COLS.PARTES.AREAS_IMPLICADAS]);
  return {
    id:                  row[COLS.PARTES.ID],
    fechaInicio:         toISO(row[COLS.PARTES.FECHA_INICIO]),
    fechaFin:            toISO(row[COLS.PARTES.FECHA_FIN]),
    tipoPeriodo:         row[COLS.PARTES.TIPO_PERIODO],
    profesionales:       profesionalesList.join(', '),
    profesionalesLista:  profesionalesList,
    areasImplicadas:     areasList.join(', '),
    areasImplicadasLista: areasList,
    creadoPor:           row[COLS.PARTES.CREADO_POR],
    fechaCreacion:       toISO(row[COLS.PARTES.FECHA_CREACION]),
    ultimaModificacion:  toISO(row[COLS.PARTES.ULTIMA_MODIFICACION]),
    modificadoPor:       row[COLS.PARTES.MODIFICADO_POR],
    estado:              row[COLS.PARTES.ESTADO],
    observaciones:       row[COLS.PARTES.OBSERVACIONES]
  };
}

function normalizarAreasParte(input) {
  var areas = uniqueCaseInsensitive(parseListValue(input));
  var c = getCatalogos();
  if (c && c.success && c.data && c.data.Area && c.data.Area.length) {
    var catalogo = c.data.Area;
    areas.forEach(function(nombre) {
      if (catalogo.indexOf(nombre) === -1) {
        throw new Error('Área implicada no válida: ' + nombre);
      }
    });
  }
  return stringifyListValue(areas);
}

function validateFromCatalogOrFallback(tipoCatalogo, valor, fallback) {
  if (!valor) return fallback || '';
  var c = getCatalogos();
  if (c && c.success && c.data && c.data[tipoCatalogo] && c.data[tipoCatalogo].length) {
    if (c.data[tipoCatalogo].indexOf(valor) === -1) {
      throw new Error('Valor no válido para "' + tipoCatalogo + '": ' + valor);
    }
    return valor;
  }
  return valor;
}

function normalizarProfesionalesParte(input) {
  var profesionales = uniqueCaseInsensitive(parseListValue(input));
  var c = getCatalogos();
  if (c && c.success && c.data && c.data.ProfesionalGuardia && c.data.ProfesionalGuardia.length) {
    var catalogo = c.data.ProfesionalGuardia;
    profesionales.forEach(function(nombre) {
      if (catalogo.indexOf(nombre) === -1) {
        throw new Error('Profesional de guardia no válido: ' + nombre);
      }
    });
  }
  return stringifyListValue(profesionales);
}

// ── Crear ──────────────────────────────────────────────────────────────────

function createParte(token, data) {
  try {
    var user = requireEditPermission(token);
    requireField(data.fechaInicio,  'Fecha de inicio');
    requireField(data.fechaFin,     'Fecha de fin');
    requireField(data.tipoPeriodo,  'Tipo de periodo');

    if (new Date(data.fechaInicio) >= new Date(data.fechaFin)) {
      throw new Error('La fecha de fin debe ser posterior a la de inicio.');
    }

    var tipoPeriodo = validateFromCatalogOrFallback('TipoPeriodo', data.tipoPeriodo);
    var estado = validateFromCatalogOrFallback('EstadoParte', data.estado || CONFIG.ESTADOS_PARTE.BORRADOR, CONFIG.ESTADOS_PARTE.BORRADOR);
    var profesionales = normalizarProfesionalesParte(data.profesionales || data.profesionalesLista || []);
    var areasImplicadas = normalizarAreasParte(data.areasImplicadas || data.areasImplicadasLista || []);

    var id  = generateId('PG');
    var now = new Date();
    appendRow(CONFIG.SHEETS.PARTES, [
      id,
      new Date(data.fechaInicio),
      new Date(data.fechaFin),
      tipoPeriodo,
      profesionales,
      areasImplicadas,
      user.email, now, now, user.email,
      estado,
      data.observaciones || ''
    ]);
    return ok({ id: id }, 'Parte creado correctamente.');
  } catch (e) {
    logErr('createParte', e);
    return fail(e.message);
  }
}

// ── Leer (sin autenticación requerida — datos internos no sensibles) ───────

function getParte(id) {
  try {
    var result = findRow(CONFIG.SHEETS.PARTES, COLS.PARTES.ID, id);
    if (!result) return fail('Parte no encontrado: ' + id);
    return ok(rowToParte(result.row));
  } catch (e) {
    logErr('getParte', e);
    return fail(e.message);
  }
}

function listPartes(limit) {
  try {
    var data = getAllRaw(CONFIG.SHEETS.PARTES);
    if (data.length <= 1) return ok([]);
    var partes = data.slice(1)
      .filter(function(r) { return !!r[COLS.PARTES.ID]; })
      .map(rowToParte);
    partes.sort(function(a, b) {
      return new Date(b.fechaCreacion) - new Date(a.fechaCreacion);
    });
    if (limit) partes = partes.slice(0, limit);
    return ok(partes);
  } catch (e) {
    logErr('listPartes', e);
    return fail(e.message);
  }
}

/**
 * Como listPartes pero añade numIncidencias a cada parte.
 * Usa una sola pasada por la hoja de incidencias para evitar N llamadas.
 */
function listPartesConConteo(limit) {
  try {
    var partesRaw = getAllRaw(CONFIG.SHEETS.PARTES);
    if (partesRaw.length <= 1) return ok([]);

    var partes = partesRaw.slice(1)
      .filter(function(r) { return !!r[COLS.PARTES.ID]; })
      .map(rowToParte);

    // Contar incidencias por parte en una sola lectura
    var incRaw = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
    var conteo = {};
    for (var i = 1; i < incRaw.length; i++) {
      var pid = incRaw[i][COLS.INCIDENCIAS.ID_PARTE];
      if (pid) conteo[pid] = (conteo[pid] || 0) + 1;
    }

    partes.forEach(function(p) { p.numIncidencias = conteo[p.id] || 0; });
    partes.sort(function(a, b) { return new Date(b.fechaCreacion) - new Date(a.fechaCreacion); });
    if (limit) partes = partes.slice(0, limit);
    return ok(partes);
  } catch (e) {
    logErr('listPartesConConteo', e);
    return fail(e.message);
  }
}

function getParteConIncidencias(id) {
  try {
    var p = getParte(id);
    if (!p.success) return p;
    var inc = listIncidenciasByParte(id);
    var adj = getAdjuntosByParte(id);
    return ok({
      parte:       p.data,
      incidencias: inc.success ? inc.data : [],
      adjuntos:    adj.success ? adj.data : []
    });
  } catch (e) {
    logErr('getParteConIncidencias', e);
    return fail(e.message);
  }
}

// ── Actualizar ─────────────────────────────────────────────────────────────

function updateParte(token, id, data) {
  try {
    var user   = requireEditPermission(token);
    var result = findRow(CONFIG.SHEETS.PARTES, COLS.PARTES.ID, id);
    if (!result) throw new Error('Parte no encontrado.');

    if (result.row[COLS.PARTES.ESTADO] === CONFIG.ESTADOS_PARTE.CERRADO &&
        user.rol !== CONFIG.ROLES.ADMIN) {
      throw new Error('El parte está cerrado. Solo un administrador puede modificarlo.');
    }

    var row = result.row.slice();
    if (data.fechaInicio  !== undefined) row[COLS.PARTES.FECHA_INICIO]  = new Date(data.fechaInicio);
    if (data.fechaFin     !== undefined) row[COLS.PARTES.FECHA_FIN]     = new Date(data.fechaFin);
    if (data.tipoPeriodo  !== undefined) {
      row[COLS.PARTES.TIPO_PERIODO] = validateFromCatalogOrFallback('TipoPeriodo', data.tipoPeriodo);
    }
    if (data.profesionales!== undefined || data.profesionalesLista !== undefined) {
      row[COLS.PARTES.PROFESIONALES] = normalizarProfesionalesParte(
        data.profesionalesLista !== undefined ? data.profesionalesLista : data.profesionales
      );
    }
    if (data.areasImplicadas !== undefined || data.areasImplicadasLista !== undefined) {
      row[COLS.PARTES.AREAS_IMPLICADAS] = normalizarAreasParte(
        data.areasImplicadasLista !== undefined ? data.areasImplicadasLista : data.areasImplicadas
      );
    }
    if (data.observaciones!== undefined) row[COLS.PARTES.OBSERVACIONES] = data.observaciones;
    if (data.estado       !== undefined) {
      row[COLS.PARTES.ESTADO] = validateFromCatalogOrFallback('EstadoParte', data.estado);
    }

    row[COLS.PARTES.ULTIMA_MODIFICACION] = new Date();
    row[COLS.PARTES.MODIFICADO_POR]      = user.email;

    updateRow(CONFIG.SHEETS.PARTES, result.rowIndex, row);
    return ok({ id: id }, 'Parte actualizado.');
  } catch (e) {
    logErr('updateParte', e);
    return fail(e.message);
  }
}

function closeParte(token, id) {
  return updateParte(token, id, { estado: CONFIG.ESTADOS_PARTE.CERRADO });
}

function reopenParte(token, id) {
  try {
    requireAdminPermission(token);
    return updateParte(token, id, { estado: CONFIG.ESTADOS_PARTE.BORRADOR });
  } catch (e) {
    logErr('reopenParte', e);
    return fail(e.message);
  }
}

// ── Duplicar ───────────────────────────────────────────────────────────────

function duplicateParte(token, id) {
  try {
    requireEditPermission(token);
    var p = getParte(id);
    if (!p.success) return p;
    return createParte(token, {
      fechaInicio:   p.data.fechaInicio,
      fechaFin:      p.data.fechaFin,
      tipoPeriodo:   p.data.tipoPeriodo,
      profesionalesLista: p.data.profesionalesLista,
      areasImplicadasLista: p.data.areasImplicadasLista,
      observaciones: '[Duplicado de ' + id + '] ' + (p.data.observaciones || '')
    });
  } catch (e) {
    logErr('duplicateParte', e);
    return fail(e.message);
  }
}

// ── Eliminar ───────────────────────────────────────────────────────────────

/**
 * Elimina un parte y todos sus datos (incidencias + adjuntos). Solo admin.
 * Los archivos de Drive se mueven a la papelera.
 */
function deleteParte(token, id) {
  try {
    requireAdminPermission(token);
    var parteResult = findRow(CONFIG.SHEETS.PARTES, COLS.PARTES.ID, id);
    if (!parteResult) throw new Error('Parte no encontrado.');

    // 1. Adjuntos del parte — Drive + filas (recorrido inverso)
    var adjData = getAllRaw(CONFIG.SHEETS.ADJUNTOS);
    for (var j = adjData.length - 1; j >= 1; j--) {
      if (adjData[j][COLS.ADJUNTOS.ID_PARTE] === id && adjData[j][COLS.ADJUNTOS.ID]) {
        try { DriveApp.getFileById(adjData[j][COLS.ADJUNTOS.ID_DRIVE]).setTrashed(true); } catch (e) {}
        deleteRowByIndex(CONFIG.SHEETS.ADJUNTOS, j + 1);
      }
    }

    // 2. Incidencias del parte (recorrido inverso)
    var incData = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
    for (var i = incData.length - 1; i >= 1; i--) {
      if (incData[i][COLS.INCIDENCIAS.ID_PARTE] === id && incData[i][COLS.INCIDENCIAS.ID]) {
        deleteRowByIndex(CONFIG.SHEETS.INCIDENCIAS, i + 1);
      }
    }

    // 3. El parte en sí
    deleteRowByIndex(CONFIG.SHEETS.PARTES, parteResult.rowIndex);
    return ok(null, 'Parte y todos sus datos eliminados correctamente.');
  } catch (e) {
    logErr('deleteParte', e);
    return fail(e.message);
  }
}
