/**
 * Generación de informes entre dos fechas con filtros opcionales.
 * Soporta salida estructurada (para pantalla), CSV y HTML imprimible (PDF).
 */

/**
 * Genera el informe completo.
 * @param {Object} params  { fechaDesde, fechaHasta, area, tipoEntrada, prioridad,
 *                           registradoPor, medicamento }
 */
function generateInforme(params) {
  try {
    params = params || {};
    var desde = params.fechaDesde ? new Date(params.fechaDesde) : null;
    var hasta = params.fechaHasta ? new Date(params.fechaHasta) : null;
    if (hasta) hasta.setHours(23, 59, 59, 999);

    // ── Partes en el rango ──
    var partesRaw = getAllRaw(CONFIG.SHEETS.PARTES);
    var partes = [];
    var parteIds = {};
    for (var i = 1; i < partesRaw.length; i++) {
      var pr = partesRaw[i];
      if (!pr[COLS.PARTES.ID]) continue;
      var fi = new Date(pr[COLS.PARTES.FECHA_INICIO]);
      if (desde && fi < desde) continue;
      if (hasta && fi > hasta) continue;
      partes.push(rowToParte(pr));
      parteIds[pr[COLS.PARTES.ID]] = true;
    }

    // ── Incidencias en el rango + filtros ──
    var incRaw = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
    var incidencias = [];
    var porArea     = {};
    var porTipo     = {};
    var porPrioridad= {};
    var porEstado   = {};

    for (var j = 1; j < incRaw.length; j++) {
      var ir = incRaw[j];
      if (!ir[COLS.INCIDENCIAS.ID]) continue;

      var fe = new Date(ir[COLS.INCIDENCIAS.FECHA_EVENTO]);
      if (desde && fe < desde) continue;
      if (hasta && fe > hasta) continue;

      // Filtros opcionales
      if (params.area        && ir[COLS.INCIDENCIAS.AREA]        !== params.area)        continue;
      if (params.tipoEntrada && ir[COLS.INCIDENCIAS.TIPO_ENTRADA]!== params.tipoEntrada) continue;
      if (params.prioridad   && ir[COLS.INCIDENCIAS.PRIORIDAD]   !== params.prioridad)   continue;
      if (params.registradoPor && ir[COLS.INCIDENCIAS.REGISTRADO_POR] !== params.registradoPor) continue;
      if (params.medicamento) {
        var m = (ir[COLS.INCIDENCIAS.MEDICAMENTOS] || '').toLowerCase();
        if (m.indexOf(params.medicamento.toLowerCase()) === -1) continue;
      }

      incidencias.push(rowToIncidencia(ir));

      var a = ir[COLS.INCIDENCIAS.AREA]        || 'Sin área';
      var t = ir[COLS.INCIDENCIAS.TIPO_ENTRADA] || 'Sin tipo';
      var p = ir[COLS.INCIDENCIAS.PRIORIDAD]    || 'Sin prioridad';
      var e = ir[COLS.INCIDENCIAS.ESTADO]       || 'Sin estado';

      porArea[a]      = (porArea[a]      || 0) + 1;
      porTipo[t]      = (porTipo[t]      || 0) + 1;
      porPrioridad[p] = (porPrioridad[p] || 0) + 1;
      porEstado[e]    = (porEstado[e]    || 0) + 1;
    }

    incidencias.sort(function(a, b) { return new Date(a.fechaEvento) - new Date(b.fechaEvento); });

    return ok({
      generadoEn:       new Date().toISOString(),
      periodoDesde:     desde ? desde.toISOString() : null,
      periodoHasta:     hasta ? hasta.toISOString() : null,
      filtros:          params,
      totalPartes:      partes.length,
      totalIncidencias: incidencias.length,
      porArea:          porArea,
      porTipo:          porTipo,
      porPrioridad:     porPrioridad,
      porEstado:        porEstado,
      partes:           partes,
      incidencias:      incidencias
    });
  } catch (e) {
    logErr('generateInforme', e);
    return fail(e.message);
  }
}

/**
 * Exporta las incidencias del informe como CSV (string).
 */
function exportInformeCSV(params) {
  try {
    var r = generateInforme(params);
    if (!r.success) return r;

    var esc = function(v) {
      if (v === null || v === undefined) return '';
      var s = v.toString().replace(/"/g, '""');
      return (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
        ? '"' + s + '"' : s;
    };

    var headers = [
      'ID','IDParte','FechaEvento','Área','TipoEntrada',
      'Descripción','Actuación','Medicamentos','Servicio',
      'Prioridad','Estado','RegistradoPor','FechaRegistro','Seguimiento'
    ];

    var lines = [headers.map(esc).join(',')];

    r.data.incidencias.forEach(function(inc) {
      lines.push([
        inc.id, inc.idParte,
        inc.fechaEvento ? formatDateTime(new Date(inc.fechaEvento)) : '',
        inc.area, inc.tipoEntrada,
        inc.descripcion, inc.actuacion, inc.medicamentos, inc.servicio,
        inc.prioridad, inc.estado, inc.registradoPor,
        inc.fechaRegistro ? formatDateTime(new Date(inc.fechaRegistro)) : '',
        inc.seguimiento
      ].map(esc).join(','));
    });

    return ok({ csv: '﻿' + lines.join('\r\n') }); // BOM para Excel
  } catch (e) {
    logErr('exportInformeCSV', e);
    return fail(e.message);
  }
}

/**
 * Genera el HTML imprimible del informe (para PDF via ventana de impresión).
 */
function getInformeHTML(params) {
  try {
    var r = generateInforme(params);
    if (!r.success) return r;
    var d = r.data;

    var fmtDate = function(iso) {
      if (!iso) return '—';
      return formatDateTime(new Date(iso));
    };

    var badgePrioridad = function(p) {
      var map = { baja: '#28a745', media: '#ffc107', alta: '#fd7e14', 'crítica': '#dc3545' };
      var color = map[p] || '#6c757d';
      return '<span style="background:' + color + ';color:#fff;padding:2px 6px;border-radius:3px;font-size:11px">' + (p || '—') + '</span>';
    };

    var rows = d.incidencias.map(function(inc) {
      return '<tr>' +
        '<td>' + fmtDate(inc.fechaEvento)    + '</td>' +
        '<td>' + (inc.area || '—')           + '</td>' +
        '<td>' + (inc.tipoEntrada || '—')    + '</td>' +
        '<td>' + (inc.descripcion || '—')    + '</td>' +
        '<td>' + (inc.actuacion || '—')      + '</td>' +
        '<td>' + (inc.medicamentos || '—')   + '</td>' +
        '<td>' + (inc.servicio || '—')       + '</td>' +
        '<td>' + badgePrioridad(inc.prioridad) + '</td>' +
        '<td>' + (inc.estado || '—')         + '</td>' +
        '<td>' + (inc.registradoPor || '—')  + '</td>' +
        '<td>' + (inc.idParte || '—')        + '</td>' +
      '</tr>';
    }).join('');

    var desglose = function(obj) {
      return Object.keys(obj).map(function(k) {
        return '<li>' + k + ': <strong>' + obj[k] + '</strong></li>';
      }).join('');
    };

    var html =
      '<!DOCTYPE html><html lang="es"><head>' +
      '<meta charset="UTF-8"><title>Informe de Guardias</title>' +
      '<style>' +
        'body{font-family:Arial,sans-serif;font-size:12px;margin:20px}' +
        'h1{font-size:18px;color:#1a73e8}' +
        'h2{font-size:14px;color:#444;margin-top:20px}' +
        'table{width:100%;border-collapse:collapse;margin-top:10px}' +
        'th{background:#1a73e8;color:#fff;padding:6px;text-align:left;font-size:11px}' +
        'td{padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;vertical-align:top}' +
        'tr:nth-child(even){background:#f8f9fa}' +
        '.resumen{display:flex;gap:20px;flex-wrap:wrap;margin:15px 0}' +
        '.kpi{background:#f1f3f4;border-radius:6px;padding:12px 20px;min-width:100px}' +
        '.kpi-n{font-size:28px;font-weight:bold;color:#1a73e8}' +
        '.kpi-l{font-size:11px;color:#666}' +
        'ul{margin:5px 0;padding-left:18px}' +
        '@media print{button{display:none}}' +
      '</style></head><body>' +
      '<h1>Informe de Guardias · Farmacia Hospitalaria</h1>' +
      '<p>Periodo: <strong>' + fmtDate(d.periodoDesde) + '</strong> — <strong>' + fmtDate(d.periodoHasta) + '</strong></p>' +
      '<p>Generado el ' + fmtDate(d.generadoEn) + '</p>' +
      '<div class="resumen">' +
        '<div class="kpi"><div class="kpi-n">' + d.totalPartes + '</div><div class="kpi-l">Partes</div></div>' +
        '<div class="kpi"><div class="kpi-n">' + d.totalIncidencias + '</div><div class="kpi-l">Incidencias</div></div>' +
      '</div>' +
      '<h2>Desglose por área</h2><ul>' + desglose(d.porArea) + '</ul>' +
      '<h2>Desglose por tipo</h2><ul>' + desglose(d.porTipo) + '</ul>' +
      '<h2>Listado cronológico de incidencias</h2>' +
      '<table><thead><tr>' +
        '<th>Fecha evento</th><th>Área</th><th>Tipo</th><th>Descripción</th>' +
        '<th>Actuación</th><th>Medicamentos</th><th>Servicio</th>' +
        '<th>Prioridad</th><th>Estado</th><th>Registrado por</th><th>Parte</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '</body></html>';

    return ok({ html: html });
  } catch (e) {
    logErr('getInformeHTML', e);
    return fail(e.message);
  }
}
