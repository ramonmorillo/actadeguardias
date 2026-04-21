/**
 * Sistema de autenticación interna.
 * Las sesiones se almacenan en CacheService.getScriptCache() con TTL de 6 horas.
 *
 * SEGURIDAD — situación actual:
 *   Las contraseñas se guardan en texto plano en la hoja Usuarios (columna Password).
 *   Esto simplifica el despliegue inicial pero NO es aceptable en producción.
 *
 * MEJORA FUTURA (hash + salt):
 *   Sustituir la comparación directa por:
 *     var salt   = row[COLS.USUARIOS.EMAIL];  // o un salt separado
 *     var hashed = Utilities.base64Encode(
 *                    Utilities.computeDigest(
 *                      Utilities.DigestAlgorithm.SHA_256,
 *                      salt + password
 *                    ));
 *     if (storedPwd !== hashed) return fail('Contraseña incorrecta.');
 *   Y al crear/cambiar contraseña, almacenar el hash en lugar del texto plano.
 */

var SESSION_PREFIX  = 'sess_';
var SESSION_SECONDS = 6 * 3600; // 6 horas

// ── Login ──────────────────────────────────────────────────────────────────

/**
 * Valida credenciales y crea una sesión.
 * @returns {Object} ok({token, user:{email,nombre,rol}}) | fail(mensaje)
 */
function loginUsuario(email, password) {
  try {
    if (!email || !password) return fail('Email y contraseña son obligatorios.');

    email = email.toString().trim().toLowerCase();
    var schemaUsers = getUsuariosSchema();
    var usersData = getAllRaw(CONFIG.SHEETS.USUARIOS);
    var row = null;
    for (var i = 1; i < usersData.length; i++) {
      if (normalizeIdKey(rowVal(usersData[i], schemaUsers.EMAIL)).toLowerCase() === email) {
        row = usersData[i];
        break;
      }
    }
    if (!row) return fail('Usuario no encontrado. Contacta con el administrador.');

    if (!rowVal(row, schemaUsers.ACTIVO)) {
      return fail('Tu cuenta está desactivada. Contacta con el administrador.');
    }

    var storedPwd = (rowVal(row, schemaUsers.PASSWORD) || '').toString().trim();
    if (storedPwd === '') {
      return fail('Esta cuenta no tiene contraseña configurada. Contacta con el administrador.');
    }

    // Comparación directa (ver nota de MEJORA FUTURA arriba)
    if (storedPwd !== password.toString().trim()) {
      return fail('Contraseña incorrecta.');
    }

    var userInfo = {
      email:  normalizeIdKey(rowVal(row, schemaUsers.EMAIL)).toLowerCase(),
      nombre: rowVal(row, schemaUsers.NOMBRE),
      rol:    rowVal(row, schemaUsers.ROL)
    };

    var token = _crearSesion(userInfo);
    return ok({ token: token, user: userInfo }, 'Sesión iniciada.');
  } catch (e) {
    logErr('loginUsuario', e);
    return fail('Error al iniciar sesión: ' + e.message);
  }
}

// ── Logout ─────────────────────────────────────────────────────────────────

function logoutUsuario(token) {
  try {
    if (token) CacheService.getScriptCache().remove(SESSION_PREFIX + token);
    return ok(null, 'Sesión cerrada.');
  } catch (e) {
    logErr('logoutUsuario', e);
    return fail(e.message);
  }
}

// ── Validar sesión ─────────────────────────────────────────────────────────

/**
 * Devuelve el objeto de usuario {email,nombre,rol} o null si la sesión no existe/expiró.
 * Renueva el TTL en cada uso.
 */
function getSessionUser(token) {
  if (!token) return null;
  try {
    var cache = CacheService.getScriptCache();
    var raw   = cache.get(SESSION_PREFIX + token);
    if (!raw) return null;
    // Renovar TTL
    cache.put(SESSION_PREFIX + token, raw, SESSION_SECONDS);
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Devuelve la información del usuario autenticado (para validar sesión al recargar).
 * @param {string} token
 */
function getCurrentUserInfo(token) {
  try {
    if (!token) return fail('No hay sesión activa. Por favor, inicia sesión.');
    var user = getSessionUser(token);
    if (!user) return fail('La sesión ha expirado. Por favor, vuelve a iniciar sesión.');
    return ok(user);
  } catch (e) {
    logErr('getCurrentUserInfo', e);
    return fail(e.message);
  }
}

// ── Cambio de contraseña ───────────────────────────────────────────────────

/**
 * Cambia la contraseña de un usuario.
 * - Un admin puede cambiar la contraseña de cualquier usuario.
 * - Un usuario normal solo puede cambiar la suya propia.
 */
function cambiarPassword(token, targetEmail, newPassword) {
  try {
    var caller = getSessionUser(token);
    if (!caller) return fail('Sesión no válida. Vuelve a iniciar sesión.');

    if (!newPassword || newPassword.toString().trim().length < 4) {
      return fail('La contraseña debe tener al menos 4 caracteres.');
    }

    targetEmail = (targetEmail || '').trim().toLowerCase();

    if (caller.email !== targetEmail && caller.rol !== CONFIG.ROLES.ADMIN) {
      return fail('Solo los administradores pueden cambiar la contraseña de otro usuario.');
    }

    var schemaUsers = getUsuariosSchema();
    var result = findRow(CONFIG.SHEETS.USUARIOS, schemaUsers.EMAIL, targetEmail);
    if (!result) return fail('Usuario no encontrado.');

    setCellValue(
      CONFIG.SHEETS.USUARIOS,
      result.rowIndex,
      schemaUsers.PASSWORD,
      newPassword.toString().trim()
    );

    return ok(null, 'Contraseña actualizada correctamente.');
  } catch (e) {
    logErr('cambiarPassword', e);
    return fail(e.message);
  }
}

// ── Interno ────────────────────────────────────────────────────────────────

function _crearSesion(userInfo) {
  var token = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put(
    SESSION_PREFIX + token,
    JSON.stringify(userInfo),
    SESSION_SECONDS
  );
  return token;
}
