// ==========================================
// app.js - GO NAT (COMPLETO Y FUNCIONAL)
// ==========================================

document.addEventListener('DOMContentLoaded', function() {

  // ========== NAVEGACIÓN ==========
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

  // ========== SALUDO Y FECHA ==========
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

  // ========== POMODORO ==========
  let tiempo = 25 * 60;
  let activo = false;
  let intervalo;
  const timerEl = document.getElementById('pomodoroTimer');
  const toggleEl = document.getElementById('pomodoroToggle');
  
  function actualizarTimer() {
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
  }
  actualizarTimer();

  // ========== INICIO ==========
  setActiveScreen('dashboard');
});
