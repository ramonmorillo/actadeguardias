/**
 * Generación de informes organizados por Parte de Guardia.
 * Cada parte aparece con sus datos completos y sus incidencias anidadas.
 * Los partes sin incidencias también se incluyen en el informe.
 */

/**
 * Genera el informe completo organizado por parte.
 * @param {Object} params  { fechaDesde, fechaHasta, area?, tipoEntrada?,
 *                           prioridad?, registradoPor?, medicamento? }
 * @returns {Object}  ok({ totalPartes, totalIncidencias, porArea, porTipo,
 *                          porPrioridad, porEstado, partesConIncidencias })
 */
function generateInforme(params) {
  try {
    params = params || {};
    var desde = params.fechaDesde ? new Date(params.fechaDesde) : null;
    var hasta  = params.fechaHasta ? new Date(params.fechaHasta) : null;
    if (hasta) hasta.setHours(23, 59, 59, 999);

    // ── 1. Partes en el rango (filtrados por FechaInicio) ─────────────────
    var partesRaw  = getAllRaw(CONFIG.SHEETS.PARTES);
    var partes     = [];
    var parteIdSet = {};  // lookup rápido

    for (var i = 1; i < partesRaw.length; i++) {
      var pr = partesRaw[i];
      if (!pr[COLS.PARTES.ID]) continue;
      var fi = new Date(pr[COLS.PARTES.FECHA_INICIO]);
      if (desde && fi < desde) continue;
      if (hasta && fi > hasta) continue;
      var parteObj = rowToParte(pr);
      partes.push(parteObj);
      parteIdSet[parteObj.id] = true;
    }

    // Ordenar partes cronológicamente (inicio más antiguo primero)
    partes.sort(function(a, b) {
      return new Date(a.fechaInicio) - new Date(b.fechaInicio);
    });

    // ── 2. Inicializar mapa incidencias por parte (incluye partes vacíos) ─
    var incByParte = {};
    partes.forEach(function(p) { incByParte[p.id] = []; });

    // ── 3. Incidencias filtradas, agrupadas por parte ─────────────────────
    var incRaw         = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
    var totalIncidencias = 0;
    var porArea        = {};
    var porTipo        = {};
    var porPrioridad   = {};
    var porEstado      = {};

    for (var j = 1; j < incRaw.length; j++) {
      var ir = incRaw[j];
      if (!ir[COLS.INCIDENCIAS.ID]) continue;

      // Solo incidencias cuyo parte esté en el rango seleccionado
      var idParte = ir[COLS.INCIDENCIAS.ID_PARTE];
      if (!parteIdSet[idParte]) continue;

      // Filtros opcionales sobre incidencias
      if (params.area         && ir[COLS.INCIDENCIAS.AREA]           !== params.area)         continue;
      if (params.tipoEntrada  && ir[COLS.INCIDENCIAS.TIPO_ENTRADA]   !== params.tipoEntrada)  continue;
      if (params.prioridad    && ir[COLS.INCIDENCIAS.PRIORIDAD]      !== params.prioridad)    continue;
      if (params.registradoPor && ir[COLS.INCIDENCIAS.REGISTRADO_POR] !== params.registradoPor) continue;
      if (params.medicamento) {
        var m = (ir[COLS.INCIDENCIAS.MEDICAMENTOS] || '').toLowerCase();
        if (m.indexOf(params.medicamento.toLowerCase()) === -1) continue;
      }

      var inc = rowToIncidencia(ir);
      if (!incByParte[idParte]) incByParte[idParte] = [];
      incByParte[idParte].push(inc);
      totalIncidencias++;

      // Agregados para el resumen
      var a = ir[COLS.INCIDENCIAS.AREA]         || 'Sin área';
      var t = ir[COLS.INCIDENCIAS.TIPO_ENTRADA] || 'Sin tipo';
      var p = ir[COLS.INCIDENCIAS.PRIORIDAD]    || 'Sin prioridad';
      var e = ir[COLS.INCIDENCIAS.ESTADO]       || 'Sin estado';
      porArea[a]      = (porArea[a]      || 0) + 1;
      porTipo[t]      = (porTipo[t]      || 0) + 1;
      porPrioridad[p] = (porPrioridad[p] || 0) + 1;
      porEstado[e]    = (porEstado[e]    || 0) + 1;
    }

    // ── 4. Construir estructura final: cada parte con sus incidencias ──────
    var partesConIncidencias = partes.map(function(parte) {
      var incs = incByParte[parte.id] || [];
      incs.sort(function(a, b) { return new Date(a.fechaEvento) - new Date(b.fechaEvento); });
      return {
        parte:          parte,
        incidencias:    incs,
        numIncidencias: incs.length
      };
    });

    return ok({
      generadoEn:           new Date().toISOString(),
      periodoDesde:         desde ? desde.toISOString() : null,
      periodoHasta:         hasta  ? hasta.toISOString()  : null,
      filtros:              params,
      totalPartes:          partes.length,
      totalIncidencias:     totalIncidencias,
      porArea:              porArea,
      porTipo:              porTipo,
      porPrioridad:         porPrioridad,
      porEstado:            porEstado,
      partesConIncidencias: partesConIncidencias
    });
  } catch (e) {
    logErr('generateInforme', e);
    return fail(e.message);
  }
}

/**
 * Exporta el informe como CSV.
 * Una fila por incidencia con los datos del parte repetidos en cada fila.
 * Los partes sin incidencias aparecen igualmente con una fila marcada.
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
      'ID_Parte', 'Periodo_Inicio', 'Periodo_Fin', 'Tipo_Periodo', 'Profesionales',
      'Estado_Parte', 'Creado_Por', 'Observaciones_Parte',
      'ID_Incidencia', 'Fecha_Evento', 'Área', 'Tipo_Entrada',
      'Descripción', 'Actuación', 'Medicamentos', 'Servicio_Ubicación',
      'Prioridad', 'Estado_Incidencia', 'Registrado_Por', 'Fecha_Registro', 'Seguimiento'
    ];

    var lines = [headers.map(esc).join(',')];

    r.data.partesConIncidencias.forEach(function(item) {
      var p = item.parte;
      var parteBase = [
        p.id,
        p.fechaInicio ? formatDateTime(new Date(p.fechaInicio)) : '',
        p.fechaFin    ? formatDateTime(new Date(p.fechaFin))    : '',
        p.tipoPeriodo  || '',
        p.profesionales || '',
        p.estado        || '',
        p.creadoPor     || '',
        p.observaciones || ''
      ];

      if (item.incidencias.length === 0) {
        // Parte sin incidencias: una fila con campos de incidencia vacíos
        lines.push(parteBase.concat([
          '(sin incidencias)', '', '', '', '', '', '', '', '', '', ''
        ]).map(esc).join(','));
      } else {
        item.incidencias.forEach(function(inc) {
          lines.push(parteBase.concat([
            inc.id,
            inc.fechaEvento   ? formatDateTime(new Date(inc.fechaEvento))   : '',
            inc.area           || '',
            inc.tipoEntrada    || '',
            inc.descripcion    || '',
            inc.actuacion      || '',
            inc.medicamentos   || '',
            inc.servicio       || '',
            inc.prioridad      || '',
            inc.estado         || '',
            inc.registradoPor  || '',
            inc.fechaRegistro  ? formatDateTime(new Date(inc.fechaRegistro)) : '',
            inc.seguimiento    || ''
          ]).map(esc).join(','));
        });
      }
    });

    return ok({ csv: '﻿' + lines.join('\r\n') }); // BOM para compatibilidad con Excel
  } catch (e) {
    logErr('exportInformeCSV', e);
    return fail(e.message);
  }
}

/**
 * Genera el HTML imprimible del informe (organizado por parte, para PDF).
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

    var fmtDateS = function(iso) {
      if (!iso) return '—';
      return formatDateShort(new Date(iso));
    };

    var colorPrio = function(p) {
      var map = { baja: '#34a853', media: '#fbbc04', alta: '#fa7b17', 'crítica': '#ea4335' };
      return map[p] || '#9e9e9e';
    };

    var badgePrioHTML = function(p) {
      return '<span style="background:' + colorPrio(p) + ';color:#fff;' +
             'padding:2px 7px;border-radius:3px;font-size:10px;font-weight:600">' +
             (p || '—') + '</span>';
    };

    var badgeEstadoHTML = function(e) {
      var map = {
        borrador: '#9e9e9e', cerrado: '#3c4043',
        abierta: '#fbbc04', resuelta: '#34a853',
        informativa: '#4285f4', cerrada: '#9e9e9e'
      };
      var col = map[e] || '#9e9e9e';
      var txt = (e === 'abierta' || e === 'media') ? '#202124' : '#fff';
      return '<span style="background:' + col + ';color:' + txt + ';' +
             'padding:2px 7px;border-radius:3px;font-size:10px">' +
             (e || '—') + '</span>';
    };

    // Desglose por área y tipo
    var desgloseHTML = function(titulo, obj) {
      var items = Object.keys(obj).map(function(k) {
        return '<li><strong>' + obj[k] + '</strong> ' + k + '</li>';
      }).join('');
      return '<div style="margin-bottom:12px"><strong>' + titulo + '</strong><ul style="margin:4px 0;padding-left:18px">' +
             (items || '<li style="color:#888">Sin datos</li>') + '</ul></div>';
    };

    // Bloque de cada parte
    var partesHTML = d.partesConIncidencias.map(function(item, idx) {
      var p = item.parte;
      var incidencias = item.incidencias;

      // Tabla de incidencias del parte
      var incidenciasHTML;
      if (!incidencias.length) {
        incidenciasHTML =
          '<p style="color:#888;font-style:italic;margin:8px 0 0 0;font-size:11px">' +
          '<i>Sin incidencias registradas en este parte.</i></p>';
      } else {
        var filas = incidencias.map(function(inc) {
          return '<tr>' +
            '<td>' + fmtDate(inc.fechaEvento)       + '</td>' +
            '<td>' + (inc.area          || '—')     + '</td>' +
            '<td>' + (inc.tipoEntrada   || '—')     + '</td>' +
            '<td>' + (inc.descripcion   || '—')     + '</td>' +
            '<td>' + (inc.actuacion     || '—')     + '</td>' +
            '<td>' + (inc.medicamentos  || '—')     + '</td>' +
            '<td>' + (inc.servicio      || '—')     + '</td>' +
            '<td>' + badgePrioHTML(inc.prioridad)   + '</td>' +
            '<td>' + badgeEstadoHTML(inc.estado)    + '</td>' +
            '<td>' + (inc.registradoPor || '—')     + '</td>' +
            (inc.seguimiento ? '<td><em>' + inc.seguimiento + '</em></td>' : '<td>—</td>') +
          '</tr>';
        }).join('');

        incidenciasHTML =
          '<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:10px">' +
          '<thead><tr style="background:#e8f0fe">' +
            '<th>Fecha</th><th>Área</th><th>Tipo</th><th>Descripción</th>' +
            '<th>Actuación</th><th>Medicamentos</th><th>Servicio</th>' +
            '<th>Prioridad</th><th>Estado</th><th>Registrado por</th><th>Seguimiento</th>' +
          '</tr></thead><tbody>' + filas + '</tbody></table>';
      }

      var estadoColor = (p.estado === 'cerrado') ? '#3c4043' : '#e8a000';

      return '<div style="page-break-inside:avoid;margin-bottom:20px;border:1px solid #dadce0;border-radius:6px;overflow:hidden">' +
        // Cabecera del parte
        '<div style="background:#e8f0fe;padding:8px 12px;border-bottom:1px solid #c5d5f5">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
            '<div>' +
              '<span style="font-size:11px;color:#5f6368;font-weight:600">PARTE ' + (idx + 1) + ' · </span>' +
              '<strong style="font-size:12px;color:#1a73e8">' + p.id + '</strong>' +
              ' <span style="font-size:10px;padding:2px 7px;border-radius:3px;background:' + estadoColor + ';color:#fff;margin-left:6px">' + (p.estado||'—') + '</span>' +
            '</div>' +
            '<div style="font-size:10px;color:#5f6368">' +
              fmtDateS(p.fechaInicio) + ' → ' + fmtDateS(p.fechaFin) + ' · ' + (p.tipoPeriodo||'—') +
            '</div>' +
          '</div>' +
          '<div style="margin-top:4px;font-size:10px;color:#3c4043">' +
            '<strong>Profesionales:</strong> ' + (p.profesionales || 'No indicados') +
          '</div>' +
          (p.observaciones
            ? '<div style="margin-top:4px;font-size:10px;color:#3c4043;font-style:italic">' +
              '<strong>Observaciones:</strong> ' + p.observaciones + '</div>'
            : '') +
          '<div style="margin-top:4px;font-size:10px;color:#888">' +
            'Creado por: ' + (p.creadoPor||'—') + ' · ' + fmtDate(p.fechaCreacion) +
            ' | ' + item.numIncidencias + ' incidencia' + (item.numIncidencias !== 1 ? 's' : '') +
          '</div>' +
        '</div>' +
        // Incidencias del parte
        '<div style="padding:8px 12px">' +
          incidenciasHTML +
        '</div>' +
      '</div>';
    }).join('');

    var resumenHtml = '';
    if (Object.keys(d.porArea).length) resumenHtml += desgloseHTML('Por área', d.porArea);
    if (Object.keys(d.porTipo).length) resumenHtml += desgloseHTML('Por tipo de entrada', d.porTipo);

    var html =
      '<!DOCTYPE html><html lang="es"><head>' +
      '<meta charset="UTF-8"><title>Informe de Guardias</title>' +
      '<style>' +
        'body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#202124}' +
        'h1{font-size:18px;color:#1a73e8;margin-bottom:4px}' +
        'h2{font-size:13px;color:#444;margin:16px 0 8px}' +
        'table thead th{padding:5px 6px;text-align:left;font-size:10px;font-weight:600}' +
        'table tbody td{padding:4px 6px;border-bottom:1px solid #f1f3f4;vertical-align:top}' +
        'table tbody tr:nth-child(even){background:#f8f9fa}' +
        '.kpi-row{display:flex;gap:16px;margin:12px 0;flex-wrap:wrap}' +
        '.kpi{background:#f1f3f4;border-radius:6px;padding:10px 16px;min-width:90px}' +
        '.kpi-n{font-size:24px;font-weight:700;color:#1a73e8}' +
        '.kpi-l{font-size:10px;color:#666}' +
        '@media print{button{display:none!important}}' +
      '</style></head><body>' +
      '<h1>Informe de Guardias · Farmacia Hospitalaria</h1>' +
      '<p style="color:#5f6368;font-size:11px">' +
        'Periodo: <strong>' + fmtDateS(d.periodoDesde) + '</strong> — <strong>' + fmtDateS(d.periodoHasta) + '</strong>' +
        ' &nbsp;·&nbsp; Generado el ' + fmtDate(d.generadoEn) +
      '</p>' +
      '<div class="kpi-row">' +
        '<div class="kpi"><div class="kpi-n">' + d.totalPartes + '</div><div class="kpi-l">Partes</div></div>' +
        '<div class="kpi"><div class="kpi-n">' + d.totalIncidencias + '</div><div class="kpi-l">Incidencias</div></div>' +
      '</div>' +
      (resumenHtml ? '<h2>Resumen</h2><div style="display:flex;gap:24px;flex-wrap:wrap">' + resumenHtml + '</div>' : '') +
      '<h2>Partes de guardia</h2>' +
      (partesHTML || '<p style="color:#888">Sin partes en el periodo seleccionado.</p>') +
      '</body></html>';

    return ok({ html: html });
  } catch (e) {
    logErr('getInformeHTML', e);
    return fail(e.message);
  }
}
