/**
 * Funciones de utilidad compartidas: IDs, fechas, validación, respuestas estándar.
 */

// ── Generación de IDs ──────────────────────────────────────────────────────

function generateId(prefix) {
  var fecha = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyyMMdd');
  var random = Math.floor(Math.random() * 90000) + 10000;
  return prefix + '-' + fecha + '-' + random;
}

// ── Fechas ─────────────────────────────────────────────────────────────────

function formatDateTime(date) {
  if (!date) return '';
  try {
    var d = (date instanceof Date) ? date : new Date(date);
    return Utilities.formatDate(d, 'Europe/Madrid', 'dd/MM/yyyy HH:mm');
  } catch (e) { return ''; }
}

function formatDateShort(date) {
  if (!date) return '';
  try {
    var d = (date instanceof Date) ? date : new Date(date);
    return Utilities.formatDate(d, 'Europe/Madrid', 'dd/MM/yyyy');
  } catch (e) { return ''; }
}

function toISO(date) {
  if (!date) return '';
  try {
    return ((date instanceof Date) ? date : new Date(date)).toISOString();
  } catch (e) { return ''; }
}

// ── Usuario activo ─────────────────────────────────────────────────────────

/**
 * Devuelve el email del usuario activo.
 * Con el sistema de login interno, recibe el token de sesión.
 * Mantiene fallback a Session.getActiveUser() para ejecuciones directas desde el editor.
 * @param {string} [token]
 */
function getCurrentUser(token) {
  if (token) {
    var user = getSessionUser(token);
    if (user) return user.email;
  }
  // Fallback: ejecución directa desde el editor de Apps Script (p.ej. inicializarAplicacion)
  try {
    var email = Session.getActiveUser().getEmail();
    return email || 'script-admin';
  } catch (e) {
    return 'script-admin';
  }
}

// ── Detección de datos sensibles ───────────────────────────────────────────

function containsPatientData(text) {
  if (!text) return false;
  return CONFIG.PATRONES_SENSIBLES.some(function(re) { return re.test(text); });
}

/**
 * Comprueba una lista de { name, value } y devuelve los avisos oportunos.
 * @returns {string[]} Avisos de posibles datos identificativos.
 */
function checkSensitiveData(fields) {
  var warnings = [];
  fields.forEach(function(f) {
    if (containsPatientData(f.value)) {
      warnings.push(
        'AVISO: El campo "' + f.name + '" puede contener identificadores directos de pacientes ' +
        '(DNI, NHC, SIP…). Por normativa de privacidad NO deben registrarse.'
      );
    }
  });
  return warnings;
}

// ── Validación básica ──────────────────────────────────────────────────────

function requireField(value, name) {
  if (value === null || value === undefined || value.toString().trim() === '') {
    throw new Error('El campo "' + name + '" es obligatorio.');
  }
  return value.toString().trim();
}

// ── Respuestas estándar ────────────────────────────────────────────────────

function ok(data, message) {
  return {
    ok: true,
    success: true,
    data: data !== undefined ? data : null,
    error: null,
    message: message || ''
  };
}

function fail(message, data) {
  var msg = message || 'Error no especificado.';
  return {
    ok: false,
    success: false,
    data: data !== undefined ? data : null,
    error: msg,
    message: msg
  };
}

function normalizeDateInput(value, tz, endOfDay) {
  if (value === null || value === undefined || value === '') return null;
  var d = (value instanceof Date) ? new Date(value.getTime()) : new Date(value);
  if (isNaN(d.getTime())) throw new Error('Fecha inválida: ' + value);

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    var parts = value.split('-');
    d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function isDateInRange(dateValue, desde, hasta) {
  if (dateValue === null || dateValue === undefined || dateValue === '') return false;
  var d = (dateValue instanceof Date) ? dateValue : new Date(dateValue);
  if (isNaN(d.getTime())) return false;
  if (desde && d < desde) return false;
  if (hasta && d > hasta) return false;
  return true;
}

// ── Logging ────────────────────────────────────────────────────────────────

function logErr(context, err) {
  console.error('[' + context + '] ' + err.message + (err.stack ? '\n' + err.stack : ''));
}

// ── Tamaño legible ─────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  var k = 1024;
  var sizes = ['B', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ── Normalización de listas (compatibilidad + formato canónico) ──────────

function parseListValue(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value
      .map(function(v) { return (v || '').toString().trim(); })
      .filter(function(v) { return !!v; });
  }

  var text = value.toString().trim();
  if (!text) return [];

  // Formato canónico: JSON array serializado
  if (text.charAt(0) === '[') {
    try {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map(function(v) { return (v || '').toString().trim(); })
          .filter(function(v) { return !!v; });
      }
    } catch (e) {}
    // Compatibilidad: pseudo-JSON histórico con comillas simples
    try {
      var fixed = text.replace(/'/g, '"');
      var parsedFixed = JSON.parse(fixed);
      if (Array.isArray(parsedFixed)) {
        return parsedFixed
          .map(function(v) { return (v || '').toString().trim(); })
          .filter(function(v) { return !!v; });
      }
    } catch (e2) {}
  }

  // Compatibilidad con histórico: texto separado por comas/;|saltos
  return text
    .split(/[,\n;|]+/)
    .map(function(v) { return v.trim(); })
    .filter(function(v) { return !!v; });
}

function normalizeIdKey(value) {
  if (value === null || value === undefined) return '';
  return value.toString().replace(/\u00A0/g, ' ').trim();
}

function uniqueCaseInsensitive(list) {
  var out = [];
  var seen = {};
  list.forEach(function(v) {
    var key = v.toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      out.push(v);
    }
  });
  return out;
}

function stringifyListValue(list) {
  return JSON.stringify(uniqueCaseInsensitive(parseListValue(list)));
}

function displayListValue(value) {
  return parseListValue(value).join(', ');
}

// ── Normalización de cabeceras y esquemas de hoja ─────────────────────────

function normalizeHeaderKey(value) {
  return (value || '').toString().toLowerCase().replace(/[\s_\-]+/g, '');
}

function getHeaders(sheetName) {
  var raw = getAllRaw(sheetName);
  return (raw && raw.length) ? raw[0] : [];
}

function buildHeaderMap(headers) {
  var map = {};
  (headers || []).forEach(function(h, i) {
    map[normalizeHeaderKey(h)] = i;
  });
  return map;
}

function resolveColumnIndex(headerMap, aliases, fallback) {
  for (var i = 0; i < aliases.length; i++) {
    var key = normalizeHeaderKey(aliases[i]);
    if (headerMap[key] !== undefined) return headerMap[key];
  }
  return fallback;
}

function rowVal(row, idx) {
  var v = (idx >= 0 && row && idx < row.length) ? row[idx] : '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString();
  return v;
}

function getUsuariosSchema() {
  var map = buildHeaderMap(getHeaders(CONFIG.SHEETS.USUARIOS));
  return {
    EMAIL: resolveColumnIndex(map, ['Email'], COLS.USUARIOS.EMAIL),
    NOMBRE: resolveColumnIndex(map, ['Nombre'], COLS.USUARIOS.NOMBRE),
    ROL: resolveColumnIndex(map, ['Rol'], COLS.USUARIOS.ROL),
    ACTIVO: resolveColumnIndex(map, ['Activo'], COLS.USUARIOS.ACTIVO),
    PASSWORD: resolveColumnIndex(map, ['Password'], COLS.USUARIOS.PASSWORD),
    FECHA_ALTA: resolveColumnIndex(map, ['FechaAlta', 'FechaAltaUsuario'], COLS.USUARIOS.FECHA_ALTA)
  };
}

function getCatalogosSchema() {
  var map = buildHeaderMap(getHeaders(CONFIG.SHEETS.CATALOGOS));
  return {
    TIPO: resolveColumnIndex(map, ['Tipo'], COLS.CATALOGOS.TIPO),
    VALOR: resolveColumnIndex(map, ['Valor'], COLS.CATALOGOS.VALOR),
    DESCRIPCION: resolveColumnIndex(map, ['Descripcion'], COLS.CATALOGOS.DESCRIPCION),
    ACTIVO: resolveColumnIndex(map, ['Activo'], COLS.CATALOGOS.ACTIVO),
    ORDEN: resolveColumnIndex(map, ['Orden'], COLS.CATALOGOS.ORDEN)
  };
}

function getAdjuntosSchema() {
  var map = buildHeaderMap(getHeaders(CONFIG.SHEETS.ADJUNTOS));
  return {
    ID: resolveColumnIndex(map, ['ID'], COLS.ADJUNTOS.ID),
    ID_INCIDENCIA: resolveColumnIndex(map, ['IDIncidencia'], COLS.ADJUNTOS.ID_INCIDENCIA),
    ID_PARTE: resolveColumnIndex(map, ['IDParte'], COLS.ADJUNTOS.ID_PARTE),
    NOMBRE_ARCHIVO: resolveColumnIndex(map, ['NombreArchivo'], COLS.ADJUNTOS.NOMBRE_ARCHIVO),
    URL_DRIVE: resolveColumnIndex(map, ['URLDrive'], COLS.ADJUNTOS.URL_DRIVE),
    ID_DRIVE: resolveColumnIndex(map, ['IDDrive'], COLS.ADJUNTOS.ID_DRIVE),
    FECHA_SUBIDA: resolveColumnIndex(map, ['FechaSubida'], COLS.ADJUNTOS.FECHA_SUBIDA),
    SUBIDO_POR: resolveColumnIndex(map, ['SubidoPor'], COLS.ADJUNTOS.SUBIDO_POR),
    TIPO_ARCHIVO: resolveColumnIndex(map, ['TipoArchivo'], COLS.ADJUNTOS.TIPO_ARCHIVO),
    TAMANYO: resolveColumnIndex(map, ['Tamanyo', 'Tamaño'], COLS.ADJUNTOS.TAMANYO)
  };
}
