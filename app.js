// GO NAT - app.js (versión limpia, solo pantallas y pomodoro)

// ==================== NAVEGACIÓN ====================
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item');
  const screens = document.querySelectorAll('.screen');
  
  function setActiveScreen(screenId) {
    screens.forEach(screen => screen.classList.remove('active'));
    const activeScreen = document.getElementById(`screen-${screenId}`);
    if (activeScreen) activeScreen.classList.add('active');
    
    navItems.forEach(item => item.classList.remove('active'));
    const activeNav = document.querySelector(`[data-screen="${screenId}"]`);
    if (activeNav) activeNav.classList.add('active');
  }
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const screenId = item.getAttribute('data-screen');
      if (screenId) setActiveScreen(screenId);
    });
  });
}

// ==================== SALUDO Y FECHA ====================
function setGreetingAndDate() {
  const greetingEl = document.getElementById('greetingText');
  const dateEl = document.getElementById('dateText');
  
  if (greetingEl) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : (hour < 20 ? 'Buenas tardes' : 'Buenas noches');
    greetingEl.textContent = `${greeting}, Nati`;
  }
  
  if (dateEl) {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = today.toLocaleDateString('es-ES', options);
  }
}

// ==================== POMODORO ====================
function initPomodoro() {
  const timerEl = document.getElementById('pomodoroTimer');
  const toggleEl = document.getElementById('pomodoroToggle');
  if (!timerEl || !toggleEl) return;
  
  let timeLeft = 25 * 60;
  let interval = null;
  
  function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  toggleEl.addEventListener('change', (e) => {
    if (e.target.checked) {
      interval = setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
          updateDisplay();
        } else {
          clearInterval(interval);
          toggleEl.checked = false;
          alert('¡Pomodoro completado! Tiempo de descanso.');
          timeLeft = 25 * 60;
          updateDisplay();
        }
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
  });
  
  updateDisplay();
}

// ==================== INICIALIZAR TODO ====================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  setGreetingAndDate();
  initPomodoro();
  console.log('✅ Panel inicializado correctamente');
});
