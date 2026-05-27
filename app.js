/* ============================================================
   GO Nat — Centro de Operaciones Nat2Go Studio
   app.js — Complete application logic
   ============================================================ */

'use strict';

/* ============================================================
   UTILITIES
   ============================================================ */

/**
 * Return today's date as YYYY-MM-DD string (local time).
 */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Safely parse JSON from localStorage. Returns fallback on failure.
 */
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

/**
 * Stringify and store value in localStorage.
 */
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage write failed:', key, e);
  }
}

/**
 * Generate a simple unique ID.
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Escape HTML to prevent XSS when inserting user text.
 */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function isOverdueDate(dateStr, done) {
  return dateStr && !done && new Date(dateStr + 'T23:59:59') < new Date();
}

/* ============================================================
   STORAGE KEYS
   ============================================================ */
const KEYS = {
  checks:      () => `gonat_checks_${todayStr()}`,
  bienestar:   () => `gonat_bienestar_${todayStr()}`,
  prioridades: 'gonat_prioridades',
  clientes:    'gonat_clientes',
  contenido:   'gonat_contenido',
  settings:    'gonat_settings',
  seguimiento: 'gonat_seguimiento',
};

/* ============================================================
   SETTINGS
   ============================================================ */
let settings = lsGet(KEYS.settings, { gasUrl: '', theme: 'light' });

/* ============================================================
   POMODORO STATE
   ============================================================ */
let pomodoroInterval = null;
let pomodoroSeconds = 25 * 60;
let pomodoroPhase = 'work'; // 'work' | 'break'

function saveSettings() {
  lsSet(KEYS.settings, settings);
  syncToGAS(KEYS.settings, settings);
}

/* ============================================================
   GOOGLE APPS SCRIPT SYNC
   ============================================================ */

/**
 * Push a single key/value pair to GAS (background, silent errors).
 */
function syncToGAS(key, value) {
  if (!settings.gasUrl) return;
  const tab = guessTab(key);
  const body = JSON.stringify({ tab, key, value: JSON.stringify(value) });
  fetch(settings.gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    mode: 'no-cors',
  }).catch(e => console.log('GAS sync error (silent):', e));
}

/**
 * Determine which GAS sheet tab a key belongs to.
 */
function guessTab(key) {
  if (key.startsWith('gonat_checks_')) return 'Checks';
  if (key.startsWith('gonat_bienestar_')) return 'Checks';
  if (key === KEYS.prioridades) return 'Prioridades';
  if (key === KEYS.clientes) return 'Clientes';
  if (key === KEYS.contenido) return 'Contenido';
  return 'Misc';
}

/**
 * Push all app data to GAS in one request.
 */
function syncAllToGAS() {
  if (!settings.gasUrl) return;
  const payload = {
    gonat_prioridades: prioridades,
    gonat_seguimiento: seguimiento,
    gonat_clientes:    clientes,
  };
  const url = `${settings.gasUrl}?token=${GAS_TOKEN}`;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    mode: 'no-cors',
  }).catch(e => console.log('GAS full-sync error (silent):', e));
}

/**
 * Pull all data from GAS sheets and merge into localStorage + UI.
 * GAS wins for persistent data; local wins for today's checks.
 */
async function syncFromGAS() {
  if (!settings.gasUrl) return;
  try {
    const gasUrl = `${settings.gasUrl}?action=all&token=${GAS_TOKEN}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(gasUrl)}`;
    const res = await fetch(proxyUrl, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const envelope = await res.json();
    const data = envelope.contents ? JSON.parse(envelope.contents) : envelope;

    if (data && typeof data === 'object' && !data.error) {
      if (data.gonat_prioridades) lsSet(KEYS.prioridades,  data.gonat_prioridades);
      if (data.gonat_seguimiento) lsSet(KEYS.seguimiento,  data.gonat_seguimiento);
      if (data.gonat_clientes)    lsSet(KEYS.clientes,     data.gonat_clientes);
      initApp();
    }
  } catch (e) {
    console.log('GAS fetch error (silent):', e);
  }
}

/* ============================================================
   GOOGLE CALENDAR & HABITS (GAS Integration)
   ============================================================ */

// Token secreto para autorizar peticiones a GAS
const GAS_TOKEN = '!n!g5G@86JnWouqDX6LLuP';

/**
 * Llamar a un endpoint de Google Apps Script con autenticación
 */
async function callGAS(action, method = 'GET', data = null) {
  if (!settings.gasUrl) {
    console.warn('GAS URL no configurada');
    return null;
  }

  try {
    let gasUrl = `${settings.gasUrl}?action=${action}&token=${GAS_TOKEN}`;
    let url = `https://api.allorigins.win/get?url=${encodeURIComponent(gasUrl)}`;

    const options = {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    };

    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data_response = await response.json();

    if (data_response.contents) {
      return JSON.parse(data_response.contents);
    }
    return null;
  } catch (e) {
    console.error(`GAS call error (${action}):`, e);
    return null;
  }
}

/**
 * Cargar eventos del Google Calendar para hoy
 */
async function loadCalendarEvents() {
  const result = await callGAS('calendar');
  if (result && result.success) {
    renderCalendarEvents(result.events);
  } else {
    renderCalendarEvents([]);
  }
}

/**
 * Renderizar eventos del calendar en el dashboard
 */
function renderCalendarEvents(events) {
  const container = document.getElementById('calendarEventsList');
  if (!container) return;

  if (!events || events.length === 0) {
    container.innerHTML = `
      <p class="calendar-empty" style="color: #dc2626;">
        ⚠️ Verificando Google Calendar...
        <br><small style="color: #a09890;">Si persiste, revisa la consola (F12)</small>
      </p>
    `;
    return;
  }

  container.innerHTML = events.map(event => `
    <div class="calendar-event">
      <div class="calendar-event-time">${event.startTime}</div>
      <div class="calendar-event-title">${esc(event.title)}</div>
    </div>
  `).join('');
}

/**
 * Cargar rachas de hábitos desde GAS
 */
async function loadHabitStreaks() {
  const result = await callGAS('habitStreak');
  if (result && result.success) {
    renderHabitStreaks(result.streaks);
  }
}

/**
 * Renderizar contadores de racha de hábitos
 */
function renderHabitStreaks(streaks) {
  if (!streaks) return;
  document.getElementById('mandalasStreak').textContent = streaks.mandalas || 0;
  document.getElementById('solStreak').textContent = streaks.sol || 0;
  document.getElementById('coreanoStreak').textContent = streaks.coreano || 0;
  document.getElementById('kickboxingStreak').textContent = streaks.kickboxing || 0;
}

/**
 * Guardar hábitos completados en GAS
 */
async function saveHabitsToGAS(habits) {
  await callGAS('saveHabits', 'POST', habits);
  // Recargar los streaks después de guardar
  await loadHabitStreaks();
}

/* ============================================================
   NAVIGATION
   ============================================================ */
let currentScreen = 'dashboard';

function initNav() {
  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.querySelector('.nav-btn').addEventListener('click', () => {
      navigateTo(item.dataset.screen);
    });
  });

  // Bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.querySelector('.bottom-nav-btn').addEventListener('click', () => {
      navigateTo(item.dataset.screen);
    });
  });
}

function navigateTo(screenId) {
  currentScreen = screenId;

  // Update screens
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s.id === `screen-${screenId}`);
  });

  // Update sidebar nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screenId);
  });

  // Update bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screenId);
  });

  // Refresh stats when navigating to perfil
  if (screenId === 'perfil') {
    renderStats();
  }
}

/* ============================================================
   SCREEN 1: DASHBOARD
   ============================================================ */

/* ---- Greeting & Date ---- */
function renderGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días, Nati' : 'Buenas tardes, Nati';
  document.getElementById('greetingText').textContent = greeting;

  const d = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('dateText').textContent =
    d.toLocaleDateString('es-ES', options).replace(/^\w/, c => c.toUpperCase());
}

/* ---- Morning Checks ---- */
function loadMorningChecks() {
  const data = lsGet(KEYS.checks(), {});
  document.querySelectorAll('.morning-check').forEach(cb => {
    const key = cb.dataset.key;
    cb.checked = !!data[key];
    updateCheckLineThrough(cb);
  });
}

function saveMorningChecks() {
  const data = {};
  document.querySelectorAll('.morning-check').forEach(cb => {
    data[cb.dataset.key] = cb.checked;
  });
  lsSet(KEYS.checks(), data);
  syncToGAS(KEYS.checks(), data);
  renderStats();
}

function initMorningChecks() {
  loadMorningChecks();
  document.querySelectorAll('.morning-check').forEach(cb => {
    cb.addEventListener('change', () => {
      updateCheckLineThrough(cb);
      saveMorningChecks();
    });
  });
}

function updateCheckLineThrough(cb) {
  const textEl = cb.parentElement.querySelector('.check-text');
  if (textEl) {
    // CSS handles the line-through via :checked ~ .check-text
    // but we trigger a small visual refresh just in case
  }
}

/* ---- Prioridades ---- */
let prioridades = lsGet(KEYS.prioridades, {
  dinero: [],
  clientes: [],
  marca: [],
});

function savePrioridades() {
  lsSet(KEYS.prioridades, prioridades);
  syncAllToGAS();
}

function renderPrioridades() {
  ['dinero', 'clientes', 'marca'].forEach(cat => {
    const listId = cat === 'clientes' ? 'list-clientes-prio' : `list-${cat}`;
    const listEl = document.getElementById(listId);
    if (!listEl) return;
    listEl.innerHTML = '';
    (prioridades[cat] || []).forEach((item, idx) => {
      const subtasks = item.subtasks || [];
      const subtasksHtml = subtasks.map((st, si) => `
        <li class="subtask-item" data-si="${si}">
          <input type="checkbox" ${st.done ? 'checked' : ''} />
          <span class="subtask-text">${esc(st.text)}</span>
          <button class="subtask-del" aria-label="Eliminar microtarea">×</button>
        </li>
      `).join('');

      const overdue = isOverdueDate(item.dueDate, item.done);
      const dueChip = item.dueDate
        ? `<span class="priority-due-chip${overdue ? ' priority-due-chip--overdue' : ''}">${formatShortDate(item.dueDate)}</span>`
        : '';

      const li = document.createElement('li');
      li.className = 'priority-item';
      li.dataset.cat = cat;
      li.dataset.idx = idx;
      li.innerHTML = `
        <input type="checkbox" ${item.done ? 'checked' : ''} />
        <span class="priority-item-text">${esc(item.text)}</span>
        ${dueChip}
        <button class="priority-item-dates-btn" aria-label="Fechas" title="Fechas de inicio y entrega">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </button>
        <button class="priority-item-expand" aria-label="Añadir microtarea" title="Dividir en microtareas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="priority-item-del" aria-label="Eliminar">×</button>
        <div class="priority-item-subtasks">
          ${subtasks.length > 0 ? `<ul class="subtask-list">${subtasksHtml}</ul>` : ''}
        </div>
        <div class="priority-dates-panel">
          <label class="priority-date-label">Inicio<input type="date" class="priority-date-input prio-start-input" value="${item.startDate || ''}" /></label>
          <label class="priority-date-label">Entrega<input type="date" class="priority-date-input prio-due-input" value="${item.dueDate || ''}" /></label>
        </div>
      `;

      // Main checkbox
      const cb = li.querySelector('input[type="checkbox"]');
      cb.addEventListener('change', () => {
        prioridades[cat][idx].done = cb.checked;
        savePrioridades();
        renderPrioridades();
        renderStats();
      });

      // Delete main task
      li.querySelector('.priority-item-del').addEventListener('click', () => {
        prioridades[cat].splice(idx, 1);
        savePrioridades();
        renderPrioridades();
      });

      // Dates panel toggle
      li.querySelector('.priority-item-dates-btn').addEventListener('click', () => {
        li.querySelector('.priority-dates-panel').classList.toggle('priority-dates-panel--open');
      });

      // Start date
      li.querySelector('.prio-start-input').addEventListener('change', e => {
        prioridades[cat][idx].startDate = e.target.value || null;
        savePrioridades();
        renderPrioridades();
      });

      // Due date
      li.querySelector('.prio-due-input').addEventListener('change', e => {
        prioridades[cat][idx].dueDate = e.target.value || null;
        savePrioridades();
        renderPrioridades();
      });

      // Expand: add microtarea
      li.querySelector('.priority-item-expand').addEventListener('click', () => {
        const subtasksDiv = li.querySelector('.priority-item-subtasks');
        if (subtasksDiv.querySelector('.subtask-add-row')) return;

        let subtaskList = subtasksDiv.querySelector('.subtask-list');
        if (!subtaskList) {
          subtaskList = document.createElement('ul');
          subtaskList.className = 'subtask-list';
          subtasksDiv.insertBefore(subtaskList, subtasksDiv.firstChild);
        }

        const addRow = document.createElement('div');
        addRow.className = 'subtask-add-row';
        addRow.innerHTML = `
          <input class="subtask-add-input" type="text" placeholder="Paso pequeño..." maxlength="100" />
          <button class="subtask-add-ok">OK</button>
        `;
        subtasksDiv.appendChild(addRow);
        const stInput = addRow.querySelector('.subtask-add-input');
        stInput.focus();

        const confirmSt = () => {
          const text = stInput.value.trim();
          if (text) {
            if (!prioridades[cat][idx].subtasks) prioridades[cat][idx].subtasks = [];
            prioridades[cat][idx].subtasks.push({ id: uid(), text, done: false });
            savePrioridades();
            renderPrioridades();
          } else {
            addRow.remove();
          }
        };

        addRow.querySelector('.subtask-add-ok').addEventListener('click', confirmSt);
        stInput.addEventListener('keydown', e => {
          if (e.key === 'Enter') confirmSt();
          if (e.key === 'Escape') addRow.remove();
        });
      });

      // Subtask checkboxes and delete buttons
      li.querySelectorAll('.subtask-item').forEach(stEl => {
        const si = parseInt(stEl.dataset.si, 10);
        const stCb = stEl.querySelector('input[type="checkbox"]');
        stCb.addEventListener('change', () => {
          if (!prioridades[cat][idx].subtasks) return;
          prioridades[cat][idx].subtasks[si].done = stCb.checked;
          savePrioridades();
        });
        stEl.querySelector('.subtask-del').addEventListener('click', () => {
          prioridades[cat][idx].subtasks.splice(si, 1);
          savePrioridades();
          renderPrioridades();
        });
      });

      listEl.appendChild(li);
    });
  });
}

function initPrioridades() {
  renderPrioridades();

  document.querySelectorAll('.add-prio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      const listId = cat === 'clientes' ? 'list-clientes-prio' : `list-${cat}`;
      const listEl = document.getElementById(listId);
      if (!listEl) return;

      // Don't add multiple inline inputs
      if (listEl.parentElement.querySelector('.inline-add-row')) return;

      const row = document.createElement('div');
      row.className = 'inline-add-row';
      row.innerHTML = `
        <input class="inline-add-input" type="text" placeholder="Nueva tarea..." maxlength="120" />
        <button class="btn inline-add-ok">OK</button>
      `;
      btn.insertAdjacentElement('beforebegin', row);
      const input = row.querySelector('.inline-add-input');
      input.focus();

      const confirm = () => {
        const text = input.value.trim();
        if (text) {
          if (!prioridades[cat]) prioridades[cat] = [];
          prioridades[cat].push({ id: uid(), text, done: false, subtasks: [], startDate: null, dueDate: null });
          savePrioridades();
          renderPrioridades();
        }
        row.remove();
      };

      row.querySelector('.inline-add-ok').addEventListener('click', confirm);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') confirm();
        if (e.key === 'Escape') row.remove();
      });
    });
  });
}

/* ---- Decisiones button ---- */
function initDecision() {
  const btn = document.getElementById('decisionBtn');
  const highlight = document.getElementById('decisionHighlight');
  if (!btn || !highlight) return;
  btn.addEventListener('click', () => {
    const allUnchecked = [];
    ['dinero', 'clientes', 'marca'].forEach(cat => {
      (prioridades[cat] || []).forEach(item => {
        if (!item.done) allUnchecked.push(item.text);
      });
    });
    if (allUnchecked.length === 0) {
      highlight.textContent = 'Todo completado. No hay tareas pendientes.';
      highlight.style.display = 'block';
      return;
    }
    const picked = allUnchecked[Math.floor(Math.random() * allUnchecked.length)];
    highlight.textContent = `Ahora mismo: ${picked}`;
    highlight.style.display = 'block';
  });
}

/* ============================================================
   SCREEN 2: CLIENTES
   ============================================================ */

let clientes = lsGet(KEYS.clientes, null);

// Default clients if first visit
if (clientes === null) {
  clientes = [
    {
      id: uid(),
      name: 'AE',
      tasks: [
        { id: uid(), text: 'Newsletter', done: false },
        { id: uid(), text: 'Blog', done: false },
      ],
    },
    {
      id: uid(),
      name: 'Casa Bella',
      tasks: [
        { id: uid(), text: 'Newsletter', done: false },
        { id: uid(), text: 'Copys Web', done: false },
        { id: uid(), text: 'Blog', done: false },
      ],
    },
    {
      id: uid(),
      name: 'RoscónLab',
      tasks: [
        { id: uid(), text: 'Newsletter', done: false },
        { id: uid(), text: 'Copywriting', done: false },
      ],
    },
  ];
  lsSet(KEYS.clientes, clientes);
}

function saveClientes() {
  lsSet(KEYS.clientes, clientes);
  syncToGAS(KEYS.clientes, clientes);
}

function safeUrl(raw) {
  const url = raw.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (/^\/\//.test(url)) return 'https:' + url;
  return 'https://' + url;
}

function renderClientes() {
  const grid = document.getElementById('clientsGrid');
  grid.innerHTML = '';
  clientes.forEach((client, ci) => {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.dataset.id = client.id;

    const tasksHtml = (client.tasks || []).map((task, ti) => `
      <li class="client-task-item" data-ti="${ti}">
        <input type="checkbox" ${task.done ? 'checked' : ''} aria-label="${esc(task.text)}" />
        <span class="client-task-text">${esc(task.text)}</span>
        <button class="client-task-del" aria-label="Eliminar tarea">×</button>
      </li>
    `).join('');

    const linksHtml = (client.links || []).map((link, li) => `
      <span class="client-link-wrap" data-li="${li}">
        <a class="client-link-item" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          ${esc(link.label)}
        </a>
        <button class="client-link-del" aria-label="Eliminar enlace">×</button>
      </span>
    `).join('');

    card.innerHTML = `
      <div class="client-card-header">
        <span class="client-name" title="Clic para editar">${esc(client.name)}</span>
        <button class="client-del-btn" aria-label="Eliminar cliente">×</button>
      </div>
      <ul class="client-tasks">${tasksHtml}</ul>
      <button class="btn btn-ghost btn-xs add-task-btn">+ Tarea</button>
      <div class="client-links-section">
        <div class="client-links-row" id="links-${client.id}">${linksHtml}</div>
        <button class="client-link-add-btn" aria-label="Añadir enlace">+ Enlace</button>
      </div>
    `;

    // Client name inline edit
    const nameEl = card.querySelector('.client-name');
    nameEl.addEventListener('click', () => {
      const input = document.createElement('input');
      input.className = 'client-name-input';
      input.type = 'text';
      input.value = client.name;
      input.maxLength = 60;
      nameEl.replaceWith(input);
      input.focus();
      input.select();

      const finish = () => {
        const newName = input.value.trim() || client.name;
        clientes[ci].name = newName;
        saveClientes();
        renderClientes();
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') finish();
        if (e.key === 'Escape') { input.value = client.name; finish(); }
      });
    });

    // Delete client
    card.querySelector('.client-del-btn').addEventListener('click', () => {
      if (confirm(`¿Eliminar el cliente "${client.name}"?`)) {
        clientes.splice(ci, 1);
        saveClientes();
        renderClientes();
      }
    });

    // Task checkboxes
    card.querySelectorAll('.client-task-item').forEach(taskEl => {
      const ti = parseInt(taskEl.dataset.ti, 10);
      const cb = taskEl.querySelector('input[type="checkbox"]');
      cb.addEventListener('change', () => {
        clientes[ci].tasks[ti].done = cb.checked;
        saveClientes();
      });
      taskEl.querySelector('.client-task-del').addEventListener('click', () => {
        clientes[ci].tasks.splice(ti, 1);
        saveClientes();
        renderClientes();
      });
    });

    // Add task
    card.querySelector('.add-task-btn').addEventListener('click', () => {
      const btn = card.querySelector('.add-task-btn');
      if (card.querySelector('.inline-add-row')) return;

      const row = document.createElement('div');
      row.className = 'inline-add-row';
      row.innerHTML = `
        <input class="inline-add-input" type="text" placeholder="Nueva tarea..." maxlength="80" />
        <button class="btn inline-add-ok">OK</button>
      `;
      btn.insertAdjacentElement('beforebegin', row);
      const input = row.querySelector('.inline-add-input');
      input.focus();

      const confirm2 = () => {
        const text = input.value.trim();
        if (text) {
          clientes[ci].tasks.push({ id: uid(), text, done: false });
          saveClientes();
          renderClientes();
        } else {
          row.remove();
        }
      };

      row.querySelector('.inline-add-ok').addEventListener('click', confirm2);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') confirm2();
        if (e.key === 'Escape') row.remove();
      });
    });

    // Delete link buttons
    card.querySelectorAll('.client-link-del').forEach(btn => {
      const li = parseInt(btn.closest('.client-link-wrap').dataset.li, 10);
      btn.addEventListener('click', () => {
        clientes[ci].links.splice(li, 1);
        saveClientes();
        renderClientes();
      });
    });

    // Add link
    card.querySelector('.client-link-add-btn').addEventListener('click', () => {
      const section = card.querySelector('.client-links-section');
      if (section.querySelector('.client-link-form')) return;

      const form = document.createElement('div');
      form.className = 'client-link-form';
      form.innerHTML = `
        <input class="client-link-label-input" type="text" placeholder="Nombre (Canva, Plan...)" maxlength="40" />
        <input class="client-link-url-input" type="url" placeholder="https://..." maxlength="500" />
        <button class="client-link-form-ok">OK</button>
        <button class="client-link-form-cancel">✕</button>
      `;
      section.appendChild(form);
      form.querySelector('.client-link-label-input').focus();

      const confirmLink = () => {
        const label = form.querySelector('.client-link-label-input').value.trim();
        const rawUrl = form.querySelector('.client-link-url-input').value.trim();
        if (label && rawUrl) {
          if (!clientes[ci].links) clientes[ci].links = [];
          clientes[ci].links.push({ id: uid(), label, url: safeUrl(rawUrl) });
          saveClientes();
          renderClientes();
        } else {
          form.remove();
        }
      };

      form.querySelector('.client-link-form-ok').addEventListener('click', confirmLink);
      form.querySelector('.client-link-form-cancel').addEventListener('click', () => form.remove());
      form.querySelector('.client-link-url-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmLink();
        if (e.key === 'Escape') form.remove();
      });
      form.querySelector('.client-link-label-input').addEventListener('keydown', e => {
        if (e.key === 'Escape') form.remove();
        if (e.key === 'Enter') form.querySelector('.client-link-url-input').focus();
      });
    });

    grid.appendChild(card);
  });
}

function initClientes() {
  renderClientes();

  document.getElementById('addClientBtn').addEventListener('click', () => {
    const name = prompt('Nombre del nuevo cliente:');
    if (name && name.trim()) {
      clientes.push({
        id: uid(),
        name: name.trim(),
        tasks: [],
      });
      saveClientes();
      renderClientes();
      navigateTo('clientes');
    }
  });
}

/* ============================================================
   SCREEN 3: CONTENIDO (Kanban)
   ============================================================ */

const KANBAN_COLS = ['IDEAS', 'PENDIENTE', 'PUBLICADO', 'ENLACES'];

let contenido = lsGet(KEYS.contenido, null);

// Default content if first visit
if (contenido === null) {
  contenido = [
    { id: uid(), text: 'Ideas para el próximo newsletter', status: 'IDEAS' },
    { id: uid(), text: 'Post sobre productividad con TDAH', status: 'PENDIENTE' },
    { id: uid(), text: 'Guía de herramientas de diseño 2024', status: 'PUBLICADO' },
  ];
  lsSet(KEYS.contenido, contenido);
}

function saveContenido() {
  lsSet(KEYS.contenido, contenido);
  syncToGAS(KEYS.contenido, contenido);
}

function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = '';

  KANBAN_COLS.forEach((col, colIdx) => {
    const items = contenido.filter(c => c.status === col);
    const canMove = colIdx < KANBAN_COLS.length - 1;
    const canAdd = col === 'IDEAS' || col === 'ENLACES';

    const colEl = document.createElement('div');
    colEl.className = 'kanban-column';
    colEl.dataset.col = col;

    const cardsHtml = items.map(item => `
      <div class="kanban-card" data-id="${item.id}">
        <span class="kanban-card-text">${esc(item.text)}</span>
        <div class="kanban-card-actions">
          ${canMove ? `<button class="kanban-move-btn" title="Mover a ${KANBAN_COLS[colIdx + 1]}">→</button>` : ''}
          <button class="kanban-del-btn" title="Eliminar">×</button>
        </div>
      </div>
    `).join('');

    colEl.innerHTML = `
      <div class="kanban-col-header">
        <span class="kanban-col-title">${col}</span>
        <span class="kanban-col-count">${items.length}</span>
      </div>
      <div class="kanban-cards">${cardsHtml}</div>
      ${canAdd ? `<button class="btn btn-ghost btn-xs kanban-add-btn" data-col="${col}">+ Añadir</button>` : ''}
    `;

    // Move buttons
    colEl.querySelectorAll('.kanban-move-btn').forEach(btn => {
      const cardEl = btn.closest('.kanban-card');
      const itemId = cardEl.dataset.id;
      btn.addEventListener('click', () => {
        const item = contenido.find(c => c.id === itemId);
        if (item) {
          item.status = KANBAN_COLS[colIdx + 1];
          saveContenido();
          renderKanban();
        }
      });
    });

    // Delete buttons
    colEl.querySelectorAll('.kanban-del-btn').forEach(btn => {
      const cardEl = btn.closest('.kanban-card');
      const itemId = cardEl.dataset.id;
      btn.addEventListener('click', () => {
        if (confirm('¿Eliminar esta tarjeta?')) {
          contenido = contenido.filter(c => c.id !== itemId);
          saveContenido();
          renderKanban();
        }
      });
    });

    // Add button (IDEAS and ENLACES columns)
    const addBtn = colEl.querySelector('.kanban-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (colEl.querySelector('.inline-add-row')) return;
        const row = document.createElement('div');
        row.className = 'inline-add-row';
        row.innerHTML = `
          <input class="inline-add-input" type="text" placeholder="Nueva tarjeta..." maxlength="200" />
          <button class="btn inline-add-ok">OK</button>
        `;
        addBtn.insertAdjacentElement('beforebegin', row);
        const input = row.querySelector('.inline-add-input');
        input.focus();

        const confirmAdd = () => {
          const text = input.value.trim();
          if (text) {
            contenido.push({ id: uid(), text, status: col });
            saveContenido();
            renderKanban();
          } else {
            row.remove();
          }
        };

        row.querySelector('.inline-add-ok').addEventListener('click', confirmAdd);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') confirmAdd();
          if (e.key === 'Escape') row.remove();
        });
      });
    }

    board.appendChild(colEl);
  });
}

function initContenido() {
  renderKanban();

  // Captura Rápida modal
  const modal = document.getElementById('capturaModal');
  const textarea = document.getElementById('capturaTextarea');

  const openModal = () => {
    modal.style.display = 'flex';
    textarea.value = '';
    setTimeout(() => textarea.focus(), 50);
  };

  const closeModal = () => {
    modal.style.display = 'none';
  };

  document.getElementById('capturaRapidaBtn').addEventListener('click', openModal);
  document.getElementById('capturaModalClose').addEventListener('click', closeModal);
  document.getElementById('capturaCancel').addEventListener('click', closeModal);

  document.getElementById('capturaGuardar').addEventListener('click', () => {
    const text = textarea.value.trim();
    if (text) {
      contenido.push({ id: uid(), text, status: 'IDEAS' });
      saveContenido();
      renderKanban();
      closeModal();
    }
  });

  // Close modal on overlay click
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });

  // Close modal on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.display !== 'none') closeModal();
  });
}

/* ============================================================
   SCREEN 4: BIENESTAR
   ============================================================ */

function loadBienestarChecks() {
  const data = lsGet(KEYS.bienestar(), {});
  document.querySelectorAll('.bienestar-check').forEach(cb => {
    cb.checked = !!data[cb.dataset.key];
  });
}

function saveBienestarChecks() {
  const data = {};
  document.querySelectorAll('.bienestar-check').forEach(cb => {
    data[cb.dataset.key] = cb.checked;
  });
  lsSet(KEYS.bienestar(), data);
  syncToGAS(KEYS.bienestar(), data);
  renderStats();
  // Guardar en Google Apps Script para el tracker de hábitos
  saveHabitsToGAS(data);
}

function initBienestar() {
  loadBienestarChecks();
  document.querySelectorAll('.bienestar-check').forEach(cb => {
    cb.addEventListener('change', saveBienestarChecks);
  });
  initLockOverlay();
}

/* ---- Lock Overlay ---- */
function initLockOverlay() {
  const overlay = document.getElementById('lockOverlay');
  const holdBtn = document.getElementById('lockHoldBtn');
  const progressBar = document.getElementById('lockProgressBar');
  const closeBtn = document.getElementById('closeDayBtn');

  closeBtn.addEventListener('click', () => {
    overlay.style.display = 'flex';
  });

  let holdTimer = null;
  let holdStart = null;

  const startHold = (e) => {
    e.preventDefault();
    holdStart = Date.now();
    progressBar.classList.remove('animating');
    // Force reflow to restart animation
    void progressBar.offsetWidth;
    progressBar.classList.add('animating');

    holdTimer = setTimeout(() => {
      overlay.style.display = 'none';
      progressBar.classList.remove('animating');
      progressBar.style.width = '0';
    }, 5000);
  };

  const endHold = (e) => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    progressBar.classList.remove('animating');
    // Reset bar width after animation transition is removed
    setTimeout(() => {
      progressBar.style.width = '0';
    }, 10);
  };

  holdBtn.addEventListener('mousedown', startHold);
  holdBtn.addEventListener('touchstart', startHold, { passive: false });
  holdBtn.addEventListener('mouseup', endHold);
  holdBtn.addEventListener('mouseleave', endHold);
  holdBtn.addEventListener('touchend', endHold);
  holdBtn.addEventListener('touchcancel', endHold);
}

/* ============================================================
   SCREEN 5: PERFIL
   ============================================================ */

function initPerfil() {
  // Load saved GAS URL
  const gasInput = document.getElementById('gasUrlInput');
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.getElementById('statusText');

  gasInput.value = settings.gasUrl || '';

  const updateConnectionStatus = () => {
    if (settings.gasUrl) {
      statusDot.className = 'status-dot status-dot--green';
      statusText.textContent = 'Conectado';
    } else {
      statusDot.className = 'status-dot status-dot--grey';
      statusText.textContent = 'Sin conexión (modo local)';
    }
  };

  updateConnectionStatus();

  document.getElementById('saveGasBtn').addEventListener('click', () => {
    settings.gasUrl = gasInput.value.trim();
    saveSettings();
    updateConnectionStatus();
    if (settings.gasUrl) {
      syncAllToGAS();   // push local data to sheets first
      syncFromGAS();    // then pull (sheets win on conflict)
    }
  });

  // Theme
  document.getElementById('themeLightBtn').addEventListener('click', () => {
    setTheme('light');
  });

  document.getElementById('themeDarkBtn').addEventListener('click', () => {
    setTheme('dark');
  });

  // Copy GAS script button
  const copyBtn = document.getElementById('copyGasScriptBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const ta = document.getElementById('gasScriptContent');
      if (!ta) return;
      navigator.clipboard.writeText(ta.value).then(() => {
        copyBtn.textContent = '✓ Copiado';
        copyBtn.classList.add('gas-copy-btn--copied');
        setTimeout(() => {
          copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar script`;
          copyBtn.classList.remove('gas-copy-btn--copied');
        }, 2000);
      }).catch(() => {
        ta.select();
        document.execCommand('copy');
      });
    });
  }

  // Reset day
  document.getElementById('resetDayBtn').addEventListener('click', () => {
    if (confirm('¿Restablecer todos los checks diarios? Se borrarán los checks de Arranque y Bienestar de hoy.')) {
      localStorage.removeItem(KEYS.checks());
      localStorage.removeItem(KEYS.bienestar());
      loadMorningChecks();
      loadBienestarChecks();
      renderStats();
      alert('Checks del día restablecidos. ¡Buen día, Nati! ☀️');
    }
  });
}

/* ---- Theme ---- */
function setTheme(theme) {
  settings.theme = theme;
  saveSettings();
  document.body.classList.toggle('dark', theme === 'dark');

  const lightBtn = document.getElementById('themeLightBtn');
  const darkBtn = document.getElementById('themeDarkBtn');
  if (lightBtn) lightBtn.classList.toggle('active', theme === 'light');
  if (darkBtn) darkBtn.classList.toggle('active', theme === 'dark');
}

function applyTheme() {
  setTheme(settings.theme || 'light');
}

/* ---- Stats ---- */
function renderStats() {
  const morningData = lsGet(KEYS.checks(), {});
  const bienestarData = lsGet(KEYS.bienestar(), {});

  const morningDone = Object.values(morningData).filter(Boolean).length;
  const bienestarDone = Object.values(bienestarData).filter(Boolean).length;
  const totalDone = morningDone + bienestarDone;

  const elM = document.getElementById('statMorningDone');
  const elB = document.getElementById('statBienestarDone');
  const elT = document.getElementById('statTotalDone');
  if (elM) elM.textContent = morningDone;
  if (elB) elB.textContent = bienestarDone;
  if (elT) elT.textContent = totalDone;
}

/* ============================================================
   POMODORO
   ============================================================ */

function playAlarm(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = type === 'soft'
      ? [{ t: 0, f: 660, v: 0.3, d: 0.3 }, { t: 0.45, f: 660, v: 0.3, d: 0.3 }, { t: 0.9, f: 880, v: 0.4, d: 0.4 }]
      : [{ t: 0, f: 880, v: 0.6, d: 0.25 }, { t: 0.35, f: 880, v: 0.6, d: 0.25 }, { t: 0.7, f: 1100, v: 0.7, d: 0.3 }, { t: 1.1, f: 1100, v: 0.7, d: 0.3 }, { t: 1.5, f: 1320, v: 0.8, d: 0.5 }];

    notes.forEach(({ t, f, v, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = f;
      osc.type = 'sine';
      gain.gain.setValueAtTime(v, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d + 0.05);
    });
  } catch (e) { /* AudioContext unavailable — silent */ }
}

function formatPomodoroTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updatePomodoroDisplay() {
  const timerEl = document.getElementById('pomodoroTimer');
  const phaseEl = document.getElementById('pomodoroPhase');
  if (timerEl) timerEl.textContent = formatPomodoroTime(pomodoroSeconds);
  if (phaseEl) {
    if (!pomodoroInterval) {
      phaseEl.textContent = '';
    } else {
      phaseEl.textContent = pomodoroPhase === 'work' ? 'Trabajando' : 'Descanso';
    }
  }
}

function initPomodoro() {
  const toggle = document.getElementById('pomodoroToggle');
  if (!toggle) return;

  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      pomodoroSeconds = 25 * 60;
      pomodoroPhase = 'work';
      updatePomodoroDisplay();

      pomodoroInterval = setInterval(() => {
        pomodoroSeconds--;
        updatePomodoroDisplay();

        if (pomodoroSeconds <= 0) {
          if (pomodoroPhase === 'work') {
            playAlarm('soft');
            pomodoroPhase = 'break';
            pomodoroSeconds = 5 * 60;
          } else {
            playAlarm('loud');
            clearInterval(pomodoroInterval);
            pomodoroInterval = null;
            pomodoroSeconds = 25 * 60;
            pomodoroPhase = 'work';
            toggle.checked = false;
            updatePomodoroDisplay();
          }
        }
      }, 1000);
    } else {
      if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
      }
      pomodoroSeconds = 25 * 60;
      pomodoroPhase = 'work';
      updatePomodoroDisplay();
    }
  });
}

/* ============================================================
   BULK AUTO-PRIORITIZE
   ============================================================ */

const PRIORITY_WORDS = {
  dinero: ['factura', 'cobrar', 'cobro', 'pago', 'pagos', 'presupuesto', 'propuesta',
           'urgente', 'dinero', 'precio', 'contrato', 'hoy', 'deadline', 'vence',
           'llamar', 'invoice', 'cargo', 'ingreso', 'honorarios'],
  clientes: ['ae', 'casa bella', 'roscónlab', 'roscónlab', 'cliente', 'clientes',
             'reunión', 'entrega', 'revisión', 'corrección', 'feedback',
             'enviar a', 'llamada', 'responder', 'email a', 'proyecto'],
  marca: ['instagram', 'newsletter', 'blog', 'marca', 'contenido', 'web',
          'linkedin', 'canva', 'diseño', 'post', 'stories', 'reel',
          'portfolio', 'branding', 'foto', 'vídeo', 'podcast', 'publicar', 'social'],
};

function assignCategory(taskText) {
  const text = taskText.toLowerCase();
  const scores = { dinero: 0, clientes: 0, marca: 0 };
  for (const [cat, words] of Object.entries(PRIORITY_WORDS)) {
    for (const word of words) {
      if (text.includes(word)) scores[cat] += 1;
    }
  }
  const max = Math.max(...Object.values(scores));
  if (max === 0) return null;
  return Object.entries(scores).find(([, v]) => v === max)[0];
}

function initBulkPrioritize() {
  const btn = document.getElementById('bulkPrioritizeBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const textarea = document.getElementById('bulkTasksInput');
    const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const added = { dinero: 0, clientes: 0, marca: 0 };
    let unmatched = 0;

    lines.forEach(text => {
      let cat = assignCategory(text);
      if (!cat) {
        // Distribute to the least-full bucket
        const counts = {
          dinero: (prioridades.dinero || []).length + added.dinero,
          clientes: (prioridades.clientes || []).length + added.clientes,
          marca: (prioridades.marca || []).length + added.marca,
        };
        cat = Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
        unmatched++;
      }
      if (!prioridades[cat]) prioridades[cat] = [];
      prioridades[cat].push({ id: uid(), text, done: false, subtasks: [], startDate: null, dueDate: null });
      added[cat]++;
    });

    savePrioridades();
    renderPrioridades();
    textarea.value = '';

    const total = lines.length;
    const msg = unmatched > 0
      ? `${total} tareas añadidas. ${unmatched} distribuidas por equilibrio (sin palabras clave claras).`
      : `${total} tareas clasificadas automáticamente.`;

    const highlight = document.getElementById('decisionHighlight');
    if (highlight) {
      highlight.textContent = msg;
      highlight.style.display = 'block';
      setTimeout(() => { highlight.style.display = 'none'; }, 4000);
    }
  });
}

/* ============================================================
   BUSINESS HOURS OVERLAY
   ============================================================ */
function isAfterHours() {
  const now = new Date();
  return now.getHours() >= 18;
}

function initBusinessHoursOverlay() {
  const overlay = document.getElementById('businessHoursOverlay');
  if (!overlay) return;

  const holdBtn = document.getElementById('businessHoursBtn');
  const progressBar = document.getElementById('businessHoursProgressBar');

  let holdTimer = null;
  let checkTimer = null;
  let userDismissed = false;

  const showOverlay = () => {
    if (isAfterHours() && !userDismissed) {
      overlay.style.display = 'flex';
    }
  };

  const startHold = (e) => {
    e.preventDefault();
    progressBar.classList.remove('animating');
    void progressBar.offsetWidth;
    progressBar.classList.add('animating');

    holdTimer = setTimeout(() => {
      overlay.style.display = 'none';
      userDismissed = true;
      progressBar.classList.remove('animating');
      progressBar.style.width = '0';
    }, 5000);
  };

  const endHold = (e) => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    progressBar.classList.remove('animating');
    setTimeout(() => {
      progressBar.style.width = '0';
    }, 10);
  };

  holdBtn.addEventListener('mousedown', startHold);
  holdBtn.addEventListener('touchstart', startHold, { passive: false });
  holdBtn.addEventListener('mouseup', endHold);
  holdBtn.addEventListener('mouseleave', endHold);
  holdBtn.addEventListener('touchend', endHold);
  holdBtn.addEventListener('touchcancel', endHold);

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.style.display === 'flex') {
      overlay.style.display = 'none';
      userDismissed = true;
      progressBar.classList.remove('animating');
      progressBar.style.width = '0';
    }
  });

  // Reset dismissal at midnight
  const resetDismissal = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const timeUntilMidnight = midnight - now;
    setTimeout(() => {
      userDismissed = false;
      resetDismissal();
    }, timeUntilMidnight);
  };

  showOverlay();
  checkTimer = setInterval(showOverlay, 60000);
  resetDismissal();
}

/* ============================================================
   SEGUIMIENTO DE TAREAS (Task Follow-up Tracker)
   ============================================================ */

let seguimiento = lsGet(KEYS.seguimiento, []);

function saveSeguimiento() {
  lsSet(KEYS.seguimiento, seguimiento);
  syncAllToGAS();
}

function relativeDate(dateStr) {
  const now = new Date();
  const then = new Date(dateStr + 'T12:00:00');
  const diffDays = Math.floor((now - then) / 86400000);
  if (diffDays <= 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  return `hace ${diffDays} días`;
}

function renderSeguimiento() {
  const list = document.getElementById('seguimientoList');
  const empty = document.getElementById('seguimientoEmpty');
  const countEl = document.getElementById('seguimientoCount');
  if (!list) return;

  const pending = seguimiento.filter(item => !item.done);

  if (countEl) {
    countEl.textContent = pending.length;
    countEl.style.display = pending.length > 0 ? 'inline-flex' : 'none';
  }

  list.querySelectorAll('.seguimiento-item, .seguimiento-add-form').forEach(el => el.remove());

  if (pending.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  pending.forEach(item => {
    const el = document.createElement('div');
    el.className = 'seguimiento-item';
    el.dataset.id = item.id;
    el.innerHTML = `
      <span class="seguimiento-item-text">${esc(item.text)}</span>
      <span class="seguimiento-item-date">${relativeDate(item.addedAt)}</span>
      <div class="seguimiento-prio-wrap">
        <button class="seguimiento-item-prio" aria-label="Añadir a prioridades">→ Prio</button>
        <div class="seguimiento-prio-picker" style="display:none;">
          <span class="seguimiento-prio-label">Añadir a:</span>
          <button class="seguimiento-prio-btn" data-cat="dinero">A</button>
          <button class="seguimiento-prio-btn" data-cat="clientes">B</button>
          <button class="seguimiento-prio-btn" data-cat="marca">C</button>
          <button class="seguimiento-prio-cancel">✕</button>
        </div>
      </div>
      <button class="seguimiento-item-done" aria-label="Marcar como listo">✓ Listo</button>
      <button class="seguimiento-item-del" aria-label="Eliminar">×</button>
    `;

    const prioBtn = el.querySelector('.seguimiento-item-prio');
    const prioPicker = el.querySelector('.seguimiento-prio-picker');

    prioBtn.addEventListener('click', () => {
      prioBtn.style.display = 'none';
      prioPicker.style.display = 'flex';
    });

    el.querySelector('.seguimiento-prio-cancel').addEventListener('click', () => {
      prioPicker.style.display = 'none';
      prioBtn.style.display = 'inline-flex';
    });

    el.querySelectorAll('.seguimiento-prio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        if (!prioridades[cat]) prioridades[cat] = [];
        prioridades[cat].push({ id: uid(), text: item.text, done: false, subtasks: [] });
        savePrioridades();
        renderPrioridades();
        prioPicker.style.display = 'none';
        prioBtn.textContent = '✓ Añadida';
        prioBtn.classList.add('seguimiento-item-prio--added');
        prioBtn.style.display = 'inline-flex';
        prioBtn.disabled = true;
      });
    });

    el.querySelector('.seguimiento-item-done').addEventListener('click', () => {
      seguimiento = seguimiento.filter(s => s.id !== item.id);
      saveSeguimiento();
      renderSeguimiento();
    });

    el.querySelector('.seguimiento-item-del').addEventListener('click', () => {
      seguimiento = seguimiento.filter(s => s.id !== item.id);
      saveSeguimiento();
      renderSeguimiento();
    });

    list.appendChild(el);
  });
}

function initSeguimiento() {
  const addBtn = document.getElementById('seguimientoAddBtn');
  if (!addBtn) return;

  addBtn.addEventListener('click', () => {
    const list = document.getElementById('seguimientoList');
    if (list.querySelector('.seguimiento-add-form')) return;

    const empty = document.getElementById('seguimientoEmpty');
    if (empty) empty.style.display = 'none';

    const form = document.createElement('div');
    form.className = 'seguimiento-add-form';
    form.innerHTML = `
      <input class="seguimiento-add-input" type="text" placeholder="Ej: Enviado email a cliente, esperando respuesta..." maxlength="200" />
      <button class="seguimiento-add-ok">Añadir</button>
      <button class="seguimiento-add-cancel">Cancelar</button>
    `;
    list.appendChild(form);
    const input = form.querySelector('.seguimiento-add-input');
    input.focus();

    const confirm = () => {
      const text = input.value.trim();
      if (text) {
        seguimiento.push({ id: uid(), text, addedAt: todayStr(), done: false });
        saveSeguimiento();
        renderSeguimiento();
      } else {
        form.remove();
        renderSeguimiento();
      }
    };

    form.querySelector('.seguimiento-add-ok').addEventListener('click', confirm);
    form.querySelector('.seguimiento-add-cancel').addEventListener('click', () => {
      form.remove();
      renderSeguimiento();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirm();
      if (e.key === 'Escape') { form.remove(); renderSeguimiento(); }
    });
  });

  renderSeguimiento();
}

/* ============================================================
   IMAGE ERROR HANDLING
   ============================================================ */
function initImageFallbacks() {
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', () => {
      img.classList.add('img-error');
    });
  });
}

/**
 * Initialize accordion blocks with collapse/expand functionality
 */
function initAccordions() {
  const accordionCards = document.querySelectorAll('.card--accordion');

  accordionCards.forEach(card => {
    const header = card.querySelector('.card-header');
    if (!header) return;

    header.addEventListener('click', () => {
      card.classList.toggle('collapsed');
      // Save accordion state to localStorage
      const cardId = card.id;
      if (cardId) {
        const isCollapsed = card.classList.contains('collapsed');
        lsSet(`accordion_${cardId}`, isCollapsed);
      }
    });

    // Restore accordion state from localStorage
    const cardId = card.id;
    if (cardId) {
      const wasCollapsed = lsGet(`accordion_${cardId}`, false);
      if (wasCollapsed) {
        card.classList.add('collapsed');
      }
    }
  });
}

/* ============================================================
   MAIN INIT
   ============================================================ */
function initApp() {
  // Re-read data from localStorage (used after GAS sync merge)
  prioridades = lsGet(KEYS.prioridades, { dinero: [], clientes: [], marca: [] });
  clientes = lsGet(KEYS.clientes, []);
  contenido = lsGet(KEYS.contenido, []);

  renderGreeting();
  loadMorningChecks();
  renderPrioridades();
  renderClientes();
  renderKanban();
  loadBienestarChecks();
  renderStats();
  applyTheme();

  const gasInput = document.getElementById('gasUrlInput');
  if (gasInput) gasInput.value = settings.gasUrl || '';
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.getElementById('statusText');
  if (statusDot && statusText) {
    if (settings.gasUrl) {
      statusDot.className = 'status-dot status-dot--green';
      statusText.textContent = 'Conectado';
    } else {
      statusDot.className = 'status-dot status-dot--grey';
      statusText.textContent = 'Sin conexión (modo local)';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Apply theme immediately to avoid flash
  applyTheme();

  // Initialize navigation
  initNav();

  // Initialize accordion blocks
  initAccordions();

  // Initialize all screens
  renderGreeting();
  initMorningChecks();
  initPrioridades();
  initDecision();
  initPomodoro();
  initBulkPrioritize();
  initSeguimiento();
  initClientes();
  initContenido();
  initBienestar();
  initPerfil();
  initBusinessHoursOverlay();
  initImageFallbacks();
  renderStats();

  // Load calendar events and habit streaks from GAS
  if (settings.gasUrl) {
    loadCalendarEvents();
    loadHabitStreaks();
  }

  // Attempt GAS sync (background, will reinit if data found)
  if (settings.gasUrl) {
    syncFromGAS();
  }
});
