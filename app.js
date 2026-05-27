// ==========================================
// app.js - GO NAT (COMPLETO Y FUNCIONAL)
// ==========================================

// ========== CONFIGURACIÓN ==========
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwnBN3A5YYfLZaDuyh9Glw2hR5hiX0gKRelT8p2ZKT45B7Bp6c0u8YfeyDGY6YTJGr9Ng/exec';

// ========== NAVEGACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
  function setActiveScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const activeScreen = document.getElementById(`screen-${screenId}`);
    if (activeScreen) activeScreen.classList.add('active');
    
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
    dateEl.innerHTML = fecha.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  const greetingEl = document.getElementById('greetingText');
  if (greetingEl) {
    const hora = fecha.getHours();
    const saludo = hora < 12 ? 'Buenos días' : (hora < 20 ? 'Buenas tardes' : 'Buenas noches');
    greetingEl.innerHTML = `${saludo}, Nati`;
  }
}

// ========== POMODORO ==========
let tiempo = 25 * 60;
let activo = false;
let intervalo;

function initPomodoro() {
  const timerEl = document.getElementById('pomodoroTimer');
  const toggleEl = document.getElementById('pomodoroToggle');
  
  if (!timerEl || !toggleEl) return;
  
  function actualizarTimer() {
    const minutos = Math.floor(tiempo / 60);
    const segundos = tiempo % 60;
    timerEl.innerHTML = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  }
  
  toggleEl.addEventListener('change', (e) => {
    if (e.target.checked) {
      activo = true;
      intervalo = setInterval(() => {
        if (tiempo > 0 && activo) {
          tiempo--;
          actualizarTimer();
        } else if (tiempo === 0) {
          clearInterval(intervalo);
          alert('¡Pomodoro completado!');
        }
      }, 1000);
    } else {
      activo = false;
      clearInterval(intervalo);
    }
  });
  
  actualizarTimer();
}

// ========== SINCRONIZACIÓN CON GOOGLE SHEETS ==========
// Guardar datos en Google Sheets
async function syncToGAS(key, value) {
  if (!GAS_URL) return;
  try {
    const data = { key, value: JSON.stringify(value) };
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log('✅ Sincronizado con Google Sheets:', key);
  } catch(e) {
    console.log('⚠️ Error al sincronizar:', e);
  }
}

// Cargar datos desde Google Sheets
async function syncFromGAS() {
  if (!GAS_URL) return;
  try {
    const response = await fetch(`${GAS_URL}?action=all`);
    const data = await response.json();
    if (data && !data.error) {
      console.log('✅ Datos cargados desde Google Sheets');
      return data;
    }
  } catch(e) {
    console.log('⚠️ Error al cargar desde Google Sheets:', e);
  }
  return null;
}

// ========== GUARDAR PRIORIDADES AUTOMÁTICAMENTE ==========
function savePrioridadesToSheets(prioridades) {
  localStorage.setItem('prioridades', JSON.stringify(prioridades));
  syncToGAS('prioridades', prioridades);
}

function loadPrioridadesFromSheets() {
  return JSON.parse(localStorage.getItem('prioridades') || '{"dinero":[],"clientes":[],"marca":[]}');
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
  setGreetingAndDate();
  initPomodoro();
  
  // Cargar prioridades guardadas
  const prioridades = loadPrioridadesFromSheets();
  console.log('📋 Prioridades cargadas:', prioridades);
  
  // Sincronizar con Google Sheets en segundo plano
  syncFromGAS().then(data => {
    if (data && data.prioridades) {
      localStorage.setItem('prioridades', JSON.stringify(data.prioridades));
      console.log('📥 Prioridades sincronizadas desde la nube');
    }
  });
});

// ========== FUNCIONES AUXILIARES PARA PRIORIDADES ==========
function agregarPrioridad(categoria, texto) {
  if (!texto.trim()) return;
  const prioridades = loadPrioridadesFromSheets();
  if (!prioridades[categoria]) prioridades[categoria] = [];
  prioridades[categoria].push({ 
    id: Date.now(), 
    text: texto.trim(), 
    done: false,
    subtasks: [],
    startDate: null,
    dueDate: null
  });
  savePrioridadesToSheets(prioridades);
  // Aquí puedes llamar a renderPrioridades() si tienes esa función
  console.log(`✅ Prioridad ${categoria}: "${texto}" añadida`);
}

function togglePrioridad(categoria, index) {
  const prioridades = loadPrioridadesFromSheets();
  if (prioridades[categoria] && prioridades[categoria][index]) {
    prioridades[categoria][index].done = !prioridades[categoria][index].done;
    savePrioridadesToSheets(prioridades);
    console.log(`🔄 Prioridad ${categoria} actualizada`);
  }
}

function eliminarPrioridad(categoria, index) {
  const prioridades = loadPrioridadesFromSheets();
  if (prioridades[categoria] && prioridades[categoria][index]) {
    prioridades[categoria].splice(index, 1);
    savePrioridadesToSheets(prioridades);
    console.log(`🗑️ Prioridad ${categoria} eliminada`);
  }
}

console.log('🚀 GO Nat - Aplicación lista');
