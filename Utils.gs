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

function getCurrentUser() {
  try {
    var email = Session.getActiveUser().getEmail();
    return email || 'desconocido';
  } catch (e) {
    return 'desconocido';
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
