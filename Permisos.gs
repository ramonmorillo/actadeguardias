/**
 * Gestión de usuarios, roles y permisos.
 * Roles: admin > editor > lector.
 */

// ── Consulta de rol ────────────────────────────────────────────────────────

function getUserRole(email) {
  if (!email) return null;
  var result = findRow(CONFIG.SHEETS.USUARIOS, COLS.USUARIOS.EMAIL, email);
  if (!result) return null;
  var row = result.row;
  if (!row[COLS.USUARIOS.ACTIVO]) return null;
  return row[COLS.USUARIOS.ROL];
}

function isAdmin(email) {
  return getUserRole(email || getCurrentUser()) === CONFIG.ROLES.ADMIN;
}

function canEdit(email) {
  var role = getUserRole(email || getCurrentUser());
  return role === CONFIG.ROLES.ADMIN || role === CONFIG.ROLES.EDITOR;
}

/** Lanza excepción si el usuario activo no puede editar. */
function requireEditPermission() {
  if (!canEdit(getCurrentUser())) {
    throw new Error('No tienes permisos de edición. Contacta con el administrador.');
  }
}

// ── API pública ────────────────────────────────────────────────────────────

/** Devuelve la información del usuario activo (auto-registra como lector si es nuevo). */
function getCurrentUserInfo() {
  try {
    var email = getCurrentUser();
    var result = findRow(CONFIG.SHEETS.USUARIOS, COLS.USUARIOS.EMAIL, email);
    if (!result) {
      // Auto-registro con rol lector
      appendRow(CONFIG.SHEETS.USUARIOS, [
        email,
        email.split('@')[0].replace(/[._]/g, ' '),
        CONFIG.ROLES.LECTOR,
        true,
        new Date()
      ]);
      return ok({ email: email, nombre: email.split('@')[0], rol: CONFIG.ROLES.LECTOR, activo: true });
    }
    var row = result.row;
    return ok({
      email:  row[COLS.USUARIOS.EMAIL],
      nombre: row[COLS.USUARIOS.NOMBRE],
      rol:    row[COLS.USUARIOS.ROL],
      activo: row[COLS.USUARIOS.ACTIVO]
    });
  } catch (e) {
    logErr('getCurrentUserInfo', e);
    return fail(e.message);
  }
}

function getUsuarios() {
  try {
    var data = getAllRaw(CONFIG.SHEETS.USUARIOS);
    if (data.length <= 1) return ok([]);
    var usuarios = data.slice(1).map(function(row) {
      return {
        email:     row[COLS.USUARIOS.EMAIL],
        nombre:    row[COLS.USUARIOS.NOMBRE],
        rol:       row[COLS.USUARIOS.ROL],
        activo:    row[COLS.USUARIOS.ACTIVO],
        fechaAlta: toISO(row[COLS.USUARIOS.FECHA_ALTA])
      };
    });
    return ok(usuarios);
  } catch (e) {
    logErr('getUsuarios', e);
    return fail(e.message);
  }
}

function addUsuario(email, nombre, rol) {
  try {
    requireEditPermission();
    if (!email || !nombre || !rol) throw new Error('Email, nombre y rol son obligatorios.');
    if (findRow(CONFIG.SHEETS.USUARIOS, COLS.USUARIOS.EMAIL, email)) {
      throw new Error('Ya existe un usuario con ese email.');
    }
    appendRow(CONFIG.SHEETS.USUARIOS, [email, nombre, rol, true, new Date()]);
    return ok(null, 'Usuario añadido correctamente.');
  } catch (e) {
    logErr('addUsuario', e);
    return fail(e.message);
  }
}

function updateUsuarioRol(email, nuevoRol) {
  try {
    if (!isAdmin(getCurrentUser())) throw new Error('Solo los administradores pueden cambiar roles.');
    var result = findRow(CONFIG.SHEETS.USUARIOS, COLS.USUARIOS.EMAIL, email);
    if (!result) throw new Error('Usuario no encontrado.');
    setCellValue(CONFIG.SHEETS.USUARIOS, result.rowIndex, COLS.USUARIOS.ROL, nuevoRol);
    return ok(null, 'Rol actualizado.');
  } catch (e) {
    logErr('updateUsuarioRol', e);
    return fail(e.message);
  }
}

function toggleUsuarioActivo(email) {
  try {
    if (!isAdmin(getCurrentUser())) throw new Error('Solo los administradores pueden desactivar usuarios.');
    var result = findRow(CONFIG.SHEETS.USUARIOS, COLS.USUARIOS.EMAIL, email);
    if (!result) throw new Error('Usuario no encontrado.');
    var current = result.row[COLS.USUARIOS.ACTIVO];
    setCellValue(CONFIG.SHEETS.USUARIOS, result.rowIndex, COLS.USUARIOS.ACTIVO, !current);
    return ok(null, current ? 'Usuario desactivado.' : 'Usuario activado.');
  } catch (e) {
    logErr('toggleUsuarioActivo', e);
    return fail(e.message);
  }
}
