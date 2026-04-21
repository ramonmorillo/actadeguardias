/**
 * Acta de Guardias - Farmacia Hospitalaria
 * Punto de entrada de la aplicación web (doGet) y función include para plantillas.
 */

function doGet(e) {
  try {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Guardias · Farmacia')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<h2 style="font-family:sans-serif;color:#c00">Error al cargar la aplicación</h2>' +
      '<p>' + err.message + '</p>' +
      '<p>Comprueba que has ejecutado <b>inicializarAplicacion()</b> desde el editor de Apps Script.</p>'
    );
  }
}

/** Permite incluir archivos HTML desde plantillas con <?!= include('nombre') ?> */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Inicializa la hoja de cálculo con todas las hojas necesarias y datos de ejemplo.
 * Ejecutar UNA SOLA VEZ desde el editor de Apps Script antes del primer despliegue.
 */
function inicializarAplicacion() {
  setupSpreadsheet();
  addSampleData();
  return { success: true, mensaje: 'Aplicación inicializada correctamente. Ya puedes desplegar la web app.' };
}
