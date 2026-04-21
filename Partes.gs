/**
 * CRUD de Partes de Guardia.
 */

// ── Mapper fila → objeto ───────────────────────────────────────────────────

function rowToParte(row) {
  return {
    id:                  row[COLS.PARTES.ID],
    fechaInicio:         toISO(row[COLS.PARTES.FECHA_INICIO]),
    fechaFin:            toISO(row[COLS.PARTES.FECHA_FIN]),
    tipoPeriodo:         row[COLS.PARTES.TIPO_PERIODO],
    profesionales:       row[COLS.PARTES.PROFESIONALES],
    creadoPor:           row[COLS.PARTES.CREADO_POR],
    fechaCreacion:       toISO(row[COLS.PARTES.FECHA_CREACION]),
    ultimaModificacion:  toISO(row[COLS.PARTES.ULTIMA_MODIFICACION]),
    modificadoPor:       row[COLS.PARTES.MODIFICADO_POR],
    estado:              row[COLS.PARTES.ESTADO],
    observaciones:       row[COLS.PARTES.OBSERVACIONES]
  };
}

function parteToRow(id, data, email, now) {
  return [
    id,
    data.fechaInicio  ? new Date(data.fechaInicio)  : new Date(),
    data.fechaFin     ? new Date(data.fechaFin)     : new Date(),
    data.tipoPeriodo  || 'Fin de semana',
    data.profesionales || '',
    email, now, now, email,
    data.estado       || CONFIG.ESTADOS_PARTE.BORRADOR,
    data.observaciones || ''
  ];
}

// ── Crear ──────────────────────────────────────────────────────────────────

function createParte(data) {
  try {
    requireEditPermission();
    var email = getCurrentUser();
    requireField(data.fechaInicio,  'Fecha de inicio');
    requireField(data.fechaFin,     'Fecha de fin');
    requireField(data.tipoPeriodo,  'Tipo de periodo');

    if (new Date(data.fechaInicio) >= new Date(data.fechaFin)) {
      throw new Error('La fecha de fin debe ser posterior a la de inicio.');
    }

    var id  = generateId('PG');
    var now = new Date();
    appendRow(CONFIG.SHEETS.PARTES, parteToRow(id, data, email, now));
    return ok({ id: id }, 'Parte creado correctamente.');
  } catch (e) {
    logErr('createParte', e);
    return fail(e.message);
  }
}

// ── Leer ───────────────────────────────────────────────────────────────────

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

function getParteConIncidencias(id) {
  try {
    var p = getParte(id);
    if (!p.success) return p;
    var inc = listIncidenciasByParte(id);
    var adj = getAdjuntosByParte(id);
    return ok({
      parte:      p.data,
      incidencias: inc.success ? inc.data : [],
      adjuntos:   adj.success ? adj.data : []
    });
  } catch (e) {
    logErr('getParteConIncidencias', e);
    return fail(e.message);
  }
}

// ── Actualizar ─────────────────────────────────────────────────────────────

function updateParte(id, data) {
  try {
    requireEditPermission();
    var email  = getCurrentUser();
    var result = findRow(CONFIG.SHEETS.PARTES, COLS.PARTES.ID, id);
    if (!result) throw new Error('Parte no encontrado.');

    if (result.row[COLS.PARTES.ESTADO] === CONFIG.ESTADOS_PARTE.CERRADO && !isAdmin(email)) {
      throw new Error('El parte está cerrado. Solo un administrador puede modificarlo.');
    }

    var row = result.row.slice();
    if (data.fechaInicio  !== undefined) row[COLS.PARTES.FECHA_INICIO]  = new Date(data.fechaInicio);
    if (data.fechaFin     !== undefined) row[COLS.PARTES.FECHA_FIN]     = new Date(data.fechaFin);
    if (data.tipoPeriodo  !== undefined) row[COLS.PARTES.TIPO_PERIODO]  = data.tipoPeriodo;
    if (data.profesionales!== undefined) row[COLS.PARTES.PROFESIONALES] = data.profesionales;
    if (data.observaciones!== undefined) row[COLS.PARTES.OBSERVACIONES] = data.observaciones;
    if (data.estado       !== undefined) row[COLS.PARTES.ESTADO]        = data.estado;

    row[COLS.PARTES.ULTIMA_MODIFICACION] = new Date();
    row[COLS.PARTES.MODIFICADO_POR]      = email;

    updateRow(CONFIG.SHEETS.PARTES, result.rowIndex, row);
    return ok({ id: id }, 'Parte actualizado.');
  } catch (e) {
    logErr('updateParte', e);
    return fail(e.message);
  }
}

function closeParte(id) {
  return updateParte(id, { estado: CONFIG.ESTADOS_PARTE.CERRADO });
}

function reopenParte(id) {
  try {
    if (!isAdmin(getCurrentUser())) throw new Error('Solo administradores pueden reabrir partes.');
    return updateParte(id, { estado: CONFIG.ESTADOS_PARTE.BORRADOR });
  } catch (e) {
    logErr('reopenParte', e);
    return fail(e.message);
  }
}

// ── Duplicar ───────────────────────────────────────────────────────────────

function duplicateParte(id) {
  try {
    requireEditPermission();
    var p = getParte(id);
    if (!p.success) return p;
    return createParte({
      fechaInicio:   p.data.fechaInicio,
      fechaFin:      p.data.fechaFin,
      tipoPeriodo:   p.data.tipoPeriodo,
      profesionales: p.data.profesionales,
      observaciones: '[Duplicado de ' + id + '] ' + (p.data.observaciones || '')
    });
  } catch (e) {
    logErr('duplicateParte', e);
    return fail(e.message);
  }
}
