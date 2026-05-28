// ==========================================
// app.js - GO NAT (COMPLETO Y FUNCIONAL)
// ==========================================

// ========== CONFIGURACIÓN ==========
const GAS_URL = 'https://script.google.com/macros/s/AKfycby9az8NS5q_jkJTmuu1nixnbwImCvTfAcEOq23BVK1lWQaRvaImUNF6CPQZ8YvLC3Xnwg/exec';

// ========== STORAGE HELPERS ==========
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) { return fallback; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn('localStorage write failed:', key); }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// ========== NAVEGACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
  function setActiveScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const active = document.getElementById(`screen-${screenId}`);
    if (active) active.classList.add('active');
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-screen') === screenId) item.classList.add('active');
    });
  }

  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const screenId = this.getAttribute('data-screen');
      if (screenId) setActiveScreen(screenId);
    });
  });

  setActiveScreen('dashboard');
});

// ========== SALUDO Y FECHA ==========
function setGreetingAndDate() {
  const fecha = new Date();
  const dateEl = document.getElementById('dateText');
  if (dateEl) {
    dateEl.textContent = fecha.toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  const greetingEl = document.getElementById('greetingText');
  if (greetingEl) {
    const hora = fecha.getHours();
    const saludo = hora < 12 ? 'Buenos dias' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
    greetingEl.textContent = `${saludo}, Nati`;
  }
}

// ========== POMODORO ==========
let pomodoroSeconds = 25 * 60;
let pomodoroInterval;

function initPomodoro() {
  const timerEl = document.getElementById('pomodoroTimer');
  const toggleEl = document.getElementById('pomodoroToggle');
  if (!timerEl || !toggleEl) return;

  function updateTimer() {
    const m = Math.floor(pomodoroSeconds / 60);
    const s = pomodoroSeconds % 60;
    timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  toggleEl.addEventListener('change', e => {
    if (e.target.checked) {
      pomodoroInterval = setInterval(() => {
        if (pomodoroSeconds > 0) { pomodoroSeconds--; updateTimer(); }
        else { clearInterval(pomodoroInterval); alert('Pomodoro completado!'); }
      }, 1000);
    } else {
      clearInterval(pomodoroInterval);
    }
  });

  updateTimer();
}

// ========== SINCRONIZACION CON GOOGLE SHEETS ==========
const PRIO_LETRA = { dinero: 'A', clientes: 'B', marca: 'C' };

function syncTaskToGAS(task, cat) {
  if (!GAS_URL) return;
  const params = new URLSearchParams({
    action:       'set',
    id:           task.id,
    tarea:        task.text,
    prioridad:    PRIO_LETRA[cat] || '',
    subprioridad: cat,
    estado:       task.done ? 'hecha' : 'pendiente',
    inicio:       task.addedAt || new Date().toISOString().slice(0, 10),
    entrega:      task.entrega  || '',
    progreso:     task.progreso || '',
    notas:        task.notas   || ''
  });
  fetch(`${GAS_URL}?${params}`)
    .then(r => r.json())
    .then(d => { if (!d.ok) console.warn('GAS sync error:', d); })
    .catch(err => console.warn('GAS sync failed:', err));
}

function deleteTaskFromGAS(taskId) {
  if (!GAS_URL) return;
  const params = new URLSearchParams({ action: 'delete', id: taskId });
  fetch(`${GAS_URL}?${params}`).catch(err => console.warn('GAS delete failed:', err));
}

function syncToGAS() {}

// Carga desde GAS y convierte el array de filas a {dinero,clientes,marca}
async function syncFromGAS() {
  if (!GAS_URL) return null;
  try {
    const res = await fetch(`${GAS_URL}?action=read`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    const prio = { dinero: [], clientes: [], marca: [] };
    rows.forEach(r => {
      const cat = r.subprioridad;
      if (!prio[cat]) return;
      prio[cat].push({
        id:       r.id,
        text:     r.tarea,
        done:     r.estado === 'hecha',
        addedAt:  r.inicio   || '',
        entrega:  r.entrega  || '',
        progreso: r.progreso || '',
        notas:    r.notas    || '',
        subtasks: []
      });
    });
    return prio;
  } catch (e) {
    console.log('GAS fetch error:', e.message);
    return null;
  }
}

async function testAndSyncFromGAS(onStatus) {
  onStatus('loading', 'Conectando con Google Sheets...');
  const prio = await syncFromGAS();
  if (!prio) {
    onStatus('error', 'No se pudo conectar. Verifica que el script este desplegado con acceso "Cualquier usuario".');
    return;
  }
  prioridades = prio;
  lsSet('gonat_prioridades', prio);
  renderPrioridades();
  const count = Object.values(prio).flat().length;
  onStatus('ok', `Conectado — ${count} tareas cargadas desde Sheets`);
}

// ========== IA CON GROQ ==========
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

function getGroqKey() {
  return lsGet('gonat_groq_key', '') || lsGet('gonat_deepseek_key', '');
}

async function classifyWithDeepseek(tasks) {
  const apiKey = getGroqKey();
  if (!apiKey) throw new Error('Falta la API key de Groq. Ve a Perfil > IA para añadirla.');

  const prompt = `Eres asistente de productividad de Nat2Go Studio, una agencia de marketing y comunicacion.\n\nClasifica cada tarea en exactamente una de estas categorias:\n- dinero: facturacion, cobros, presupuestos, contratos, pagos, negociaciones, propuestas economicas. TAMBIEN cualquier tarea personal urgente e intransferible: citas medicas, veterinario, farmacias, tramites administrativos, gestiones bancarias personales, salud propia o de mascotas.\n- clientes: entregas para clientes, reuniones, feedback, revisiones, comunicacion con clientes concretos\n- marca: contenido propio de la marca, redes sociales, newsletter, branding, web, diseño propio\n\nTareas a clasificar:\n${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nResponde SOLO con un JSON valido, sin markdown, sin texto extra. Formato exacto:\n{"dinero":["tarea completa","..."],"clientes":["..."],"marca":["..."]}\n\nReglas: cada tarea va en exactamente una categoria. Si hay duda, prioriza dinero > clientes > marca.`;

  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Respuesta vacia de Groq');

  const cleaned = content.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

// ========== PRIORIDADES ==========
let prioridades = lsGet('gonat_prioridades', { dinero: [], clientes: [], marca: [] });

function savePrioridades() {
  lsSet('gonat_prioridades', prioridades);
  ['dinero', 'clientes', 'marca'].forEach(cat => {
    (prioridades[cat] || []).forEach(task => syncTaskToGAS(task, cat));
  });
}

function renderPrioridades() {
  const catMap = { dinero: 'list-dinero', clientes: 'list-clientes-prio', marca: 'list-marca' };
  ['dinero', 'clientes', 'marca'].forEach(cat => {
    const ul = document.getElementById(catMap[cat]);
    if (!ul) return;
    ul.innerHTML = '';
    (prioridades[cat] || []).forEach((item, i) => {
      const li = document.createElement('li');
      li.className = `priority-item${item.done ? ' done' : ''}`;
      li.innerHTML = `
        <input type="checkbox" class="priority-check" ${item.done ? 'checked' : ''} />
        <span class="priority-item-text">${esc(item.text)}</span>
        <button class="priority-item-del" title="Eliminar">x</button>`;
      li.querySelector('.priority-check').addEventListener('change', () => {
        prioridades[cat][i].done = !prioridades[cat][i].done;
        savePrioridades(); renderPrioridades();
      });
      li.querySelector('.priority-item-del').addEventListener('click', () => {
        const deletedId = prioridades[cat][i].id;
        prioridades[cat].splice(i, 1);
        deleteTaskFromGAS(deletedId);
        savePrioridades(); renderPrioridades();
      });
      ul.appendChild(li);
    });
  });
}

function initPrioridades() {
  document.querySelectorAll('.add-prio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      const existing = btn.parentElement.querySelector('.prio-inline-add');
      if (existing) { existing.querySelector('.prio-inline-input').focus(); return; }

      const row = document.createElement('div');
      row.className = 'prio-inline-add';
      row.innerHTML = `<input class="prio-inline-input" type="text" placeholder="Escribe la tarea..." /><button class="btn btn-primary btn-xs prio-inline-confirm">Añadir</button>`;
      btn.parentElement.insertBefore(row, btn);

      const input = row.querySelector('.prio-inline-input');
      input.focus();

      function addTask() {
        const text = input.value.trim();
        row.remove();
        if (!text) return;
        if (!prioridades[cat]) prioridades[cat] = [];
        prioridades[cat].push({ id: uid(), text, done: false, subtasks: [], addedAt: new Date().toISOString().slice(0, 10) });
        savePrioridades();
        renderPrioridades();
      }

      row.querySelector('.prio-inline-confirm').addEventListener('click', addTask);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') addTask();
        if (e.key === 'Escape') row.remove();
      });
    });
  });
}

// ========== BULK PRIORITIZE CON IA ==========
function initBulkPrioritize() {
  const btn = document.getElementById('bulkPrioritizeBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const textarea = document.getElementById('bulkTasksInput');
    const statusEl = document.getElementById('bulkStatus');
    const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    btn.disabled = true;
    btn.textContent = 'Preguntando a la IA...';
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'bulk-status'; }

    try {
      const result = await classifyWithDeepseek(lines);

      let total = 0;
      ['dinero', 'clientes', 'marca'].forEach(cat => {
        (result[cat] || []).forEach(text => {
          if (!text || !text.trim()) return;
          if (!prioridades[cat]) prioridades[cat] = [];
          prioridades[cat].push({ id: uid(), text: text.trim(), done: false, subtasks: [], addedAt: new Date().toISOString().slice(0, 10) });
          total++;
        });
      });

      savePrioridades();
      renderPrioridades();
      textarea.value = '';

      const counts = {
        a: (result.dinero  || []).length,
        b: (result.clientes|| []).length,
        c: (result.marca   || []).length,
      };
      if (statusEl) {
        statusEl.textContent = `${total} tareas clasificadas: ${counts.a} en A, ${counts.b} en B, ${counts.c} en C`;
        statusEl.className = 'bulk-status bulk-status--ok';
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = err.message;
        statusEl.className = 'bulk-status bulk-status--error';
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/><path d="M18 2v4h4"/></svg> Priorizar con IA`;
    }
  });
}

// ========== SEGUIMIENTO ==========
let seguimiento = lsGet('gonat_seguimiento', []);

function saveSeguimiento() {
  lsSet('gonat_seguimiento', seguimiento);
}

function renderSeguimiento() {
  const list = document.getElementById('seguimientoList');
  const count = document.getElementById('seguimientoCount');
  if (!list) return;
  const pending = seguimiento.filter(t => !t.done);
  if (count) count.textContent = pending.length;
  if (pending.length === 0) {
    list.innerHTML = '<p class="seguimiento-empty">Sin tareas en espera.</p>';
    return;
  }
  list.innerHTML = '';
  pending.forEach(item => {
    const div = document.createElement('div');
    div.className = 'seguimiento-item';
    div.innerHTML = `
      <span class="seguimiento-item-text">${esc(item.text)}</span>
      <button class="seguimiento-done-btn" title="Hecha">OK</button>
      <button class="seguimiento-del-btn" title="Eliminar">x</button>`;
    div.querySelector('.seguimiento-done-btn').addEventListener('click', () => {
      const idx = seguimiento.findIndex(t => t.id === item.id);
      if (idx > -1) seguimiento[idx].done = true;
      saveSeguimiento(); renderSeguimiento();
    });
    div.querySelector('.seguimiento-del-btn').addEventListener('click', () => {
      seguimiento = seguimiento.filter(t => t.id !== item.id);
      saveSeguimiento(); renderSeguimiento();
    });
    list.appendChild(div);
  });
}

function initSeguimiento() {
  const addBtn = document.getElementById('seguimientoAddBtn');
  if (!addBtn) return;
  addBtn.addEventListener('click', () => {
    const text = prompt('Nueva tarea en seguimiento:');
    if (!text || !text.trim()) return;
    seguimiento.push({ id: uid(), text: text.trim(), done: false, addedAt: new Date().toISOString().slice(0,10) });
    saveSeguimiento(); renderSeguimiento();
  });
}

// ========== CLIENTES ==========
let clientes = lsGet('gonat_clientes', []);

function saveClientes() {
  lsSet('gonat_clientes', clientes);
}

function renderClientes() {
  const grid = document.getElementById('clientsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  clientes.forEach((client, ci) => {
    const card = document.createElement('div');
    card.className = 'client-card card';
    const pending = (client.tasks || []).filter(t => !t.done).length;
    card.innerHTML = `
      <div class="client-card-header">
        <h3 class="client-name">${esc(client.name)}</h3>
        ${pending > 0 ? `<span class="client-task-count">${pending} pendiente${pending > 1 ? 's' : ''}</span>` : ''}
      </div>
      <ul class="client-tasks" id="ct-${ci}"></ul>
      <button class="btn btn-ghost btn-xs add-task-btn" data-ci="${ci}">+ Tarea</button>`;
    const taskList = card.querySelector(`#ct-${ci}`);
    (client.tasks || []).forEach((task, ti) => {
      const li = document.createElement('li');
      li.className = `client-task${task.done ? ' done' : ''}`;
      li.innerHTML = `<input type="checkbox" ${task.done ? 'checked' : ''} /><span>${esc(task.text)}</span><button class="client-task-del">x</button>`;
      li.querySelector('input').addEventListener('change', () => {
        clientes[ci].tasks[ti].done = !clientes[ci].tasks[ti].done;
        saveClientes(); renderClientes();
      });
      li.querySelector('.client-task-del').addEventListener('click', () => {
        clientes[ci].tasks.splice(ti, 1);
        saveClientes(); renderClientes();
      });
      taskList.appendChild(li);
    });
    card.querySelector('.add-task-btn').addEventListener('click', () => {
      const text = prompt(`Nueva tarea para ${client.name}:`);
      if (!text || !text.trim()) return;
      if (!clientes[ci].tasks) clientes[ci].tasks = [];
      clientes[ci].tasks.push({ id: uid(), text: text.trim(), done: false });
      saveClientes(); renderClientes();
    });
    grid.appendChild(card);
  });
}

function initClientes() {
  const addBtn = document.getElementById('addClientBtn');
  if (!addBtn) return;
  addBtn.addEventListener('click', () => {
    const name = prompt('Nombre del cliente:');
    if (!name || !name.trim()) return;
    clientes.push({ id: uid(), name: name.trim(), tasks: [], links: [] });
    saveClientes(); renderClientes();
  });
}

// ========== CHECKS ==========
function loadMorningChecks() {
  const today = new Date().toISOString().slice(0,10);
  const data = lsGet(`gonat_checks_${today}`, {});
  document.querySelectorAll('.morning-check').forEach(cb => {
    cb.checked = !!data[cb.dataset.key];
    cb.addEventListener('change', () => {
      data[cb.dataset.key] = cb.checked;
      lsSet(`gonat_checks_${today}`, data);
      renderStats();
    });
  });
}

function loadBienestarChecks() {
  const today = new Date().toISOString().slice(0,10);
  const data = lsGet(`gonat_bienestar_${today}`, {});
  document.querySelectorAll('#bienestarChecks input[type="checkbox"]').forEach(cb => {
    cb.checked = !!data[cb.dataset.key];
    cb.addEventListener('change', () => {
      data[cb.dataset.key] = cb.checked;
      lsSet(`gonat_bienestar_${today}`, data);
      renderStats();
    });
  });
}

function renderStats() {
  const today = new Date().toISOString().slice(0,10);
  const morning = lsGet(`gonat_checks_${today}`, {});
  const bienestar = lsGet(`gonat_bienestar_${today}`, {});
  const mDone = Object.values(morning).filter(Boolean).length;
  const bDone = Object.values(bienestar).filter(Boolean).length;
  const mEl = document.getElementById('statMorningDone');
  const bEl = document.getElementById('statBienestarDone');
  const tEl = document.getElementById('statTotalDone');
  if (mEl) mEl.textContent = mDone;
  if (bEl) bEl.textContent = bDone;
  if (tEl) tEl.textContent = mDone + bDone;
}

// ========== APARIENCIA ==========
function applyTheme() {
  const settings = lsGet('gonat_settings', { theme: 'light' });
  document.body.classList.toggle('dark', settings.theme === 'dark');
}

function initPerfil() {
  const settings = lsGet('gonat_settings', { theme: 'light' });
  const lBtn = document.getElementById('themeLightBtn');
  const dBtn = document.getElementById('themeDarkBtn');
  if (lBtn) {
    lBtn.classList.toggle('active', settings.theme !== 'dark');
    lBtn.addEventListener('click', () => { settings.theme = 'light'; lsSet('gonat_settings', settings); applyTheme(); lBtn.classList.add('active'); if (dBtn) dBtn.classList.remove('active'); });
  }
  if (dBtn) {
    dBtn.classList.toggle('active', settings.theme === 'dark');
    dBtn.addEventListener('click', () => { settings.theme = 'dark'; lsSet('gonat_settings', settings); applyTheme(); dBtn.classList.add('active'); if (lBtn) lBtn.classList.remove('active'); });
  }

  const testBtn = document.getElementById('testGasBtn');
  const testResult = document.getElementById('gasTestResult');
  if (testBtn && testResult) {
    testBtn.addEventListener('click', async () => {
      testBtn.disabled = true;
      testBtn.textContent = 'Probando...';
      await testAndSyncFromGAS((status, msg) => {
        testResult.style.display = 'block';
        testResult.className = `gas-test-result gas-test-result--${status}`;
        testResult.textContent = status === 'ok' ? `OK: ${msg}` : status === 'error' ? `Error: ${msg}` : msg;
      });
      testBtn.disabled = false;
      testBtn.textContent = 'Probar conexion';
    });
  }

  const keyInput = document.getElementById('deepseekKeyInput');
  const saveKeyBtn = document.getElementById('saveDeepseekKeyBtn');
  const keyStatus = document.getElementById('deepseekKeyStatus');
  if (keyInput) {
    const saved = getGroqKey();
    keyInput.value = saved ? `gsk_${'•'.repeat(20)}` : '';
    if (keyStatus && saved) keyStatus.textContent = 'API key guardada';
    if (saveKeyBtn) {
      saveKeyBtn.addEventListener('click', () => {
        const val = keyInput.value.trim();
        if (!val || val.includes('•')) { if (keyStatus) keyStatus.textContent = 'Sin cambios'; return; }
        if (!val.startsWith('gsk_')) { if (keyStatus) { keyStatus.textContent = 'La key de Groq debe empezar con gsk_'; keyStatus.style.color = '#ef4444'; } return; }
        lsSet('gonat_groq_key', val);
        keyInput.value = `gsk_${'•'.repeat(20)}`;
        if (keyStatus) { keyStatus.textContent = 'API key guardada correctamente'; keyStatus.style.color = '#16a34a'; }
      });
    }
  }

  const resetBtn = document.getElementById('resetDayBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!confirm('Restablecer todos los checks de hoy?')) return;
      const today = new Date().toISOString().slice(0,10);
      localStorage.removeItem(`gonat_checks_${today}`);
      localStorage.removeItem(`gonat_bienestar_${today}`);
      loadMorningChecks();
      loadBienestarChecks();
      renderStats();
    });
  }
}

// ========== ACORDEONES ==========
function initAccordions() {
  document.querySelectorAll('[data-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const card = document.getElementById(header.dataset.toggle);
      if (card) card.classList.toggle('collapsed');
    });
  });
}

// ========== DECISION RAPIDA ==========
function initDecision() {
  const btn = document.getElementById('decisionBtn');
  const opts = ['Empieza por Prioridad A', 'Elige la tarea mas urgente', 'Haz la mas corta primero', 'Descansa 5 min y luego empieza'];
  if (!btn) return;
  btn.addEventListener('click', () => {
    const h = document.getElementById('decisionHighlight');
    if (h) { h.textContent = opts[Math.floor(Math.random() * opts.length)]; h.style.display = 'block'; setTimeout(() => h.style.display = 'none', 4000); }
  });
}

// ========== INICIALIZACION ==========
document.addEventListener('DOMContentLoaded', function() {
  applyTheme();
  setGreetingAndDate();
  initPomodoro();
  initAccordions();
  initDecision();

  renderPrioridades();
  initPrioridades();
  initBulkPrioritize();

  renderSeguimiento();
  initSeguimiento();

  renderClientes();
  initClientes();

  loadMorningChecks();
  loadBienestarChecks();
  renderStats();
  initPerfil();

  // Al arrancar: carga desde GAS como fuente de verdad (sincroniza móvil ↔ ordenador)
  syncFromGAS().then(prio => {
    if (!prio) return;
    prioridades = prio;
    lsSet('gonat_prioridades', prio);
    renderPrioridades();
  });
});

console.log('GO Nat - Aplicacion lista');
