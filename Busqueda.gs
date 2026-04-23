/**
 * Búsqueda avanzada de incidencias con múltiples filtros y paginación.
 */

/**
 * Busca incidencias aplicando todos los filtros disponibles.
 *
 * Filtros admitidos (todos opcionales):
 *   texto, fechaDesde, fechaHasta, idParte, area, tipoEntrada,
 *   medicamento, servicio, prioridad, estado, registradoPor,
 *   profesionalGuardia (busca en partes), conAdjuntos,
 *   page (default 1), pageSize (default 25)
 */
function searchIncidencias(filtros) {
  try {
    var schemaInc = getIncidenciasSchema();
    filtros = filtros || {};
    var data = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
    if (data.length <= 1) return ok({ total: 0, totalSinFiltros: 0, totalPaginas: 0, pagina: 1, resultados: [] });

    // Contar filas válidas (para distinguir "hoja vacía" de "filtros demasiado estrictos")
    var totalSinFiltros = 0;
    for (var c = 1; c < data.length; c++) {
      if (rowVal(data[c], schemaInc.ID)) totalSinFiltros++;
    }

    // Pre-carga partes solo si se filtra por profesional de guardia
    var partesMap = {};
    if (filtros.profesionalGuardia) {
      var schemaPartes = getPartesSchema();
      var partesData = getAllRaw(CONFIG.SHEETS.PARTES);
      for (var p = 1; p < partesData.length; p++) {
        var pRow = partesData[p];
        if (rowVal(pRow, schemaPartes.ID)) {
          var normalizadas = normalizarSeparacionProfesionalesYAreas(
            rowVal(pRow, schemaPartes.PROFESIONALES),
            rowVal(pRow, schemaPartes.AREAS_IMPLICADAS)
          );
          partesMap[normalizeIdKey(rowVal(pRow, schemaPartes.ID))] = normalizadas.profesionales.map(function(v) {
            return v.toLowerCase();
          });
        }
      }
    }

    var resultados = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!rowVal(row, schemaInc.ID)) continue;
      if (matchesFiltros(row, filtros, partesMap, schemaInc)) {
        resultados.push(rowToIncidencia(row, schemaInc));
      }
    }

    // Ordenar por fecha de evento descendente
    resultados.sort(function(a, b) {
      return new Date(b.fechaEvento) - new Date(a.fechaEvento);
    });

    var total      = resultados.length;
    var pageSize   = Math.min(parseInt(filtros.pageSize) || 25, 100);
    var page       = Math.max(parseInt(filtros.page) || 1, 1);
    var totalPags  = Math.ceil(total / pageSize);
    var start      = (page - 1) * pageSize;
    var paginated  = resultados.slice(start, start + pageSize);

    return ok({
      total:          total,
      totalSinFiltros: totalSinFiltros,
      totalPaginas:   totalPags,
      pagina:         page,
      tamanyoPagina:  pageSize,
      resultados:     paginated
    });
  } catch (e) {
    logErr('searchIncidencias', e);
    return fail(e.message);
  }
}

function matchesFiltros(row, f, partesMap, schemaInc) {
  // Texto libre: busca en descripcion, actuacion, medicamentos, servicio, etiquetas
  if (f.texto) {
    var txt = f.texto.toLowerCase();
    var haystack = [
      rowVal(row, schemaInc.DESCRIPCION),
      rowVal(row, schemaInc.ACTUACION),
      rowVal(row, schemaInc.MEDICAMENTOS),
      rowVal(row, schemaInc.SERVICIO),
      rowVal(row, schemaInc.ETIQUETAS),
      rowVal(row, schemaInc.SEGUIMIENTO)
    ].join(' ').toLowerCase();
    if (haystack.indexOf(txt) === -1) return false;
  }

  // Rango de fechas (sobre fechaEvento)
  if (f.fechaDesde || f.fechaHasta) {
    var fe = new Date(rowVal(row, schemaInc.FECHA_EVENTO));
    if (f.fechaDesde && fe < new Date(f.fechaDesde)) return false;
    if (f.fechaHasta) {
      var hasta = new Date(f.fechaHasta); hasta.setHours(23, 59, 59, 999);
      if (fe > hasta) return false;
    }
  }

  // Filtros exactos
  if (f.idParte     && rowVal(row, schemaInc.ID_PARTE)       !== f.idParte)       return false;
  if (f.area        && rowVal(row, schemaInc.AREA)           !== f.area)          return false;
  if (f.tipoEntrada && rowVal(row, schemaInc.TIPO_ENTRADA)   !== f.tipoEntrada)   return false;
  if (f.prioridad   && rowVal(row, schemaInc.PRIORIDAD)      !== f.prioridad)     return false;
  if (f.estado      && rowVal(row, schemaInc.ESTADO)         !== f.estado)        return false;
  // Filtros parciales
  if (f.registradoPor) {
    var regPor = (rowVal(row, schemaInc.REGISTRADO_POR) || '').toLowerCase();
    if (regPor.indexOf(f.registradoPor.toLowerCase()) === -1) return false;
  }
  if (f.medicamento) {
    var med = (rowVal(row, schemaInc.MEDICAMENTOS) || '').toLowerCase();
    if (med.indexOf(f.medicamento.toLowerCase()) === -1) return false;
  }
  if (f.servicio) {
    var srv = (rowVal(row, schemaInc.SERVICIO) || '').toLowerCase();
    if (srv.indexOf(f.servicio.toLowerCase()) === -1) return false;
  }

  // Filtro por profesional de guardia del parte
  if (f.profesionalGuardia) {
    var profs = partesMap[normalizeIdKey(rowVal(row, schemaInc.ID_PARTE))] || [];
    var q = f.profesionalGuardia.toLowerCase();
    var found = profs.some(function(p) { return p.indexOf(q) !== -1; });
    if (!found) return false;
  }

  // Tiene adjuntos
  if (f.conAdjuntos   === true && !rowVal(row, schemaInc.TIENE_ADJUNTOS)) return false;
  // Tiene texto de seguimiento pendiente
  if (f.conSeguimiento === true && !rowVal(row, schemaInc.SEGUIMIENTO))   return false;

  return true;
}

/** Devuelve lista de IDs de partes para poblar el selector del buscador. */
function getPartesParaSelector() {
  try {
    var schemaPartes = getPartesSchema();
    var data = getAllRaw(CONFIG.SHEETS.PARTES);
    if (data.length <= 1) return ok([]);
    var list = data.slice(1)
      .filter(function(r) { return !!rowVal(r, schemaPartes.ID); })
      .map(function(r) {
        return {
          id:    rowVal(r, schemaPartes.ID),
          label: rowVal(r, schemaPartes.ID) + ' · ' +
                 formatDateShort(rowVal(r, schemaPartes.FECHA_INICIO)) + ' – ' +
                 formatDateShort(rowVal(r, schemaPartes.FECHA_FIN)) +
                 ' [' + rowVal(r, schemaPartes.TIPO_PERIODO) + ']'
        };
      });
    list.sort(function(a, b) { return b.id.localeCompare(a.id); });
    return ok(list);
  } catch (e) {
    logErr('getPartesParaSelector', e);
    return fail(e.message);
  }
}
