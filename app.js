// ==========================================
// app.js - GO NAT (COMPLETO Y FUNCIONAL)
// ==========================================

// ========== CONFIGURACIÓN ==========
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzQf8I5IYpQBQwb2rCwvcLfKsJvGAGQBrx8HRKxZqOzg9fidmw4vZdu-2JYqty9invMjA/exec';

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
function guessTab(key) {
  if (key.includes('prioridad') || key === 'gonat_prioridades') return 'Prioridades';
  if (key.includes('cliente') || key === 'gonat_clientes') return 'Clientes';
  if (key.includes('contenido') || key === 'gonat_contenido') return 'Contenido';
  if (key.includes('check') || key.includes('bienestar')) return 'Checks';
  return 'Misc';
}

async function syncToGAS(key, value, tab) {
  if (!GAS_URL) return;
  // no-cors no permite Content-Type: application/json
  // enviamos el body sin cabecera — GAS lo recibe en e.postData.contents igual
  fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({ tab: tab || guessTab(key), key, value: JSON.stringify(value) })
  }).catch(() => {});
}

async function syncFromGAS() {
  if (!GAS_URL) return null;
  try {
    const res = await fetch(`${GAS_URL}?action=all`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.log('GAS fetch error:', e.message);
    return null;
  }
}

async function testAndSyncFromGAS(onStatus) {
  onStatus('loading', 'Conectando con Google Sheets...');
  const data = await syncFromGAS();
  if (!data || data.error) {
    onStatus('error', data && data.error ? data.error : 'No se pudo conectar. Verifica que el script este desplegado con acceso "Cualquier usuario".');
    return;
  }
  const prio = data['gonat_prioridades'] || data['prioridades'];
  const seg  = data['gonat_seguimiento']  || data['seguimiento'];
  const cli  = data['gonat_clientes']     || data['clientes'];
  if (prio) { prioridades = prio; lsSet('gonat_prioridades', prio); }
  if (seg)  { seguimiento = seg;  lsSet('gonat_seguimiento', seg); }
  if (cli)  { clientes = cli;     lsSet('gonat_clientes', cli); }
  renderPrioridades();
  renderClientes();
  renderSeguimiento();
  const pCount = Object.values(prio || {}).flat().length;
  const sCount = (seg || []).length;
  const cCount = (cli || []).length;
  onStatus('ok', `Conectado — ${pCount} prioridades, ${sCount} seguimiento, ${cCount} clientes`);
}

// ========== IA CON GROQ ==========
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

function getGroqKey() {
  return lsGet('gonat_groq_key', '') || lsGet('gonat_deepseek_key', '');
}

async function classifyWithDeepseek(tasks) {
  const apiKey = getGroqKey();
  if (!apiKey) throw new Error('Falta la API key de Groq. Ve a Perfil > IA para añadirla.');

  const prompt = `Eres asistente de productividad de Nat2Go Studio, una agencia de marketing y comunicacion.

Clasifica cada tarea en exactamente una de estas categorias:
- dinero: facturacion, cobros, presupuestos, contratos, pagos, negociaciones, propuestas economicas. TAMBIEN cualquier tarea personal urgente e intransferible: citas medicas, veterinario, farmacias, tramites administrativos, gestiones bancarias personales, salud propia o de mascotas.
- clientes: entregas para clientes, reuniones, feedback, revisiones, comunicacion con clientes concretos
- marca: contenido propio de la marca, redes sociales, newsletter, branding, web, diseño propio

Tareas a clasificar:
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Responde SOLO con un JSON valido, sin markdown, sin texto extra. Formato exacto:
{"dinero":["tarea completa","..."],"clientes":["..."],"marca":["..."]}

Reglas: cada tarea va en exactamente una categoria. Si hay duda, prioriza dinero > clientes > marca.`;

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
  syncToGAS('gonat_prioridades', prioridades, 'Prioridades');
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
        prioridades[cat].splice(i, 1);
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
      const labels = { dinero: 'A (Dinero)', clientes: 'B (Clientes)', marca: 'C (Marca)' };
      const text = prompt(`Nueva tarea — Prioridad ${labels[cat]}:`);
      if (!text || !text.trim()) return;
      if (!prioridades[cat]) prioridades[cat] = [];
      prioridades[cat].push({ id: uid(), text: text.trim(), done: false, subtasks: [] });
      savePrioridades(); renderPrioridades();
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
          prioridades[cat].push({ id: uid(), text: text.trim(), done: false, subtasks: [] });
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
  syncToGAS('gonat_seguimiento', seguimiento, 'Misc');
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
  syncToGAS('gonat_clientes', clientes, 'Clientes');
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
      syncToGAS(`gonat_checks_${today}`, data, 'Checks');
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
      syncToGAS(`gonat_bienestar_${today}`, data, 'Checks');
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

  // Groq API key
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

  // Sync en segundo plano al cargar
  syncFromGAS().then(data => {
    if (!data || data.error) return;
    const prio = data['gonat_prioridades'] || data['prioridades'];
    const seg  = data['gonat_seguimiento']  || data['seguimiento'];
    const cli  = data['gonat_clientes']     || data['clientes'];
    if (prio) { prioridades = prio; lsSet('gonat_prioridades', prio); renderPrioridades(); }
    if (seg)  { seguimiento = seg;  lsSet('gonat_seguimiento', seg);  renderSeguimiento(); }
    if (cli)  { clientes = cli;     lsSet('gonat_clientes', cli);     renderClientes(); }
  });
});

console.log('GO Nat - Aplicacion lista');
