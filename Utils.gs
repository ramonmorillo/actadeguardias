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
  return { success: true, data: data !== undefined ? data : null, message: message || '' };
}

function fail(message, data) {
  return { success: false, data: data !== undefined ? data : null, message: message };
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
