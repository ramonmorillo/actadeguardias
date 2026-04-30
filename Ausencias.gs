/**
 * Módulo autónomo de Ausencias.
 */

var AUSENCIAS_SHEET_NAME = 'Ausencias';
var AUSENCIAS_HEADERS = [
  'id',
  'personaAusente',
  'fechaInicio',
  'fechaFin',
  'tipoAusencia',
  'personaSustituta',
  'observaciones',
  'estado',
  'creadoPor',
  'createdAt',
  'updatedAt'
];

function ensureAusenciasSheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(AUSENCIAS_SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(AUSENCIAS_SHEET_NAME);

    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var map = {};
    for (var i = 0; i < existingHeaders.length; i++) {
      var key = normalizeHeaderKey(existingHeaders[i]);
      if (key) map[key] = i + 1;
    }

    for (var j = 0; j < AUSENCIAS_HEADERS.length; j++) {
      var expected = AUSENCIAS_HEADERS[j];
      if (!map[normalizeHeaderKey(expected)]) {
        var targetCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, targetCol).setValue(expected);
      }
    }

    var refreshCols = Math.max(sheet.getLastColumn(), AUSENCIAS_HEADERS.length);
    var refreshedHeaders = sheet.getRange(1, 1, 1, refreshCols).getValues()[0];
    if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);
    if (!_ausenciasRowHasContent_(refreshedHeaders)) {
      sheet.getRange(1, 1, 1, AUSENCIAS_HEADERS.length).setValues([AUSENCIAS_HEADERS]);
    }
    return ok({ sheetName: AUSENCIAS_SHEET_NAME, headers: refreshedHeaders });
  } catch (e) {
    logErr('ensureAusenciasSheet', e);
    return fail('No se pudo inicializar la hoja Ausencias: ' + e.message);
  }
}

function getAusencias(params) {
  Logger.log('[Ausencias][getAusencias] inicio params=%s', JSON.stringify(params || {}));
  try {
    var ensured = ensureAusenciasSheet();
    if (!ensured.ok) return ensured;

    var p = params || {};
    var normalized = _normalizeAusenciasFilters_(p);
    var rows = _readAusenciasRowsFormatted_();

    var filtered = rows.filter(function(item) {
      if (normalized.estado && (item.estado || '').toLowerCase() !== normalized.estado) return false;
      if (normalized.personaAusente && (item.personaAusente || '').toLowerCase().indexOf(normalized.personaAusente) === -1) return false;
      if (normalized.personaSustituta && (item.personaSustituta || '').toLowerCase().indexOf(normalized.personaSustituta) === -1) return false;

      var fi = _ausenciasDateTime_(item.fechaInicioRaw || item.fechaInicio);
      if (normalized.fechaDesde && (!fi || fi < normalized.fechaDesde)) return false;
      if (normalized.fechaHasta && (!fi || fi > normalized.fechaHasta)) return false;
      return true;
    });

    filtered.sort(function(a, b) {
      var da = _ausenciasDateTime_(a.fechaInicioRaw || a.fechaInicio);
      var db = _ausenciasDateTime_(b.fechaInicioRaw || b.fechaInicio);
      var ta = da ? da.getTime() : 0;
      var tb = db ? db.getTime() : 0;
      return tb - ta;
    });

    var cleanData = filtered.map(function(item) {
      var out = {};
      AUSENCIAS_HEADERS.forEach(function(h) {
        if (h !== 'fechaInicioRaw' && h !== 'fechaFinRaw') out[h] = item[h];
      });
      return out;
    });
    var response = _ausenciasOk_(cleanData);
    Logger.log('[Ausencias][getAusencias] retorno ok total=%s', cleanData.length);
    return response;
  } catch (e) {
    Logger.log('[Ausencias][getAusencias] error=%s', e && e.stack ? e.stack : e);
    _ausenciasLogErr_('getAusencias', e);
    return _ausenciasFail_(e && e.message ? e.message : String(e));
  }
}

function diagnosticoAusencias() {
  try {
    var ensured = ensureAusenciasSheet();
    if (!ensured.ok) return ensured;

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUSENCIAS_SHEET_NAME);
    var values = sheet.getDataRange().getValues();
    var headers = values && values.length ? values[0] : [];
    var rows = _readAusenciasRowsFormatted_();

    return _ausenciasOk_({
      headers: headers,
      totalRows: values ? values.length : 0,
      dataRows: rows.length,
      sample: rows.length ? rows[0] : null
    });
  } catch (e) {
    _ausenciasLogErr_('diagnosticoAusencias', e);
    return _ausenciasFail_('Error en diagnóstico de ausencias: ' + (e && e.message ? e.message : e));
  }
}

function getAusenciasActivas() {
  return getAusencias({ estado: 'activa' });
}

function getAusenciasPorRango(fechaDesde, fechaHasta) {
  return getAusencias({ fechaDesde: fechaDesde, fechaHasta: fechaHasta });
}

function createAusencia(data) {
  Logger.log('[Ausencias][createAusencia] inicio');
  Logger.log('[Ausencias][createAusencia] payload=%s', JSON.stringify(data || {}));
  try {
    var ensured = ensureAusenciasSheet();
    if (!ensured.ok) return ensured;

    var payload = data || {};
    var personaAusente = (payload.personaAusente || '').toString().trim();
    var fechaInicio = _parseDateValue_(payload.fechaInicio);
    var fechaFin = _parseDateValue_(payload.fechaFin);
    if (!personaAusente) return _ausenciasFail_('personaAusente es obligatoria.');
    if (!fechaInicio || !fechaFin) {
      return _ausenciasFail_('fechaInicio o fechaFin no tiene formato válido');
    }
    if (fechaFin.getTime() < fechaInicio.getTime()) return _ausenciasFail_('fechaFin no puede ser anterior a fechaInicio.');

    var now = new Date();
    var id = (payload.id || '').toString().trim() || Utilities.getUuid();
    var creadoPor = _resolveCurrentUser_();

    var record = {
      id: id,
      personaAusente: personaAusente,
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      tipoAusencia: (payload.tipoAusencia || '').toString().trim(),
      personaSustituta: (payload.personaSustituta || '').toString().trim(),
      observaciones: (payload.observaciones || '').toString().trim(),
      estado: (payload.estado || 'activa').toString().trim() || 'activa',
      creadoPor: creadoPor,
      createdAt: now,
      updatedAt: now
    };

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUSENCIAS_SHEET_NAME);
    var row = AUSENCIAS_HEADERS.map(function(h) { return record[h] !== undefined ? record[h] : ''; });

    var writeRow = [];
    for (var c = 1; c <= sheet.getLastColumn(); c++) {
      var headerName = (sheet.getRange(1, c).getValue() || '').toString();
      var idx = AUSENCIAS_HEADERS.indexOf(headerName);
      writeRow.push(idx >= 0 ? row[idx] : '');
    }

    sheet.appendRow(writeRow);
    Logger.log('[Ausencias][createAusencia] fila guardada id=%s', id);
    return _ausenciasOk_(record, 'Ausencia guardada correctamente');
  } catch (e) {
    Logger.log('[Ausencias][createAusencia] error=%s', e && e.stack ? e.stack : e);
    _ausenciasLogErr_('createAusencia', e);
    return _ausenciasFail_(e && e.message ? e.message : String(e));
  }
}

function testAusenciasBackend() {
  var payload = {
    personaAusente: 'TEST',
    fechaInicio: '2026-04-30',
    fechaFin: '2026-05-01',
    tipoAusencia: 'TEST',
    sustituto: '',
    observaciones: 'Prueba backend'
  };
  var created = createAusencia(payload);
  var list = getAusencias({});
  return {
    ok: true,
    created: created,
    list: list
  };
}

function updateAusencia(id, data) {
  try {
    var ensured = ensureAusenciasSheet();
    if (!ensured.ok) return ensured;

    var ausenciaId = (id || '').toString().trim();
    if (!ausenciaId) return fail('El id es obligatorio.');

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUSENCIAS_SHEET_NAME);
    var schema = _getAusenciasHeaderMap_(sheet);
    var all = sheet.getDataRange().getValues();

    var targetRow = -1;
    for (var i = 1; i < all.length; i++) {
      var rowId = (all[i][schema.id] || '').toString().trim();
      if (rowId === ausenciaId) { targetRow = i + 1; break; }
    }
    if (targetRow === -1) return fail('No se encontró la ausencia con id indicado.');

    var current = _rowToAusencia_(all[targetRow - 1], schema);
    var updates = data || {};
    var allowed = ['personaAusente', 'fechaInicio', 'fechaFin', 'tipoAusencia', 'personaSustituta', 'observaciones', 'estado'];

    allowed.forEach(function(field) {
      if (updates[field] !== undefined) current[field] = updates[field];
    });

    var start = _parseDateValue_(current.fechaInicio);
    var end = _parseDateValue_(current.fechaFin);
    if (!current.personaAusente || !current.personaAusente.toString().trim()) return fail('personaAusente es obligatoria.');
    if (!start) return fail('fechaInicio debe ser válida.');
    if (!end) return fail('fechaFin debe ser válida.');
    if (end.getTime() < start.getTime()) return fail('fechaFin no puede ser anterior a fechaInicio.');

    current.fechaInicio = start;
    current.fechaFin = end;
    current.updatedAt = new Date();

    allowed.concat(['updatedAt']).forEach(function(field) {
      if (schema[field] !== undefined) sheet.getRange(targetRow, schema[field] + 1).setValue(current[field]);
    });

    return ok(current);
  } catch (e) {
    logErr('updateAusencia', e);
    return fail('Error al actualizar la ausencia: ' + e.message);
  }
}

function deleteAusencia(id) {
  try {
    var ensured = ensureAusenciasSheet();
    if (!ensured.ok) return ensured;

    var ausenciaId = (id || '').toString().trim();
    if (!ausenciaId) return fail('El id es obligatorio.');

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUSENCIAS_SHEET_NAME);
    var schema = _getAusenciasHeaderMap_(sheet);
    var all = sheet.getDataRange().getValues();

    for (var i = 1; i < all.length; i++) {
      var rowId = (all[i][schema.id] || '').toString().trim();
      if (rowId === ausenciaId) {
        if (schema.estado !== undefined) sheet.getRange(i + 1, schema.estado + 1).setValue('cancelada');
        if (schema.updatedAt !== undefined) sheet.getRange(i + 1, schema.updatedAt + 1).setValue(new Date());
        return ok(true);
      }
    }

    return fail('No se encontró la ausencia con id indicado.');
  } catch (e) {
    logErr('deleteAusencia', e);
    return fail('Error al cancelar la ausencia: ' + e.message);
  }
}


function getUsuariosParaAusencias() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Usuarios');
    if (!sheet) return { ok: false, error: 'No se encontró la hoja Usuarios.' };

    var values = sheet.getDataRange().getValues();
    if (!values || values.length <= 1) return { ok: true, data: [] };

    var headers = values[0] || [];
    var map = {};
    for (var i = 0; i < headers.length; i++) {
      var key = normalizeHeaderKey(headers[i]);
      if (key) map[key] = i;
    }

    function findHeaderIndex(aliases) {
      for (var j = 0; j < aliases.length; j++) {
        var idx = map[aliases[j]];
        if (idx !== undefined) return idx;
      }
      return -1;
    }

    var idxNombre = findHeaderIndex(['nombre', 'apellidosynombre', 'nombrecompleto', 'profesional', 'trabajador', 'usuario']);
    var idxActivo = findHeaderIndex(['activo']);

    var data = [];
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var nombre = '';
      if (idxNombre >= 0) nombre = (row[idxNombre] || '').toString().trim();
      if (!nombre) {
        for (var c = 0; c < row.length; c++) {
          var candidate = (row[c] || '').toString().trim();
          if (candidate) {
            nombre = candidate;
            break;
          }
        }
      }
      if (!nombre) continue;

      var activo = true;
      if (idxActivo >= 0) {
        var raw = row[idxActivo];
        if (typeof raw === 'boolean') activo = raw;
        else {
          var norm = (raw || '').toString().trim().toLowerCase();
          activo = ['1', 'true', 'sí', 'si', 's', 'activo', 'activa', 'yes'].indexOf(norm) !== -1;
        }
      }
      if (idxActivo >= 0 && !activo) continue;

      data.push({ nombre: nombre });
    }

    data.sort(function(a, b) {
      return (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' });
    });

    return { ok: true, data: data };
  } catch (e) {
    logErr('getUsuariosParaAusencias', e);
    return { ok: false, error: 'No se pudo obtener el listado de usuarios para Ausencias: ' + e.message };
  }
}

function _readAusenciasRows_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUSENCIAS_SHEET_NAME);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return [];
  var schema = _getAusenciasHeaderMap_(sheet);
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    if (!_ausenciasRowHasContent_(values[i])) continue;
    rows.push(_rowToAusencia_(values[i], schema));
  }
  return rows;
}

function _rowToAusencia_(row, schema) {
  var obj = {};
  AUSENCIAS_HEADERS.forEach(function(h) {
    obj[h] = schema[h] !== undefined ? row[schema[h]] : '';
  });
  return obj;
}

function _getAusenciasHeaderMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  var map = {};
  headers.forEach(function(h, i) { map[(h || '').toString().trim()] = i; });
  AUSENCIAS_HEADERS.forEach(function(h) {
    if (map[h] === undefined) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
      map[h] = sheet.getLastColumn() - 1;
    }
  });
  return map;
}

function _parseDateValue_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value === 'string') {
    var s = value.trim();
    if (!s) return null;

    var isoDateMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (isoDateMatch) {
      return _buildLocalDate_(Number(isoDateMatch[1]), Number(isoDateMatch[2]), Number(isoDateMatch[3]));
    }

    var dmySlashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (dmySlashMatch) {
      return _buildLocalDate_(Number(dmySlashMatch[3]), Number(dmySlashMatch[2]), Number(dmySlashMatch[1]));
    }

    var dmyDashMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
    if (dmyDashMatch) {
      return _buildLocalDate_(Number(dmyDashMatch[3]), Number(dmyDashMatch[2]), Number(dmyDashMatch[1]));
    }

    var parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  var d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function _buildLocalDate_(year, month, day) {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  var date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function _normalizeAusenciasFilters_(params) {
  return {
    estado: (params.estado || '').toString().trim().toLowerCase(),
    personaAusente: (params.personaAusente || '').toString().trim().toLowerCase(),
    personaSustituta: (params.personaSustituta || '').toString().trim().toLowerCase(),
    fechaDesde: _ausenciasDateTime_(params.fechaDesde),
    fechaHasta: _ausenciasDateTime_(params.fechaHasta)
  };
}

function _readAusenciasRowsFormatted_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUSENCIAS_SHEET_NAME);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return [];

  var headers = values[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[(headers[i] || '').toString().trim()] = i;
  }

  var tz = Session.getScriptTimeZone();
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!_ausenciasRowHasContent_(row)) continue;
    var obj = {};
    AUSENCIAS_HEADERS.forEach(function(h) {
      var idx = map[h];
      obj[h] = idx !== undefined ? row[idx] : '';
    });
    var fi = _ausenciasDateTime_(obj.fechaInicio);
    var ff = _ausenciasDateTime_(obj.fechaFin);
    var ca = _ausenciasDateTime_(obj.createdAt);
    var ua = _ausenciasDateTime_(obj.updatedAt);
    obj.fechaInicioRaw = fi;
    obj.fechaFinRaw = ff;
    obj.fechaInicio = fi ? Utilities.formatDate(fi, tz, 'dd/MM/yyyy') : '';
    obj.fechaFin = ff ? Utilities.formatDate(ff, tz, 'dd/MM/yyyy') : '';
    obj.createdAt = ca ? Utilities.formatDate(ca, tz, 'dd/MM/yyyy HH:mm') : '';
    obj.updatedAt = ua ? Utilities.formatDate(ua, tz, 'dd/MM/yyyy HH:mm') : '';
    rows.push(obj);
  }
  return rows;
}

function _ausenciasDateTime_(value) {
  return _parseDateValue_(value);
}

function _ausenciasOk_(data, message) {
  return { ok: true, data: data, message: message || '' };
}

function _ausenciasFail_(error) {
  return { ok: false, error: error || 'Error desconocido' };
}

function _ausenciasLogErr_(scope, err) {
  var msg = '[' + scope + '] ' + (err && err.stack ? err.stack : err);
  console.error(msg);
}

function _resolveCurrentUser_() {
  try {
    if (typeof getCurrentUser === 'function') {
      return getCurrentUser() || 'Sistema';
    }
  } catch (e) {}
  return 'Sistema';
}

function _ausenciasRowHasContent_(row) {
  if (!row || !row.length) return false;
  return row.some(function(cell) {
    return cell !== null && cell !== undefined && cell.toString().trim() !== '';
  });
}
