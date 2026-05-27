// ============================================================
// GO Nat — Google Apps Script  (gas-sync.gs)
// Cómo desplegar:
//   1. Ve a https://script.google.com y crea un nuevo proyecto
//   2. Pega este código (reemplaza todo el contenido)
//   3. Menú → Implementar → Nueva implementación
//      · Tipo: Aplicación web
//      · Ejecutar como: Yo (tu cuenta)
//      · Quién tiene acceso: Cualquier usuario
//   4. Copia la URL de la implementación
//   5. Pégala en el panel GO Nat → Perfil → "URL de Apps Script"
// ============================================================

const AUTH_TOKEN   = '!n!g5G@86JnWouqDX6LLuP'; // mismo token que el panel
const SH_PRIO      = 'Prioridades';
const SH_SEGUIM    = 'Seguimiento';
const SH_CLIENTES  = 'Clientes';
const SH_CHECKS    = 'Checks';

// ── GET ─────────────────────────────────────────────────────
function doGet(e) {
  if (!authOk_(e)) return deny_();
  const action = param_(e, 'action') || 'all';
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    if (action === 'calendar')    return ok_({ events:   getCalendar_() });
    if (action === 'habitStreak') return ok_({ success: true, streaks: getStreaks_(ss) });

    const result = { success: true };
    if (action === 'all' || action === 'prioridades') result.gonat_prioridades  = readPrio_(ss);
    if (action === 'all' || action === 'seguimiento') result.gonat_seguimiento  = readSeguim_(ss);
    if (action === 'all' || action === 'clientes')    result.gonat_clientes     = readClientes_(ss);
    return ok_(result);
  } catch (err) {
    return ok_({ error: err.message });
  }
}

// ── POST ────────────────────────────────────────────────────
function doPost(e) {
  if (!authOk_(e)) return deny_();
  try {
    const body = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();
    if (body.gonat_prioridades) writePrio_(ss, body.gonat_prioridades);
    if (body.gonat_seguimiento) writeSeguim_(ss, body.gonat_seguimiento);
    if (body.gonat_clientes)    writeClientes_(ss, body.gonat_clientes);
    if (body.gonat_checks || body.habits) {
      writeChecks_(ss, body.gonat_checks || body.habits);
    }
    return ok_({ success: true });
  } catch (err) {
    return ok_({ error: err.message });
  }
}

// ── PRIORIDADES ─────────────────────────────────────────────
// Columnas: ID | Categoría | Texto | Inicio | Entrega | Hecho | Subtareas

function readPrio_(ss) {
  const sh   = sheet_(ss, SH_PRIO, ['ID','Categoría','Texto','Inicio','Entrega','Hecho','Subtareas']);
  const rows = sh.getDataRange().getValues();
  const out  = { dinero: [], clientes: [], marca: [] };
  for (let i = 1; i < rows.length; i++) {
    const [id, cat, text, start, due, done, stJson] = rows[i];
    if (!text) continue;
    const catKey = String(cat).toLowerCase();
    if (!out[catKey]) continue;
    const item = {
      id:        String(id || uid_()),
      text:      String(text),
      startDate: dateStr_(start),
      dueDate:   dateStr_(due),
      done:      done === true || done === 'TRUE',
      subtasks:  [],
    };
    try { item.subtasks = JSON.parse(stJson || '[]'); } catch (_) {}
    out[catKey].push(item);
  }
  return out;
}

function writePrio_(ss, prio) {
  const sh   = sheet_(ss, SH_PRIO, ['ID','Categoría','Texto','Inicio','Entrega','Hecho','Subtareas']);
  const rows = [['ID','Categoría','Texto','Inicio','Entrega','Hecho','Subtareas']];
  ['dinero','clientes','marca'].forEach(cat => {
    (prio[cat] || []).forEach(item => rows.push([
      item.id || uid_(), cat, item.text,
      item.startDate || '', item.dueDate || '',
      item.done ? 'TRUE' : 'FALSE',
      JSON.stringify(item.subtasks || []),
    ]));
  });
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 7).setValues(rows);
  sh.getRange(1, 1, 1, 7).setFontWeight('bold');
}

// ── SEGUIMIENTO ─────────────────────────────────────────────
// Columnas: ID | Texto | Añadida | Hecho

function readSeguim_(ss) {
  const sh   = sheet_(ss, SH_SEGUIM, ['ID','Texto','Añadida','Hecho']);
  const rows = sh.getDataRange().getValues();
  return rows.slice(1)
    .filter(r => r[1])
    .map(r => ({
      id:      String(r[0] || uid_()),
      text:    String(r[1]),
      addedAt: dateStr_(r[2]) || '',
      done:    r[3] === true || r[3] === 'TRUE',
    }));
}

function writeSeguim_(ss, items) {
  const sh   = sheet_(ss, SH_SEGUIM, ['ID','Texto','Añadida','Hecho']);
  const rows = [['ID','Texto','Añadida','Hecho'],
    ...(items || []).map(i => [i.id, i.text, i.addedAt || '', i.done ? 'TRUE' : 'FALSE'])];
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  sh.getRange(1, 1, 1, 4).setFontWeight('bold');
}

// ── CLIENTES ────────────────────────────────────────────────
// Columnas: ID_Cliente | Nombre | ID_Tarea | Tarea | Hecho | ID_Enlace | Enlace_Label | Enlace_URL

function readClientes_(ss) {
  const sh   = sheet_(ss, SH_CLIENTES, ['ID_Cliente','Nombre','ID_Tarea','Tarea','Hecho','ID_Enlace','Enlace_Label','Enlace_URL']);
  const rows = sh.getDataRange().getValues();
  const map  = {};
  for (let i = 1; i < rows.length; i++) {
    const [cId, name, tId, tText, tDone, lId, lLabel, lUrl] = rows[i];
    if (!cId) continue;
    if (!map[cId]) map[cId] = { id: String(cId), name: String(name), tasks: [], links: [] };
    if (tId && tText) map[cId].tasks.push({ id: String(tId), text: String(tText), done: tDone === true || tDone === 'TRUE' });
    if (lId && lLabel && lUrl && !map[cId].links.find(l => l.id === String(lId))) {
      map[cId].links.push({ id: String(lId), label: String(lLabel), url: String(lUrl) });
    }
  }
  return Object.values(map);
}

function writeClientes_(ss, clientes) {
  const sh  = sheet_(ss, SH_CLIENTES, ['ID_Cliente','Nombre','ID_Tarea','Tarea','Hecho','ID_Enlace','Enlace_Label','Enlace_URL']);
  const hdr = ['ID_Cliente','Nombre','ID_Tarea','Tarea','Hecho','ID_Enlace','Enlace_Label','Enlace_URL'];
  const rows = [hdr];
  (clientes || []).forEach(c => {
    const tasks = c.tasks || [];
    const links = c.links || [];
    const max   = Math.max(tasks.length, links.length, 1);
    for (let i = 0; i < max; i++) {
      const t = tasks[i] || {}, l = links[i] || {};
      rows.push([
        i === 0 ? c.id   : '', i === 0 ? c.name : '',
        t.id || '', t.text || '', t.done ? 'TRUE' : '',
        l.id || '', l.label || '', l.url || '',
      ]);
    }
  });
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 8).setValues(rows);
  sh.getRange(1, 1, 1, 8).setFontWeight('bold');
}

// ── CHECKS (arranque + bienestar) ───────────────────────────
// Columnas: Fecha | t4 | elvanse | estiramientos | mandalas | sol | coreano | kickboxing

function writeChecks_(ss, checks) {
  const cols = ['Fecha','t4','elvanse','estiramientos','mandalas','sol','coreano','kickboxing'];
  const sh   = sheet_(ss, SH_CHECKS, cols);
  const tz   = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const data  = sh.getDataRange().getValues();
  const row   = [today, ...cols.slice(1).map(k => checks[k] ? 'TRUE' : 'FALSE')];

  for (let i = 1; i < data.length; i++) {
    const d = data[i][0] ? Utilities.formatDate(new Date(data[i][0]), 'GMT', 'yyyy-MM-dd') : '';
    if (d === today) { sh.getRange(i + 1, 1, 1, row.length).setValues([row]); return; }
  }
  sh.appendRow(row);
}

// ── HABIT STREAKS ────────────────────────────────────────────
function getStreaks_(ss) {
  const cols = ['mandalas','sol','coreano','kickboxing'];
  const sh   = sheet_(ss, SH_CHECKS, ['Fecha','t4','elvanse','estiramientos','mandalas','sol','coreano','kickboxing']);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { mandalas:0, sol:0, coreano:0, kickboxing:0 };

  const hdrs = data[0];
  const colIdx = {};
  cols.forEach(c => { colIdx[c] = hdrs.indexOf(c); });

  const today = new Date(); today.setHours(0,0,0,0);
  const sorted = data.slice(1)
    .filter(r => r[0])
    .map(r => ({ d: new Date(r[0]), r }))
    .sort((a,b) => b.d - a.d);

  const streaks = {};
  cols.forEach(habit => {
    let streak = 0, check = new Date(today);
    for (const { d, r } of sorted) {
      const day = new Date(d); day.setHours(0,0,0,0);
      const diff = Math.round((check - day) / 86400000);
      if (diff > 1) break;
      if (diff < 0) continue;
      if (r[colIdx[habit]] === true || r[colIdx[habit]] === 'TRUE') {
        streak++;
        check = new Date(day); check.setDate(check.getDate() - 1);
      } else break;
    }
    streaks[habit] = streak;
  });
  return streaks;
}

// ── GOOGLE CALENDAR ──────────────────────────────────────────
function getCalendar_() {
  try {
    const tz  = Session.getScriptTimeZone();
    const t0  = new Date(); t0.setHours(0,0,0,0);
    const t1  = new Date(t0); t1.setDate(t1.getDate() + 1);
    const evs = [];
    CalendarApp.getAllCalendars().forEach(cal => {
      cal.getEvents(t0, t1).forEach(ev => {
        evs.push({
          title:     ev.getTitle(),
          startTime: ev.isAllDayEvent() ? 'Todo el día' : Utilities.formatDate(ev.getStartTime(), tz, 'HH:mm'),
          allDay:    ev.isAllDayEvent(),
        });
      });
    });
    evs.sort((a,b) => a.startTime.localeCompare(b.startTime));
    return evs;
  } catch (_) { return []; }
}

// ── UTILIDADES ───────────────────────────────────────────────
function sheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function dateStr_(val) {
  if (!val) return null;
  try { return Utilities.formatDate(new Date(val), 'GMT', 'yyyy-MM-dd'); } catch (_) { return null; }
}

function uid_() {
  return Utilities.getUuid().substring(0, 8);
}

function param_(e, key) {
  return e && e.parameter && e.parameter[key] ? e.parameter[key] : null;
}

function authOk_(e) {
  return param_(e, 'token') === AUTH_TOKEN;
}

function deny_() {
  return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
