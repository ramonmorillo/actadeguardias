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
    filtros = filtros || {};
    var data = getAllRaw(CONFIG.SHEETS.INCIDENCIAS);
    if (data.length <= 1) return ok({ total: 0, totalPaginas: 0, pagina: 1, resultados: [] });

    // Pre-carga partes si se necesita filtrar por profesional de guardia
    var partesMap = {};
    if (filtros.profesionalGuardia) {
      var partesData = getAllRaw(CONFIG.SHEETS.PARTES);
      for (var p = 1; p < partesData.length; p++) {
        var pRow = partesData[p];
        if (pRow[COLS.PARTES.ID]) {
          partesMap[pRow[COLS.PARTES.ID]] = (pRow[COLS.PARTES.PROFESIONALES] || '').toLowerCase();
        }
      }
    }

    var resultados = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[COLS.INCIDENCIAS.ID]) continue;
      if (matchesFiltros(row, filtros, partesMap)) {
        resultados.push(rowToIncidencia(row));
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
      total:       total,
      totalPaginas: totalPags,
      pagina:      page,
      tamanyoPagina: pageSize,
      resultados:  paginated
    });
  } catch (e) {
    logErr('searchIncidencias', e);
    return fail(e.message);
  }
}

function matchesFiltros(row, f, partesMap) {
  // Texto libre: busca en descripcion, actuacion, medicamentos, servicio, etiquetas
  if (f.texto) {
    var txt = f.texto.toLowerCase();
    var haystack = [
      row[COLS.INCIDENCIAS.DESCRIPCION],
      row[COLS.INCIDENCIAS.ACTUACION],
      row[COLS.INCIDENCIAS.MEDICAMENTOS],
      row[COLS.INCIDENCIAS.SERVICIO],
      row[COLS.INCIDENCIAS.ETIQUETAS],
      row[COLS.INCIDENCIAS.SEGUIMIENTO]
    ].join(' ').toLowerCase();
    if (haystack.indexOf(txt) === -1) return false;
  }

  // Rango de fechas (sobre fechaEvento)
  if (f.fechaDesde || f.fechaHasta) {
    var fe = new Date(row[COLS.INCIDENCIAS.FECHA_EVENTO]);
    if (f.fechaDesde && fe < new Date(f.fechaDesde)) return false;
    if (f.fechaHasta) {
      var hasta = new Date(f.fechaHasta); hasta.setHours(23, 59, 59, 999);
      if (fe > hasta) return false;
    }
  }

  // Filtros exactos
  if (f.idParte     && row[COLS.INCIDENCIAS.ID_PARTE]    !== f.idParte)     return false;
  if (f.area        && row[COLS.INCIDENCIAS.AREA]         !== f.area)        return false;
  if (f.tipoEntrada && row[COLS.INCIDENCIAS.TIPO_ENTRADA] !== f.tipoEntrada) return false;
  if (f.prioridad   && row[COLS.INCIDENCIAS.PRIORIDAD]    !== f.prioridad)   return false;
  if (f.estado      && row[COLS.INCIDENCIAS.ESTADO]       !== f.estado)      return false;
  if (f.registradoPor && row[COLS.INCIDENCIAS.REGISTRADO_POR] !== f.registradoPor) return false;

  // Filtros parciales
  if (f.medicamento) {
    var med = (row[COLS.INCIDENCIAS.MEDICAMENTOS] || '').toLowerCase();
    if (med.indexOf(f.medicamento.toLowerCase()) === -1) return false;
  }
  if (f.servicio) {
    var srv = (row[COLS.INCIDENCIAS.SERVICIO] || '').toLowerCase();
    if (srv.indexOf(f.servicio.toLowerCase()) === -1) return false;
  }

  // Filtro por profesional de guardia del parte
  if (f.profesionalGuardia) {
    var profs = partesMap[row[COLS.INCIDENCIAS.ID_PARTE]] || '';
    if (profs.indexOf(f.profesionalGuardia.toLowerCase()) === -1) return false;
  }

  // Tiene adjuntos
  if (f.conAdjuntos   === true && !row[COLS.INCIDENCIAS.TIENE_ADJUNTOS]) return false;
  // Tiene texto de seguimiento pendiente
  if (f.conSeguimiento === true && !row[COLS.INCIDENCIAS.SEGUIMIENTO])   return false;

  return true;
}

/** Devuelve lista de IDs de partes para poblar el selector del buscador. */
function getPartesParaSelector() {
  try {
    var data = getAllRaw(CONFIG.SHEETS.PARTES);
    if (data.length <= 1) return ok([]);
    var list = data.slice(1)
      .filter(function(r) { return !!r[COLS.PARTES.ID]; })
      .map(function(r) {
        return {
          id:    r[COLS.PARTES.ID],
          label: r[COLS.PARTES.ID] + ' · ' +
                 formatDateShort(r[COLS.PARTES.FECHA_INICIO]) + ' – ' +
                 formatDateShort(r[COLS.PARTES.FECHA_FIN]) +
                 ' [' + r[COLS.PARTES.TIPO_PERIODO] + ']'
        };
      });
    list.sort(function(a, b) { return b.id.localeCompare(a.id); });
    return ok(list);
  } catch (e) {
    logErr('getPartesParaSelector', e);
    return fail(e.message);
  }
}
