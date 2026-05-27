// ==========================================
// GO NAT - CON IA Y GOOGLE SHEETS (CORREGIDO)
// ==========================================

const URL_API = 'https://script.google.com/macros/s/AKfycbwnBN3A5YYfLZaDuyh9Glw2hR5hiX0gKRelT8p2ZKT45B7Bp6c0u8YfeyDGY6YTJGr9Ng/exec';
const DEEPSEEK_API_KEY = 'sk-f0d93900b799462bb6229872d8084939';

let misTareas = [];

// ========== PRIORIZACIÓN CON IA ==========
async function priorizarConIA(texto) {
  try {
    const prompt = `Prioriza esta tarea para Nati. Responde solo A, B o C.
Tarea: "${texto}"
A=urgente/salud/cliente/mascotas(vacunar,veterinario,ula,kai)
B=importante planificable
C=opcional`;

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 5 })
    });
    const data = await res.json();
    let p = data.choices[0].message.content.trim().toUpperCase();
    return ['A', 'B', 'C'].includes(p) ? p : 'B';
  } catch(e) {
    const t = texto.toLowerCase();
    if (t.includes('urgente') || t.includes('hoy') || t.includes('cliente') || t.includes('vacunar') || t.includes('veterinario') || t.includes('ula') || t.includes('kai')) return 'A';
    if (t.includes('preparar') || t.includes('revisar') || t.includes('enviar')) return 'B';
    return 'C';
  }
}

// ========== GOOGLE SHEETS ==========
async function cargarTareasSheets() {
  try {
    const res = await fetch(`${URL_API}?accion=tareas`);
    const data = await res.json();
    if (data.tareas && data.tareas.length > 0) {
      misTareas = data.tareas;
      console.log(`✅ ${misTareas.length} tareas cargadas desde Sheets`);
    } else {
      console.log('📭 No hay tareas en Sheets');
    }
    renderizarTabla();
    return true;
  } catch(e) {
    console.log('📡 Sin conexión a Sheets');
    renderizarTabla();
    return false;
  }
}

async function guardarTareasSheets() {
  try {
    await fetch(`${URL_API}?tareas=${encodeURIComponent(JSON.stringify(misTareas))}`);
    console.log(`💾 ${misTareas.length} tareas guardadas en Sheets`);
    return true;
  } catch(e) {
    console.log('⚠️ No se pudo guardar en Sheets');
    return false;
  }
}

// ========== RENDERIZAR TABLA ==========
function renderizarTabla() {
  const tbody = document.getElementById('tasksTableBody');
  if (!tbody) {
    console.log('❌ No se encontró tasksTableBody');
    return;
  }
  
  if (misTareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:40px;">🎉 No hay tareas. ¡Añade una arriba! 🎉</td></tr>';
    const cont = document.getElementById('contadorPendientes');
    if (cont) cont.innerText = '0 pendientes';
    return;
  }
  
  const orden = { 'A': 1, 'B': 2, 'C': 3 };
  const ordenadas = [...misTareas].sort((a,b) => (orden[a.prioridad]||3) - (orden[b.prioridad]||3));
  
  tbody.innerHTML = ordenadas.map(t => `
    <tr class="${t.estado === 'Completada' ? 'task-row completada' : 'task-row'}">
      <td><input type="checkbox" ${t.estado === 'Completada' ? 'checked' : ''} onchange="window.toggleTarea(${t.id})"></td>
      <td><strong>${escapeHtml(t.tarea)}</strong>${t.notas ? `<br><small>📌 ${escapeHtml(t.notas)}</small>` : ''}</td>
      <td><span class="priority-badge priority-${t.prioridad}">Prioridad ${t.prioridad}</span></td>
      <td><span class="estado-badge estado-${t.estado === 'Completada' ? 'completada' : (t.progreso > 0 ? 'curso' : 'pendiente')}">${t.estado || 'Pendiente'}</span></td>
      <td><div style="display:flex; gap:6px;"><span>${t.progreso||0}%</span><button class="btn-small" onclick="window.cambiarProgreso(${t.id}, ${(t.progreso||0)+10})">+10%</button></div></td>
      <td>${t.inicio || ''}</td>
      <td><input type="date" value="${t.entrega || ''}" onchange="window.cambiarEntrega(${t.id}, this.value)" style="padding:6px; border-radius:40px;"></td>
      <td><button class="btn-small" onclick="window.editarNotas(${t.id})">📝</button></td>
      <td><button class="btn-small btn-danger" onclick="window.eliminarTarea(${t.id})">🗑️</button></td>
    </tr>
  `).join('');
  
  const pendientes = misTareas.filter(t => t.estado !== 'Completada').length;
  const cont = document.getElementById('contadorPendientes');
  if (cont) cont.innerText = `${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`;
  
  console.log(`✅ Tabla renderizada con ${misTareas.length} tareas`);
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

// ========== ACCIONES GLOBALES ==========
window.toggleTarea = (id) => {
  const t = misTareas.find(t => t.id == id);
  if (t) { t.estado = t.estado === 'Completada' ? 'Pendiente' : 'Completada'; t.progreso = t.estado === 'Completada' ? 100 : (t.progreso||0); renderizarTabla(); guardarTareasSheets(); }
};
window.cambiarProgreso = (id, p) => {
  const t = misTareas.find(t => t.id == id);
  if (t) { t.progreso = Math.min(100, Math.max(0, p)); if (t.progreso === 100) t.estado = 'Completada'; else if (t.progreso > 0 && t.estado !== 'Completada') t.estado = 'En curso'; renderizarTabla(); guardarTareasSheets(); }
};
window.cambiarEntrega = (id, f) => {
  const t = misTareas.find(t => t.id == id);
  if (t) { t.entrega = f; guardarTareasSheets(); }
};
window.editarNotas = (id) => {
  const t = misTareas.find(t => t.id == id);
  if (t) { const n = prompt('Notas:', t.notas || ''); if (n !== null) { t.notas = n; renderizarTabla(); guardarTareasSheets(); } }
};
window.eliminarTarea = (id) => {
  if (confirm('¿Eliminar esta tarea?')) { misTareas = misTareas.filter(t => t.id != id); renderizarTabla(); guardarTareasSheets(); }
};

// ========== AGREGAR TAREA ==========
async function agregarTarea(texto, modo) {
  if (!texto.trim()) return;
  
  let prioridad;
  const statusEl = document.getElementById('syncStatus');
  
  if (modo === 'auto') {
    if (statusEl) statusEl.innerHTML = '🤖 IA pensando...';
    prioridad = await priorizarConIA(texto);
    if (statusEl) statusEl.innerHTML = '✅ Priorizado con IA';
  } else {
    prioridad = modo;
  }
  
  const nuevaTarea = {
    id: Date.now(),
    tarea: texto.trim(),
    prioridad: prioridad,
    estado: 'Pendiente',
    progreso: 0,
    inicio: new Date().toLocaleDateString('es-ES'),
    entrega: '',
    notas: ''
  };
  
  misTareas.unshift(nuevaTarea);
  renderizarTabla();
  await guardarTareasSheets();
  console.log(`➕ Tarea añadida: "${texto}" (Prioridad ${prioridad})`);
}

// ========== CAPTURA MASIVA ==========
async function procesarCapturaMasiva() {
  const ta = document.getElementById('bulkTasksInput');
  if (!ta || !ta.value.trim()) { alert('Escribe tareas (una por línea)'); return; }
  const lineas = ta.value.split(/\r?\n/).filter(l => l.trim());
  if (lineas.length === 0) return;
  
  const statusEl = document.getElementById('syncStatus');
  if (statusEl) statusEl.innerHTML = `🤖 Procesando ${lineas.length} tareas...`;
  
  for (const linea of lineas) {
    await agregarTarea(linea, 'auto');
  }
  ta.value = '';
  if (statusEl) statusEl.innerHTML = `✅ ${lineas.length} tareas añadidas con IA`;
  alert(`✨ ${lineas.length} tareas añadidas`);
}

// ========== NAVEGACIÓN ==========
function initNavegacion() {
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const screen = item.dataset.screen;
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const activeScreen = document.getElementById(`screen-${screen}`);
      if (activeScreen) activeScreen.classList.add('active');
      document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// ========== SALUDO Y FECHA ==========
function setSaludoYFecha() {
  const fecha = new Date();
  const dateEl = document.getElementById('dateText');
  const greetingEl = document.getElementById('greetingText');
  if (dateEl) dateEl.innerHTML = fecha.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (greetingEl) {
    const hora = fecha.getHours();
    const saludo = hora < 12 ? 'Buenos días' : (hora < 20 ? 'Buenas tardes' : 'Buenas noches');
    greetingEl.innerHTML = `${saludo}, Nati`;
  }
}

// ========== POMODORO ==========
function initPomodoro() {
  let tiempo = 25 * 60;
  let activo = false;
  let intervalo;
  const timerEl = document.getElementById('pomodoroTimer');
  const toggleEl = document.getElementById('pomodoroToggle');
  
  function actualizar() {
    if (timerEl) {
      const minutos = Math.floor(tiempo / 60);
      const segundos = tiempo % 60;
      timerEl.innerHTML = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
    }
  }
  
  if (toggleEl) {
    toggleEl.addEventListener('change', (e) => {
      if (e.target.checked) {
        activo = true;
        intervalo = setInterval(() => {
          if (tiempo > 0 && activo) { tiempo--; actualizar(); }
          else if (tiempo === 0) { clearInterval(intervalo); alert('¡Pomodoro completado!'); }
        }, 1000);
      } else { activo = false; clearInterval(intervalo); }
    });
  }
  actualizar();
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando panel...');
  
  initNavegacion();
  setSaludoYFecha();
  initPomodoro();
  
  await cargarTareasSheets();
  
  const agregarBtn = document.getElementById('agregarTareaBtn');
  const tareaInput = document.getElementById('nuevaTareaInput');
  const prioridadSelect = document.getElementById('prioridadManualSelect');
  const bulkBtn = document.getElementById('bulkPrioritizeBtn');
  const limpiarBtn = document.getElementById('limpiarCompletadasBtn');
  
  if (agregarBtn) {
    agregarBtn.onclick = async () => {
      await agregarTarea(tareaInput.value, prioridadSelect.value);
      tareaInput.value = '';
    };
  }
  if (bulkBtn) bulkBtn.onclick = procesarCapturaMasiva;
  if (limpiarBtn) {
    limpiarBtn.onclick = () => {
      if (confirm('¿Eliminar todas las tareas completadas?')) {
        misTareas = misTareas.filter(t => t.estado !== 'Completada');
        renderizarTabla();
        guardarTareasSheets();
      }
    };
  }
  
  console.log('✅ Panel listo con IA y Google Sheets');
});
