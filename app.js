// GO NAT - app.js MÍNIMO (solo navegación y pomodoro)
console.log("App cargada");

// Navegación
document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const screen = item.dataset.screen;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screen}`).classList.add('active');
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
  });
});

// Fecha y saludo
const fecha = new Date();
document.getElementById('dateText').innerHTML = fecha.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const hora = fecha.getHours();
const saludo = hora < 12 ? 'Buenos días' : (hora < 20 ? 'Buenas tardes' : 'Buenas noches');
document.getElementById('greetingText').innerHTML = `${saludo}, Nati`;

// Pomodoro básico
let tiempo = 25 * 60;
let activo = false;
let intervalo;

function actualizarTimer() {
  const minutos = Math.floor(tiempo / 60);
  const segundos = tiempo % 60;
  document.getElementById('pomodoroTimer').innerHTML = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
}

document.getElementById('pomodoroToggle')?.addEventListener('change', (e) => {
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
