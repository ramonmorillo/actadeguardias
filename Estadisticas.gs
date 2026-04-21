/**
 * Cálculo de estadísticas para la pestaña de análisis.
 */

/**
 * Devuelve todas las estadísticas necesarias para los gráficos.
 * @param {Object} params  { fechaDesde?, fechaHasta? }
 */
function getEstadisticas(params) {
  try {
    var schemaInc = getIncidenciasSchema();
    var schemaPartes = getPartesSchema();
    params = params || {};
    var desde = params.fechaDesde ? new Date(params.fechaDesde) : null;
    var hasta = params.fechaHasta ? new Date(params.fechaHasta) : null;
    if (hasta) hasta.setHours(23, 59, 59, 999);

    var data = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);

    var porArea       = {};
    var porTipo       = {};
    var porPrioridad  = {};
    var porEstado     = {};
    var porProfesional= {};
    var medicamentos  = {};
    var porMes        = {};
    var total = 0, abiertas = 0, resueltas = 0, criticas = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!rowVal(row, schemaInc.ID)) continue;

      var fe = new Date(rowVal(row, schemaInc.FECHA_EVENTO));
      if (desde && fe < desde) continue;
      if (hasta && fe > hasta) continue;

      total++;

      var area = rowVal(row, schemaInc.AREA)          || 'Sin área';
      var tipo = rowVal(row, schemaInc.TIPO_ENTRADA)  || 'Sin tipo';
      var prio = rowVal(row, schemaInc.PRIORIDAD)     || 'Sin prioridad';
      var est  = rowVal(row, schemaInc.ESTADO)        || 'Sin estado';
      var prof = rowVal(row, schemaInc.REGISTRADO_POR)|| 'Desconocido';

      porArea[area]        = (porArea[area]        || 0) + 1;
      porTipo[tipo]        = (porTipo[tipo]        || 0) + 1;
      porPrioridad[prio]   = (porPrioridad[prio]   || 0) + 1;
      porEstado[est]       = (porEstado[est]       || 0) + 1;
      porProfesional[prof] = (porProfesional[prof] || 0) + 1;

      if (est  === 'abierta')  abiertas++;
      if (est  === 'resuelta') resueltas++;
      if (prio === 'crítica')  criticas++;

      // Medicamentos (separados por coma)
      var meds = (rowVal(row, schemaInc.MEDICAMENTOS) || '').split(',');
      meds.forEach(function(m) {
        m = m.trim();
        if (m) medicamentos[m] = (medicamentos[m] || 0) + 1;
      });

      // Evolución mensual
      var mesKey = Utilities.formatDate(fe, 'Europe/Madrid', 'yyyy-MM');
      porMes[mesKey] = (porMes[mesKey] || 0) + 1;
    }

    // Ordenar y limitar medicamentos top
    var medArray = sortDesc(medicamentos).slice(0, 15);

    // Top profesionales
    var profArray = sortDesc(porProfesional).slice(0, 10);

    // Meses ordenados cronológicamente
    var mesesArray = Object.keys(porMes).sort().map(function(k) {
      return { etiqueta: k, valor: porMes[k] };
    });

    // Estadísticas de partes en el mismo periodo
    var partesData = getAllRaw(CONFIG.SHEETS.PARTES);
    var totalPartes = 0;
    for (var p = 1; p < partesData.length; p++) {
      if (!rowVal(partesData[p], schemaPartes.ID)) continue;
      var fp = new Date(rowVal(partesData[p], schemaPartes.FECHA_INICIO));
      if (desde && fp < desde) continue;
      if (hasta && fp > hasta) continue;
      totalPartes++;
    }

    return ok({
      total:          total,
      totalPartes:    totalPartes,
      abiertas:       abiertas,
      resueltas:      resueltas,
      criticas:       criticas,
      porArea:        porArea,
      porTipo:        porTipo,
      porPrioridad:   porPrioridad,
      porEstado:      porEstado,
      medicamentosFrecuentes:  medArray,
      profesionalesMasActivos: profArray,
      evolucionMensual:        mesesArray
    });
  } catch (e) {
    logErr('getEstadisticas', e);
    return fail(e.message);
  }
}

function sortDesc(obj) {
  return Object.keys(obj)
    .map(function(k) { return { etiqueta: k, valor: obj[k] }; })
    .sort(function(a, b) { return b.valor - a.valor; });
}
