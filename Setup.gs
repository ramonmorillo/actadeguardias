/**
 * Inicialización de la hoja de cálculo: crea hojas, cabeceras y datos de ejemplo.
 * Ejecutar UNA VEZ desde el editor de Apps Script con inicializarAplicacion().
 */

var HEADERS = {
  CONFIG:      ['Clave', 'Valor', 'Descripcion'],
  USUARIOS:    ['Email', 'Nombre', 'Rol', 'Activo', 'Password', 'FechaAlta'],
  PARTES:      ['ID', 'FechaInicio', 'FechaFin', 'TipoPeriodo', 'Profesionales',
                'CreadoPor', 'FechaCreacion', 'UltimaModificacion', 'ModificadoPor',
                'Estado', 'Observaciones'],
  INCIDENCIAS: ['ID', 'IDParte', 'FechaEvento', 'Area', 'TipoEntrada',
                'Descripcion', 'Actuacion', 'Medicamentos', 'ServicioUbicacion',
                'Prioridad', 'Etiquetas', 'RegistradoPor', 'FechaRegistro',
                'FechaModificacion', 'ModificadoPor', 'Estado', 'Seguimiento', 'TieneAdjuntos'],
  ADJUNTOS:    ['ID', 'IDIncidencia', 'IDParte', 'NombreArchivo', 'URLDrive',
                'IDDrive', 'FechaSubida', 'SubidoPor', 'TipoArchivo', 'Tamanyo'],
  CATALOGOS:   ['Tipo', 'Valor', 'Descripcion', 'Activo', 'Orden']
};

function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(HEADERS).forEach(function(key) {
    var sheetName = CONFIG.SHEETS[key];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === '') {
      var hdrs = HEADERS[key];
      var hdrRange = sheet.getRange(1, 1, 1, hdrs.length);
      hdrRange.setValues([hdrs]);
      hdrRange.setFontWeight('bold')
              .setBackground('#1a73e8')
              .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 180);
    }
  });

  initConfig(ss);
  initCatalogos(ss);
  console.log('Hojas creadas correctamente.');
}

function initConfig(ss) {
  var sheet = ss.getSheetByName(CONFIG.SHEETS.CONFIG);
  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, 6, 3).setValues([
      ['APP_NAME',       'Acta de Guardias - Farmacia Hospitalaria', 'Nombre de la app'],
      ['VERSION',        '1.0.0',  'Versión actual'],
      ['DRIVE_FOLDER_ID','',       'ID de carpeta Drive para adjuntos (se crea automáticamente)'],
      ['MAX_FILE_MB',    '5',      'Tamaño máximo de adjunto en MB'],
      ['ITEMS_PER_PAGE', '25',     'Resultados por página en búsquedas'],
      ['ADMIN_EMAIL',    '',       'Email del administrador principal']
    ]);
  }
}

function initCatalogos(ss) {
  var sheet = ss.getSheetByName(CONFIG.SHEETS.CATALOGOS);
  if (sheet.getLastRow() <= 1) {
    var rows = [];
    var ord  = 1;
    CONFIG.AREAS.forEach(function(v)         { rows.push(['Area',        v, '', true, ord++]); });
    CONFIG.TIPOS_ENTRADA.forEach(function(v) { rows.push(['TipoEntrada', v, '', true, ord++]); });
    CONFIG.PRIORIDADES.forEach(function(v)   { rows.push(['Prioridad',   v, '', true, ord++]); });
    CONFIG.TIPOS_PERIODO.forEach(function(v) { rows.push(['TipoPeriodo', v, '', true, ord++]); });
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }
}

// ── Datos de ejemplo ───────────────────────────────────────────────────────

function addSampleData() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  addSampleUsuarios(ss);
  addSamplePartes(ss);
}

function addSampleUsuarios(ss) {
  var sheet = ss.getSheetByName(CONFIG.SHEETS.USUARIOS);
  if (sheet.getLastRow() > 1) return;
  // Columnas: Email, Nombre, Rol, Activo, Password, FechaAlta
  // AVISO: contraseñas en texto plano solo para demo. Cambiarlas en producción.
  sheet.getRange(2, 1, 4, 6).setValues([
    ['admin@farmacia.es',         'Administrador Farmacia', 'admin',  true, 'Admin1234',   new Date()],
    ['farmaceutico1@farmacia.es', 'Ana García López',       'editor', true, 'Farmacia1',   new Date()],
    ['farmaceutico2@farmacia.es', 'Carlos Martínez Ruiz',  'editor', true, 'Farmacia2',   new Date()],
    ['tecnico1@farmacia.es',      'María Fernández Díaz',  'lector', true, 'Tecnico1',    new Date()]
  ]);
}

/**
 * Utilidad para añadir o actualizar la contraseña de un usuario desde el editor.
 * Ejecutar manualmente desde el editor de Apps Script si hace falta resetear.
 */
function resetearPasswordManual(email, nuevaPassword) {
  var result = findRow(CONFIG.SHEETS.USUARIOS, COLS.USUARIOS.EMAIL, email.toLowerCase());
  if (!result) throw new Error('Usuario no encontrado: ' + email);
  setCellValue(CONFIG.SHEETS.USUARIOS, result.rowIndex, COLS.USUARIOS.PASSWORD, nuevaPassword);
  console.log('Contraseña actualizada para: ' + email);
}

function addSamplePartes(ss) {
  var partesSheet = ss.getSheetByName(CONFIG.SHEETS.PARTES);
  if (partesSheet.getLastRow() > 1) return;

  var ahora = new Date();

  // Último fin de semana
  var sabPasado = new Date(ahora);
  sabPasado.setDate(ahora.getDate() - ((ahora.getDay() + 1) % 7) - 1);
  sabPasado.setHours(8, 0, 0, 0);
  var lunPasado = new Date(sabPasado);
  lunPasado.setDate(sabPasado.getDate() + 2);
  lunPasado.setHours(8, 0, 0, 0);

  // Fin de semana anterior
  var sabAnterior = new Date(sabPasado);
  sabAnterior.setDate(sabPasado.getDate() - 7);
  var lunAnterior = new Date(lunPasado);
  lunAnterior.setDate(lunPasado.getDate() - 7);

  var id1 = 'PG-' + Utilities.formatDate(sabPasado,  'Europe/Madrid', 'yyyyMMdd') + '-0001';
  var id2 = 'PG-' + Utilities.formatDate(sabAnterior,'Europe/Madrid', 'yyyyMMdd') + '-0001';

  partesSheet.getRange(2, 1, 2, 11).setValues([
    [id1, sabPasado,  lunPasado,  'Fin de semana', 'Ana García López, Carlos Martínez Ruiz',
     'farmaceutico1@farmacia.es', new Date(), new Date(), 'farmaceutico1@farmacia.es',
     'cerrado', 'Guardia sin incidencias graves. Flujo habitual del fin de semana.'],
    [id2, sabAnterior,lunAnterior,'Fin de semana', 'María Fernández Díaz',
     'tecnico1@farmacia.es',     new Date(), new Date(), 'tecnico1@farmacia.es',
     'cerrado', 'Guardia tranquila. Se atienden consultas habituales de unidades.']
  ]);

  addSampleIncidencias(ss, id1, id2, sabPasado, sabAnterior);
}

function addSampleIncidencias(ss, id1, id2, sab1, sab2) {
  var sheet = ss.getSheetByName(CONFIG.SHEETS.INCIDENCIAS);
  if (sheet.getLastRow() > 1) return;

  var t = function(base, hours) {
    var d = new Date(base); d.setHours(d.getHours() + hours); return d;
  };

  var rows = [
    // Parte 1 - incidencia 1
    ['INC-' + Utilities.formatDate(sab1,'Europe/Madrid','yyyyMMdd') + '-0001',
     id1, t(sab1, 2), 'UCI', 'Incidencia de dispensación',
     'Solicitud urgente de piperacilina-tazobactam 4 g iv. Se verifica stock. Medicamento disponible en almacén de guardia.',
     'Se dispensa desde stock de guardia. Se anota salida. Se notifica a supervisora de UCI.',
     'Piperacilina-tazobactam 4 g vial', 'UCI - Planta 4',
     'alta', 'antibiótico, dispensación urgente, UCI',
     'farmaceutico1@farmacia.es', t(sab1, 2.5), t(sab1, 2.5),
     'farmaceutico1@farmacia.es', 'resuelta', '', false],

    // Parte 1 - incidencia 2
    ['INC-' + Utilities.formatDate(sab1,'Europe/Madrid','yyyyMMdd') + '-0002',
     id1, t(sab1, 5), 'Mezclas IV / Nutrición', 'Incidencia de mezclas / nutrición',
     'Solicitud de nutrición parenteral urgente para postquirúrgico en cirugía. Prescripción incompleta: falta volumen total.',
     'Contacto con médico prescriptor. Prescripción completada. Se elabora y envía nutrición parenteral a planta.',
     'Nutrición parenteral (aminoácidos + glucosa + lípidos)', 'Hospitalización - Cirugía 3ª planta',
     'alta', 'nutrición parenteral, prescripción incompleta, cirugía',
     'farmaceutico1@farmacia.es', t(sab1, 5.5), t(sab1, 5.5),
     'farmaceutico1@farmacia.es', 'resuelta',
     'Revisar protocolo de prescripción NP con cirugía. Pendiente reunión el lunes.', false],

    // Parte 1 - incidencia 3
    ['INC-' + Utilities.formatDate(sab1,'Europe/Madrid','yyyyMMdd') + '-0003',
     id1, t(sab1, 10), 'Gestión', 'Desabastecimiento',
     'Alerta de desabastecimiento de adrenalina 1 mg/ml ampollas. Stock actual: 8 unidades. Reposición prevista el lunes.',
     'Notificado a jefatura de servicio. Localizadas unidades adicionales en stock de urgencias como respaldo de emergencia. Alerta registrada.',
     'Adrenalina 1 mg/ml ampollas', 'Farmacia - Almacén central',
     'crítica', 'desabastecimiento, adrenalina, stock crítico, emergencia',
     'farmaceutico2@farmacia.es', t(sab1, 10.5), t(sab1, 10.5),
     'farmaceutico2@farmacia.es', 'abierta',
     'SEGUIMIENTO LUNES: confirmar llegada del pedido urgente y reponer stock.', false],

    // Parte 1 - incidencia 4
    ['INC-' + Utilities.formatDate(sab1,'Europe/Madrid','yyyyMMdd') + '-0004',
     id1, t(sab1, 14), 'Oncohematología', 'Incidencia oncohematológica',
     'Consulta sobre pauta de premedicación para administración de rituximab programada para el lunes. Médico solicita confirmación del protocolo vigente.',
     'Se consulta protocolo aprobado por comisión de farmacoterapia. Se confirma premedicación: paracetamol 1 g + difenhidramina 25 mg. Se envía confirmación por correo al médico.',
     'Rituximab, Paracetamol 1 g, Difenhidramina 25 mg', 'Oncohematología - Consultas externas',
     'media', 'rituximab, premedicación, oncología, consulta',
     'farmaceutico1@farmacia.es', t(sab1, 14.5), t(sab1, 14.5),
     'farmaceutico1@farmacia.es', 'resuelta', '', false],

    // Parte 2 - incidencia 1
    ['INC-' + Utilities.formatDate(sab2,'Europe/Madrid','yyyyMMdd') + '-0001',
     id2, t(sab2, 3), 'Unidosis', 'Propuesta de mejora',
     'El sistema de dispensación automatizada (Pyxis) reporta error al validar ficha de paciente. El equipo de enfermería debe solicitar medicación manualmente.',
     'Se atienden las solicitudes de forma manual durante el fin de semana. Se registra incidencia para notificar a informática el lunes.',
     '', 'Unidosis - Planta de medicina interna',
     'media', 'Pyxis, dispensación automatizada, incidencia informática',
     'tecnico1@farmacia.es', t(sab2, 3.5), t(sab2, 3.5),
     'tecnico1@farmacia.es', 'abierta',
     'Notificar a soporte informático el lunes. Solicitar revisión del sistema Pyxis.', false],

    // Parte 2 - incidencia 2
    ['INC-' + Utilities.formatDate(sab2,'Europe/Madrid','yyyyMMdd') + '-0002',
     id2, t(sab2, 8), 'Unidosis', 'Recordatorio',
     'Recordatorio: el lunes a primera hora revisar las devoluciones de medicación de la última semana antes de la sesión clínica.',
     'Anotado para gestión el lunes. Sin acción inmediata necesaria.',
     '', 'Farmacia - Unidosis',
     'baja', 'recordatorio, devoluciones, lunes',
     'tecnico1@farmacia.es', t(sab2, 8.5), t(sab2, 8.5),
     'tecnico1@farmacia.es', 'informativa', '', false]
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

// ── Catálogos accesibles desde cliente ────────────────────────────────────

function getCatalogos() {
  try {
    var data = getAllRaw(CONFIG.SHEETS.CATALOGOS);
    if (data.length <= 1) {
      return ok({
        Area:        CONFIG.AREAS,
        TipoEntrada: CONFIG.TIPOS_ENTRADA,
        Prioridad:   CONFIG.PRIORIDADES,
        TipoPeriodo: CONFIG.TIPOS_PERIODO
      });
    }
    var cat = {};
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[COLS.CATALOGOS.ACTIVO]) continue;
      var tipo = row[COLS.CATALOGOS.TIPO];
      if (!cat[tipo]) cat[tipo] = [];
      cat[tipo].push(row[COLS.CATALOGOS.VALOR]);
    }
    return ok(cat);
  } catch (e) {
    logErr('getCatalogos', e);
    return fail(e.message);
  }
}
