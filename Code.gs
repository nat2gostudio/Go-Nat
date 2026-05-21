/**
 * ============================================================
 * GO Nat — Google Apps Script Backend
 * Code.gs — Web App for syncing data to Google Sheets
 * ============================================================
 *
 * HOW TO SET UP:
 * 1. Go to https://script.google.com
 * 2. Create a new project and name it "GoNat Sync"
 * 3. Replace the contents of Code.gs with this entire file
 * 4. Save the project (Ctrl+S)
 * 5. Click "Deploy" → "New deployment"
 * 6. Set type to "Web app"
 * 7. Set "Execute as" to "Me"
 * 8. Set "Who has access" to "Anyone" (required for the app to POST)
 * 9. Click "Deploy" and authorize if prompted
 * 10. Copy the Web App URL that looks like:
 *     https://script.google.com/macros/s/XXXXX.../exec
 * 11. Paste that URL into the GO Nat app → Perfil → URL de Google Apps Script
 *
 * SHEET STRUCTURE:
 * The script auto-creates a Google Sheet named "GoNat" with 4 tabs:
 *   - Clientes    → stores client data
 *   - Contenido   → stores kanban/content data
 *   - Prioridades → stores priority lists
 *   - Checks      → stores daily check data
 *   - Misc        → stores settings and other keys
 *
 * Each tab has two columns:
 *   Column A: key (string)
 *   Column B: value (JSON string)
 *
 * ============================================================
 */

// Name of the spreadsheet to create/use
var SHEET_NAME = 'GoNat';

// Valid tab names
var VALID_TABS = ['Clientes', 'Contenido', 'Prioridades', 'Checks', 'Misc'];

/**
 * GET handler — returns all stored data as a flat JSON object.
 * The client app reads this and merges it with localStorage.
 *
 * Response format:
 * {
 *   "gonat_clientes": [...],
 *   "gonat_contenido": [...],
 *   "gonat_prioridades": {...},
 *   "gonat_checks_YYYY-MM-DD": {...},
 *   ...
 * }
 */
function doGet(e) {
  try {
    var ss = getOrCreateSpreadsheet();
    var result = {};

    VALID_TABS.forEach(function(tabName) {
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) return;

      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return; // Only header row, no data

      var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      data.forEach(function(row) {
        var key = row[0];
        var val = row[1];
        if (key && val) {
          try {
            result[key] = JSON.parse(val);
          } catch (parseErr) {
            result[key] = val;
          }
        }
      });
    });

    return buildResponse(result, 200);
  } catch (err) {
    return buildResponse({ error: err.message }, 500);
  }
}

/**
 * POST handler — writes or updates a single key-value pair in a tab.
 *
 * Expected request body (JSON):
 * {
 *   "tab": "Clientes",      // which sheet tab to write to
 *   "key": "gonat_clientes", // the storage key
 *   "value": "..."           // the JSON-stringified value
 * }
 *
 * If the key already exists in the tab, its value is updated.
 * If not, a new row is appended.
 */
function doPost(e) {
  try {
    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return buildResponse({ error: 'Invalid JSON body' }, 400);
    }

    var tab   = body.tab   || 'Misc';
    var key   = body.key;
    var value = body.value;

    if (!key || value === undefined) {
      return buildResponse({ error: 'Missing key or value' }, 400);
    }

    // Sanitize tab name — only allow known tabs
    if (VALID_TABS.indexOf(tab) === -1) {
      tab = 'Misc';
    }

    var ss = getOrCreateSpreadsheet();
    var sheet = getOrCreateTab(ss, tab);

    // Search for existing key
    var lastRow = sheet.getLastRow();
    var existingRow = -1;

    if (lastRow >= 2) {
      var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (keys[i][0] === key) {
          existingRow = i + 2; // +2 because row 1 is header, array is 0-indexed
          break;
        }
      }
    }

    if (existingRow > 0) {
      // Update existing row
      sheet.getRange(existingRow, 1, 1, 2).setValues([[key, value]]);
    } else {
      // Append new row
      sheet.appendRow([key, value]);
    }

    return buildResponse({ ok: true, tab: tab, key: key }, 200);
  } catch (err) {
    return buildResponse({ error: err.message }, 500);
  }
}

/**
 * Build a ContentService response with CORS headers and JSON body.
 */
function buildResponse(data, statusCode) {
  var output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  // Note: Apps Script ContentService does not support custom HTTP status codes
  // or arbitrary headers. CORS is handled via the "Anyone" access deployment setting.
  // For GET requests from the web app, the deployment type handles CORS automatically.
  return output;
}

/**
 * Find or create the "GoNat" spreadsheet in the user's Drive.
 * On first run it creates the sheet and initialises all tabs.
 */
function getOrCreateSpreadsheet() {
  // Search in Drive for an existing spreadsheet named "GoNat"
  var files = DriveApp.getFilesByName(SHEET_NAME);
  if (files.hasNext()) {
    var file = files.next();
    return SpreadsheetApp.openById(file.getId());
  }

  // Create a new spreadsheet
  var ss = SpreadsheetApp.create(SHEET_NAME);

  // Rename the default "Sheet1" tab to the first valid tab
  var defaultSheet = ss.getSheets()[0];
  defaultSheet.setName(VALID_TABS[0]);

  // Add header row to first tab
  defaultSheet.appendRow(['key', 'value']);

  // Create remaining tabs
  for (var i = 1; i < VALID_TABS.length; i++) {
    var newSheet = ss.insertSheet(VALID_TABS[i]);
    newSheet.appendRow(['key', 'value']);
  }

  Logger.log('Created GoNat spreadsheet: ' + ss.getUrl());
  return ss;
}

/**
 * Get a tab by name, creating it (with header) if it doesn't exist.
 */
function getOrCreateTab(ss, tabName) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(['key', 'value']);
  }
  return sheet;
}

/**
 * Test function — run manually from the Apps Script editor to verify setup.
 * Click Run → testSetup to check that the spreadsheet is created correctly.
 */
function testSetup() {
  var ss = getOrCreateSpreadsheet();
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Tabs: ' + ss.getSheets().map(function(s) { return s.getName(); }).join(', '));

  // Write a test record
  var testBody = {
    postData: {
      contents: JSON.stringify({
        tab: 'Misc',
        key: 'test_key',
        value: JSON.stringify({ test: true, ts: new Date().toISOString() })
      })
    }
  };
  var response = doPost(testBody);
  Logger.log('doPost test result: ' + response.getContent());

  // Read it back
  var getResult = doGet({});
  Logger.log('doGet result (first 200 chars): ' + getResult.getContent().substring(0, 200));
}
