/**
 * CRUD de Partes de Guardia.
 * Todas las funciones de escritura reciben el token de sesión como primer parámetro.
 */

// ── Mapper fila → objeto ───────────────────────────────────────────────────

function getPartesSchema() {
  var headers = getHeaders(CONFIG.SHEETS.PARTES);
  var map = buildHeaderMap(headers);

  var hasAreasCol = map['areasimplicadas'] !== undefined;
  var shiftIfLegacy = hasAreasCol ? 0 : -1; // histórico sin AreasImplicadas

  var findIdx = function(posibles, fallback) {
    for (var i = 0; i < posibles.length; i++) {
      var key = normalizeHeaderKey(posibles[i]);
      if (map[key] !== undefined) return map[key];
    }
    return fallback;
  };

  return {
    ID: findIdx(['id'], COLS.PARTES.ID),
    FECHA_INICIO: findIdx(['fechainicio'], COLS.PARTES.FECHA_INICIO),
    FECHA_FIN: findIdx(['fechafin'], COLS.PARTES.FECHA_FIN),
    TIPO_PERIODO: findIdx(['tipoperiodo'], COLS.PARTES.TIPO_PERIODO),
    PROFESIONALES: findIdx(['profesionales'], COLS.PARTES.PROFESIONALES),
    AREAS_IMPLICADAS: findIdx(['areasimplicadas'], hasAreasCol ? COLS.PARTES.AREAS_IMPLICADAS : -1),
    CREADO_POR: findIdx(['creadopor'], COLS.PARTES.CREADO_POR + shiftIfLegacy),
    FECHA_CREACION: findIdx(['fechacreacion'], COLS.PARTES.FECHA_CREACION + shiftIfLegacy),
    ULTIMA_MODIFICACION: findIdx(['ultimamodificacion'], COLS.PARTES.ULTIMA_MODIFICACION + shiftIfLegacy),
    MODIFICADO_POR: findIdx(['modificadopor'], COLS.PARTES.MODIFICADO_POR + shiftIfLegacy),
    ESTADO: findIdx(['estado'], COLS.PARTES.ESTADO + shiftIfLegacy),
    OBSERVACIONES: findIdx(['observaciones'], COLS.PARTES.OBSERVACIONES + shiftIfLegacy)
  };
}

function ensureAreasImplicadasColumn() {
  var schema = getPartesSchema();
  if (schema.AREAS_IMPLICADAS >= 0) return schema;

  var sheet = getSheet(CONFIG.SHEETS.PARTES);
  var insertAfter = schema.PROFESIONALES >= 0 ? schema.PROFESIONALES + 1 : 5;
  sheet.insertColumnAfter(insertAfter);
  sheet.getRange(1, insertAfter + 1).setValue('AreasImplicadas');
  return getPartesSchema();
}

function rowToParte(row, opts) {
  opts = opts || {};
  var schema = opts.schema || getPartesSchema();
  var areasCatalogo = opts.areasCatalogo || CONFIG.AREAS;
  var profesionalesList = parseListValue(rowVal(row, schema.PROFESIONALES));
  var areasList = schema.AREAS_IMPLICADAS >= 0 ? parseListValue(rowVal(row, schema.AREAS_IMPLICADAS)) : [];
  var normalizadas = normalizarSeparacionProfesionalesYAreas(profesionalesList, areasList, areasCatalogo);
  return {
    id:                  normalizeIdKey(rowVal(row, schema.ID)),
    fechaInicio:         toISO(rowVal(row, schema.FECHA_INICIO)),
    fechaFin:            toISO(rowVal(row, schema.FECHA_FIN)),
    tipoPeriodo:         rowVal(row, schema.TIPO_PERIODO),
    profesionales:       normalizadas.profesionales.join(', '),
    profesionalesLista:  normalizadas.profesionales,
    areasImplicadas:     normalizadas.areas.join(', '),
    areasImplicadasLista: normalizadas.areas,
    creadoPor:           rowVal(row, schema.CREADO_POR),
    fechaCreacion:       toISO(rowVal(row, schema.FECHA_CREACION)),
    ultimaModificacion:  toISO(rowVal(row, schema.ULTIMA_MODIFICACION)),
    modificadoPor:       rowVal(row, schema.MODIFICADO_POR),
    estado:              rowVal(row, schema.ESTADO),
    observaciones:       rowVal(row, schema.OBSERVACIONES)
  };
}

/**
 * Corrige histórico donde el campo Profesionales incluía áreas.
 * Si un valor coincide con el catálogo de áreas, se mueve a areas.
 */
function normalizarSeparacionProfesionalesYAreas(profesionalesList, areasList, areasCatalogoArg) {
  var profesionales = uniqueCaseInsensitive(parseListValue(profesionalesList));
  var areas = uniqueCaseInsensitive(parseListValue(areasList));
  var areasCatalogo = areasCatalogoArg || CONFIG.AREAS;
  if (!areasCatalogoArg) {
    var c = getCatalogos();
    areasCatalogo = (c && c.success && c.data && c.data.Area) ? c.data.Area : CONFIG.AREAS;
  }

  var profesionalesFiltrados = [];
  profesionales.forEach(function(v) {
    if (areasCatalogo.indexOf(v) !== -1) {
      if (areas.indexOf(v) === -1) areas.push(v);
      return;
    }
    profesionalesFiltrados.push(v);
  });

  return {
    profesionales: uniqueCaseInsensitive(profesionalesFiltrados),
    areas: uniqueCaseInsensitive(areas)
  };
}

function normalizarAreasParte(input, areasCatalogoArg) {
  var areas = uniqueCaseInsensitive(parseListValue(input));
  var catalogo = areasCatalogoArg;
  if (!catalogo) {
    var c = getCatalogos();
    catalogo = (c && c.success && c.data && c.data.Area && c.data.Area.length) ? c.data.Area : null;
  }
  if (catalogo && catalogo.length) {
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

function normalizarProfesionalesParte(input, profesionalesCatalogoArg) {
  var profesionales = uniqueCaseInsensitive(parseListValue(input));
  var catalogo = profesionalesCatalogoArg;
  if (!catalogo) {
    var c = getCatalogos();
    catalogo = (c && c.success && c.data && c.data.ProfesionalGuardia && c.data.ProfesionalGuardia.length)
      ? c.data.ProfesionalGuardia
      : null;
  }
  if (catalogo && catalogo.length) {
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

    var schema = ensureAreasImplicadasColumn();
    var c = getCatalogos();
    var areasCatalogo = (c && c.success && c.data && c.data.Area) ? c.data.Area : CONFIG.AREAS;
    var profesionalesCatalogo = (c && c.success && c.data && c.data.ProfesionalGuardia) ? c.data.ProfesionalGuardia : [];
    var tipoPeriodo = validateFromCatalogOrFallback('TipoPeriodo', data.tipoPeriodo);
    var estado = validateFromCatalogOrFallback('EstadoParte', data.estado || CONFIG.ESTADOS_PARTE.BORRADOR, CONFIG.ESTADOS_PARTE.BORRADOR);
    var profesionalesLista = parseListValue(data.profesionales || data.profesionalesLista || []);
    var areasImplicadasLista = parseListValue(data.areasImplicadas || data.areasImplicadasLista || []);
    var normalizadas = normalizarSeparacionProfesionalesYAreas(profesionalesLista, areasImplicadasLista, areasCatalogo);
    var profesionales = normalizarProfesionalesParte(normalizadas.profesionales, profesionalesCatalogo);
    var areasImplicadas = normalizarAreasParte(normalizadas.areas, areasCatalogo);

    var id  = generateId('PG');
    var now = new Date();
    var row = [];
    row[schema.ID] = id;
    row[schema.FECHA_INICIO] = new Date(data.fechaInicio);
    row[schema.FECHA_FIN] = new Date(data.fechaFin);
    row[schema.TIPO_PERIODO] = tipoPeriodo;
    row[schema.PROFESIONALES] = profesionales;
    row[schema.AREAS_IMPLICADAS] = areasImplicadas;
    row[schema.CREADO_POR] = user.email;
    row[schema.FECHA_CREACION] = now;
    row[schema.ULTIMA_MODIFICACION] = now;
    row[schema.MODIFICADO_POR] = user.email;
    row[schema.ESTADO] = estado;
    row[schema.OBSERVACIONES] = data.observaciones || '';
    appendRow(CONFIG.SHEETS.PARTES, row);
    return ok({ id: id }, 'Parte creado correctamente.');
  } catch (e) {
    logErr('createParte', e);
    return fail(e.message);
  }
}

// ── Leer (sin autenticación requerida — datos internos no sensibles) ───────

function getParte(id) {
  try {
    var schema = getPartesSchema();
    var result = findRow(CONFIG.SHEETS.PARTES, schema.ID, normalizeIdKey(id));
    if (!result) return fail('Parte no encontrado: ' + id);
    var c = getCatalogos();
    var areasCatalogo = (c && c.success && c.data && c.data.Area) ? c.data.Area : CONFIG.AREAS;
    return ok(rowToParte(result.row, { schema: schema, areasCatalogo: areasCatalogo }));
  } catch (e) {
    logErr('getParte', e);
    return fail(e.message);
  }
}

function listPartes(limit) {
  try {
    var schema = getPartesSchema();
    var data = getAllRaw(CONFIG.SHEETS.PARTES);
    if (data.length <= 1) return ok([]);
    var c = getCatalogos();
    var areasCatalogo = (c && c.success && c.data && c.data.Area) ? c.data.Area : CONFIG.AREAS;
    var partes = data.slice(1)
      .filter(function(r) { return !!normalizeIdKey(rowVal(r, schema.ID)); })
      .map(function(row) { return rowToParte(row, { schema: schema, areasCatalogo: areasCatalogo }); });
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
    var schema = getPartesSchema();
    var partesRaw = getAllRaw(CONFIG.SHEETS.PARTES);
    if (partesRaw.length <= 1) return ok([]);
    var c = getCatalogos();
    var areasCatalogo = (c && c.success && c.data && c.data.Area) ? c.data.Area : CONFIG.AREAS;

    var partes = partesRaw.slice(1)
      .filter(function(r) { return !!normalizeIdKey(rowVal(r, schema.ID)); })
      .map(function(row) {
        try {
          return rowToParte(row, { schema: schema, areasCatalogo: areasCatalogo });
        } catch (eRow) {
          return {
            id: normalizeIdKey(rowVal(row, schema.ID)),
            fechaInicio: toISO(rowVal(row, schema.FECHA_INICIO)),
            fechaFin: toISO(rowVal(row, schema.FECHA_FIN)),
            tipoPeriodo: rowVal(row, schema.TIPO_PERIODO),
            profesionales: displayListValue(rowVal(row, schema.PROFESIONALES)),
            profesionalesLista: parseListValue(rowVal(row, schema.PROFESIONALES)),
            areasImplicadas: displayListValue(rowVal(row, schema.AREAS_IMPLICADAS)),
            areasImplicadasLista: parseListValue(rowVal(row, schema.AREAS_IMPLICADAS)),
            creadoPor: rowVal(row, schema.CREADO_POR),
            fechaCreacion: toISO(rowVal(row, schema.FECHA_CREACION)),
            ultimaModificacion: toISO(rowVal(row, schema.ULTIMA_MODIFICACION)),
            modificadoPor: rowVal(row, schema.MODIFICADO_POR),
            estado: rowVal(row, schema.ESTADO),
            observaciones: rowVal(row, schema.OBSERVACIONES)
          };
        }
      });

    // Contar incidencias por parte en una sola lectura
    var incSchema = getIncidenciasSchema();
    var incRaw = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
    var conteo = {};
    for (var i = 1; i < incRaw.length; i++) {
      var rowInc = incRaw[i] || [];
      var pid = normalizeIdKey(rowVal(rowInc, incSchema.ID_PARTE));
      var incId = normalizeIdKey(rowVal(rowInc, incSchema.ID));
      if (!incId) continue;
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
    var schema = ensureAreasImplicadasColumn();
    var result = findRow(CONFIG.SHEETS.PARTES, schema.ID, normalizeIdKey(id));
    if (!result) throw new Error('Parte no encontrado.');
    var c = getCatalogos();
    var areasCatalogo = (c && c.success && c.data && c.data.Area) ? c.data.Area : CONFIG.AREAS;
    var profesionalesCatalogo = (c && c.success && c.data && c.data.ProfesionalGuardia) ? c.data.ProfesionalGuardia : [];

    if (rowVal(result.row, schema.ESTADO) === CONFIG.ESTADOS_PARTE.CERRADO &&
        user.rol !== CONFIG.ROLES.ADMIN) {
      throw new Error('El parte está cerrado. Solo un administrador puede modificarlo.');
    }

    var row = result.row.slice();
    if (data.fechaInicio  !== undefined) row[schema.FECHA_INICIO]  = new Date(data.fechaInicio);
    if (data.fechaFin     !== undefined) row[schema.FECHA_FIN]     = new Date(data.fechaFin);
    if (data.tipoPeriodo  !== undefined) {
      row[schema.TIPO_PERIODO] = validateFromCatalogOrFallback('TipoPeriodo', data.tipoPeriodo);
    }
    if (data.profesionales!== undefined || data.profesionalesLista !== undefined ||
        data.areasImplicadas !== undefined || data.areasImplicadasLista !== undefined) {
      var profInput = data.profesionalesLista !== undefined
        ? data.profesionalesLista
        : (data.profesionales !== undefined ? data.profesionales : row[schema.PROFESIONALES]);
      var areasInput = data.areasImplicadasLista !== undefined
        ? data.areasImplicadasLista
        : (data.areasImplicadas !== undefined ? data.areasImplicadas : row[schema.AREAS_IMPLICADAS]);
      var normalizadasUpdate = normalizarSeparacionProfesionalesYAreas(profInput, areasInput, areasCatalogo);
      row[schema.PROFESIONALES] = normalizarProfesionalesParte(normalizadasUpdate.profesionales, profesionalesCatalogo);
      row[schema.AREAS_IMPLICADAS] = normalizarAreasParte(normalizadasUpdate.areas, areasCatalogo);
    }
    if (data.observaciones!== undefined) row[schema.OBSERVACIONES] = data.observaciones;
    if (data.estado       !== undefined) {
      row[schema.ESTADO] = validateFromCatalogOrFallback('EstadoParte', data.estado);
    }

    row[schema.ULTIMA_MODIFICACION] = new Date();
    row[schema.MODIFICADO_POR]      = user.email;

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
    var schema = getPartesSchema();
    var schemaAdj = getAdjuntosSchema();
    var schemaInc = getIncidenciasSchema();
    var parteId = normalizeIdKey(id);
    var parteResult = findRow(CONFIG.SHEETS.PARTES, schema.ID, parteId);
    if (!parteResult) throw new Error('Parte no encontrado.');

    // 1. Adjuntos del parte — Drive + filas (recorrido inverso)
    var adjData = getAllRaw(CONFIG.SHEETS.ADJUNTOS);
    for (var j = adjData.length - 1; j >= 1; j--) {
      if (normalizeIdKey(rowVal(adjData[j], schemaAdj.ID_PARTE)) === parteId && rowVal(adjData[j], schemaAdj.ID)) {
        try { DriveApp.getFileById(rowVal(adjData[j], schemaAdj.ID_DRIVE)).setTrashed(true); } catch (e) {}
        deleteRowByIndex(CONFIG.SHEETS.ADJUNTOS, j + 1);
      }
    }

    // 2. Incidencias del parte (recorrido inverso)
    var incData = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
    for (var i = incData.length - 1; i >= 1; i--) {
      if (normalizeIdKey(rowVal(incData[i], schemaInc.ID_PARTE)) === parteId && rowVal(incData[i], schemaInc.ID)) {
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
