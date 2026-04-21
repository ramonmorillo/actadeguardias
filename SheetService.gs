/**
 * Capa de acceso a datos sobre Google Sheets.
 * Todas las operaciones CRUD pasan por estas funciones.
 */

// ── Acceso a la hoja ───────────────────────────────────────────────────────

function getSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No hay hoja de cálculo activa. Abre el script desde la hoja.');
  return ss;
}

function getSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error(
      'Hoja "' + name + '" no encontrada. ' +
      'Ejecuta inicializarAplicacion() desde el editor de Apps Script.'
    );
  }
  return sheet;
}

// ── Lectura ────────────────────────────────────────────────────────────────

/**
 * Devuelve todas las filas (excepto cabecera) como array de objetos
 * usando los nombres de columna como claves.
 */
function getAllAsObjects(sheetName) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var lastCol = sheet.getLastColumn();
  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0];
  return data.slice(1).map(function(row, idx) {
    var obj = { _rowIndex: idx + 2 }; // 1-based sheet row (header = 1)
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/**
 * Devuelve todas las filas como arrays (sin transformar).
 * La primera fila (cabecera) está en índice 0.
 */
function getAllRaw(sheetName) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  return sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
}

/**
 * Busca la primera fila donde data[i][colIndex] === value.
 * @returns {{ row: any[], rowIndex: number }|null}
 */
function findRow(sheetName, colIndex, value) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  var data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][colIndex] === value) {
      return { row: data[i], rowIndex: i + 1 }; // 1-based
    }
  }
  return null;
}

// ── Escritura ──────────────────────────────────────────────────────────────

function appendRow(sheetName, rowData) {
  getSheet(sheetName).appendRow(rowData);
}

function updateRow(sheetName, rowIndex, rowData) {
  getSheet(sheetName).getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
}

function deleteRowByIndex(sheetName, rowIndex) {
  getSheet(sheetName).deleteRow(rowIndex);
}

function setCellValue(sheetName, rowIndex, colIndex, value) {
  // colIndex es base-0 aquí; getRange usa base-1
  getSheet(sheetName).getRange(rowIndex, colIndex + 1).setValue(value);
}

// ── Config key-value ───────────────────────────────────────────────────────

function getConfigValue(key) {
  var result = findRow(CONFIG.SHEETS.CONFIG, COLS.CONFIG.CLAVE, key);
  return result ? result.row[COLS.CONFIG.VALOR] : null;
}

function setConfigValue(key, value) {
  var result = findRow(CONFIG.SHEETS.CONFIG, COLS.CONFIG.CLAVE, key);
  if (result) {
    setCellValue(CONFIG.SHEETS.CONFIG, result.rowIndex, COLS.CONFIG.VALOR, value);
  } else {
    appendRow(CONFIG.SHEETS.CONFIG, [key, value, '']);
  }
}
