/**
 * Gestión de usuarios, roles y permisos.
 * Todas las funciones que modifican datos aceptan un token de sesión como primer parámetro.
 * Las funciones de consulta de rol trabajan directamente con email (son helpers internos).
 *
 * getCurrentUserInfo() se ha movido a Sesion.gs.
 */

// ── Helpers de rol (internos, basados en email) ────────────────────────────

function getUserRole(email) {
  if (!email) return null;
  var schemaUsers = getUsuariosSchema();
  var data = getAllRaw(CONFIG.SHEETS.USUARIOS);
  var key = normalizeIdKey(email).toLowerCase();
  for (var i = 1; i < data.length; i++) {
    if (normalizeIdKey(rowVal(data[i], schemaUsers.EMAIL)).toLowerCase() !== key) continue;
    if (!rowVal(data[i], schemaUsers.ACTIVO)) return null;
    return rowVal(data[i], schemaUsers.ROL);
  }
  return null;
}

function isAdmin(email) {
  return getUserRole(email) === CONFIG.ROLES.ADMIN;
}

function canEdit(email) {
  var role = getUserRole(email);
  return role === CONFIG.ROLES.ADMIN || role === CONFIG.ROLES.EDITOR;
}

// ── Guardias de permiso (usan token) ──────────────────────────────────────

/**
 * Lanza excepción si el usuario de la sesión no puede editar.
 * @param {string} token  Token de sesión devuelto por loginUsuario().
 * @returns {{email,nombre,rol}}  El usuario validado (para reutilizar en la llamada).
 */
function requireEditPermission(token) {
  var user = getSessionUser(token);
  if (!user) throw new Error('Sesión no válida o expirada. Vuelve a iniciar sesión.');
  if (!canEdit(user.email)) {
    throw new Error('No tienes permisos de edición. Contacta con el administrador.');
  }
  return user;
}

/**
 * Lanza excepción si el usuario de la sesión no es administrador.
 */
function requireAdminPermission(token) {
  var user = getSessionUser(token);
  if (!user) throw new Error('Sesión no válida o expirada. Vuelve a iniciar sesión.');
  if (user.rol !== CONFIG.ROLES.ADMIN) {
    throw new Error('Solo los administradores pueden realizar esta acción.');
  }
  return user;
}

// ── API de usuarios (requieren token) ─────────────────────────────────────

function getUsuarios(token) {
  try {
    if (!getSessionUser(token)) return fail('Sesión no válida.');
    var schemaUsers = getUsuariosSchema();
    var data = getAllRaw(CONFIG.SHEETS.USUARIOS);
    if (data.length <= 1) return ok([]);
    var usuarios = data.slice(1)
      .filter(function(row) { return !!rowVal(row, schemaUsers.EMAIL); })
      .map(function(row) {
        return {
          email:     rowVal(row, schemaUsers.EMAIL),
          nombre:    rowVal(row, schemaUsers.NOMBRE),
          rol:       rowVal(row, schemaUsers.ROL),
          activo:    rowVal(row, schemaUsers.ACTIVO),
          fechaAlta: toISO(rowVal(row, schemaUsers.FECHA_ALTA))
          // Password nunca se devuelve al cliente
        };
      });
    return ok(usuarios);
  } catch (e) {
    logErr('getUsuarios', e);
    return fail(e.message);
  }
}

function addUsuario(token, email, nombre, rol, password) {
  try {
    requireAdminPermission(token);
    var schemaUsers = getUsuariosSchema();
    if (!email || !nombre || !rol) throw new Error('Email, nombre y rol son obligatorios.');
    if (!password || password.trim().length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.');
    email = email.trim().toLowerCase();
    if (findRow(CONFIG.SHEETS.USUARIOS, schemaUsers.EMAIL, email)) {
      throw new Error('Ya existe un usuario con ese email.');
    }
    appendRow(CONFIG.SHEETS.USUARIOS, [email, nombre, rol, true, password.trim(), new Date()]);
    return ok(null, 'Usuario añadido correctamente.');
  } catch (e) {
    logErr('addUsuario', e);
    return fail(e.message);
  }
}

function updateUsuarioRol(token, email, nuevoRol) {
  try {
    requireAdminPermission(token);
    var schemaUsers = getUsuariosSchema();
    email = (email || '').trim().toLowerCase();
    var result = findRow(CONFIG.SHEETS.USUARIOS, schemaUsers.EMAIL, email);
    if (!result) throw new Error('Usuario no encontrado.');
    setCellValue(CONFIG.SHEETS.USUARIOS, result.rowIndex, schemaUsers.ROL, nuevoRol);
    return ok(null, 'Rol actualizado.');
  } catch (e) {
    logErr('updateUsuarioRol', e);
    return fail(e.message);
  }
}

function toggleUsuarioActivo(token, email) {
  try {
    requireAdminPermission(token);
    var schemaUsers = getUsuariosSchema();
    email = (email || '').trim().toLowerCase();
    var result = findRow(CONFIG.SHEETS.USUARIOS, schemaUsers.EMAIL, email);
    if (!result) throw new Error('Usuario no encontrado.');
    var current = rowVal(result.row, schemaUsers.ACTIVO);
    setCellValue(CONFIG.SHEETS.USUARIOS, result.rowIndex, schemaUsers.ACTIVO, !current);
    return ok(null, current ? 'Usuario desactivado.' : 'Usuario activado.');
  } catch (e) {
    logErr('toggleUsuarioActivo', e);
    return fail(e.message);
  }
}
