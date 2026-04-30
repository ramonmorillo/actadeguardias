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
    if (!rowHasContent(refreshedHeaders)) {
      sheet.getRange(1, 1, 1, AUSENCIAS_HEADERS.length).setValues([AUSENCIAS_HEADERS]);
    }
    return ok({ sheetName: AUSENCIAS_SHEET_NAME, headers: refreshedHeaders });
  } catch (e) {
    logErr('ensureAusenciasSheet', e);
    return fail('No se pudo inicializar la hoja Ausencias: ' + e.message);
  }
}

function getAusencias(params) {
  try {
    var ensured = ensureAusenciasSheet();
    if (!ensured.ok) return ensured;

    var p = params || {};
    var normalized = _normalizeAusenciasFilters(p);
    var rows = _readAusenciasRows_();

    var filtered = rows.filter(function(item) {
      if (normalized.estado && (item.estado || '').toLowerCase() !== normalized.estado) return false;
      if (normalized.personaAusente && (item.personaAusente || '').toLowerCase().indexOf(normalized.personaAusente) === -1) return false;
      if (normalized.personaSustituta && (item.personaSustituta || '').toLowerCase().indexOf(normalized.personaSustituta) === -1) return false;

      var fi = _parseDateValue_(item.fechaInicio);
      if (normalized.fechaDesde && (!fi || fi < normalized.fechaDesde)) return false;
      if (normalized.fechaHasta && (!fi || fi > normalized.fechaHasta)) return false;
      return true;
    });

    filtered.sort(function(a, b) {
      var da = _parseDateValue_(a.fechaInicio);
      var db = _parseDateValue_(b.fechaInicio);
      var ta = da ? da.getTime() : 0;
      var tb = db ? db.getTime() : 0;
      return tb - ta;
    });

    return ok(filtered);
  } catch (e) {
    logErr('getAusencias', e);
    return fail('Error al consultar ausencias: ' + e.message);
  }
}

function getAusenciasActivas() {
  return getAusencias({ estado: 'activa' });
}

function getAusenciasPorRango(fechaDesde, fechaHasta) {
  return getAusencias({ fechaDesde: fechaDesde, fechaHasta: fechaHasta });
}

function createAusencia(data) {
  try {
    var ensured = ensureAusenciasSheet();
    if (!ensured.ok) return ensured;

    var payload = data || {};
    var personaAusente = (payload.personaAusente || '').toString().trim();
    var fechaInicio = _parseDateValue_(payload.fechaInicio);
    var fechaFin = _parseDateValue_(payload.fechaFin);
    if (!personaAusente) return fail('personaAusente es obligatoria.');
    if (!fechaInicio) return fail('fechaInicio es obligatoria y debe ser válida.');
    if (!fechaFin) return fail('fechaFin es obligatoria y debe ser válida.');
    if (fechaFin.getTime() < fechaInicio.getTime()) return fail('fechaFin no puede ser anterior a fechaInicio.');

    var now = new Date();
    var id = Utilities.getUuid();
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
    var headerMap = _getAusenciasHeaderMap_(sheet);
    var row = AUSENCIAS_HEADERS.map(function(h) { return record[h] !== undefined ? record[h] : ''; });

    var writeRow = [];
    for (var c = 1; c <= sheet.getLastColumn(); c++) {
      var headerName = (sheet.getRange(1, c).getValue() || '').toString();
      var idx = AUSENCIAS_HEADERS.indexOf(headerName);
      writeRow.push(idx >= 0 ? row[idx] : '');
    }

    sheet.appendRow(writeRow);
    return ok(record);
  } catch (e) {
    logErr('createAusencia', e);
    return fail('Error al crear la ausencia: ' + e.message);
  }
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

function _readAusenciasRows_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUSENCIAS_SHEET_NAME);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return [];
  var schema = _getAusenciasHeaderMap_(sheet);
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    if (!rowHasContent(values[i])) continue;
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
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    var p = value.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  var d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function _normalizeAusenciasFilters(params) {
  return {
    estado: (params.estado || '').toString().trim().toLowerCase(),
    personaAusente: (params.personaAusente || '').toString().trim().toLowerCase(),
    personaSustituta: (params.personaSustituta || '').toString().trim().toLowerCase(),
    fechaDesde: _parseDateValue_(params.fechaDesde),
    fechaHasta: _parseDateValue_(params.fechaHasta)
  };
}

function _resolveCurrentUser_() {
  try {
    if (typeof getCurrentUser === 'function') {
      return getCurrentUser() || 'Sistema';
    }
  } catch (e) {}
  return 'Sistema';
}
