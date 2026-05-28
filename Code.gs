/**
 * GO Nat — Google Apps Script Backend
 * Escribe tareas en la hoja "Tareas_Completas" con columnas:
 * ID | Inicio | Tarea | Prioridad | SubPrioridad | Entrega | Estado | Progreso | Notas
 *
 * SETUP:
 * 1. script.google.com → proyecto GoNat Sync
 * 2. Reemplaza Code.gs con este archivo
 * 3. Deploy → New deployment → Web app → Execute as: Me → Access: Anyone
 * 4. Copia la URL al app.js (GAS_URL)
 */

var SPREADSHEET_ID = '1r6XM2SkKyLKN9R3JWlBs4wsvjjVunE4WNEkmIBwFV7E';
var SHEET_NAME     = 'Tareas_Completas';
var HEADERS        = ['ID', 'Inicio', 'Tarea', 'Prioridad', 'SubPrioridad', 'Entrega', 'Estado', 'Progreso', 'Notas'];

function doGet(e) {
  var action = (e.parameter && e.parameter.action) || 'read';

  if (action === 'set')    return doGetSet(e);
  if (action === 'delete') return doGetDelete(e);

  try {
    var sheet   = getSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return buildResponse([]);

    var data   = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    var result = data
      .filter(function(r) { return r[0]; })
      .map(function(r) {
        return {
          id:           r[0],
          inicio:       r[1],
          tarea:        r[2],
          prioridad:    r[3],
          subprioridad: r[4],
          entrega:      r[5],
          estado:       r[6],
          progreso:     r[7],
          notas:        r[8]
        };
      });

    return buildResponse(result);
  } catch (err) {
    return buildResponse({ error: err.message });
  }
}

function doGetSet(e) {
  try {
    var id        = e.parameter.id          || '';
    var tarea     = e.parameter.tarea       || '';
    var prioridad = e.parameter.prioridad   || '';
    var subprio   = e.parameter.subprioridad || '';
    var estado    = e.parameter.estado      || 'pendiente';
    var inicio    = e.parameter.inicio      || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var entrega   = e.parameter.entrega     || '';
    var progreso  = e.parameter.progreso    || '';
    var notas     = e.parameter.notas       || '';

    if (!id || !tarea) return buildResponse({ error: 'Faltan id o tarea' });

    var sheet       = getSheet();
    var existingRow = findRowById(sheet, id);
    var row         = [id, inicio, tarea, prioridad, subprio, entrega, estado, progreso, notas];

    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return buildResponse({ ok: true, id: id });
  } catch (err) {
    return buildResponse({ error: err.message });
  }
}

function doGetDelete(e) {
  try {
    var id = e.parameter.id || '';
    if (!id) return buildResponse({ error: 'Falta id' });

    var sheet       = getSheet();
    var existingRow = findRowById(sheet, id);
    if (existingRow > 0) sheet.deleteRow(existingRow);

    return buildResponse({ ok: true, id: id });
  } catch (err) {
    return buildResponse({ error: err.message });
  }
}

function getSheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function findRowById(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function testSetup() {
  var fakeGet = { parameter: {
    action: 'set',
    id: 'test123',
    tarea: 'Tarea de prueba',
    prioridad: 'A',
    subprioridad: 'dinero',
    estado: 'pendiente',
    inicio: '2026-05-28'
  }};
  Logger.log(doGetSet(fakeGet).getContent());
  Logger.log('Tareas: ' + doGet({ parameter: {} }).getContent().substring(0, 300));
}
