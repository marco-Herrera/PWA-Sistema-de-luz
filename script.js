/* ============================================================
   LUMI · Prototipo funcional (frontend)
   ------------------------------------------------------------
   Este archivo simula el comportamiento del sistema embebido
   (ESP32 + sensores PIR/LDR + relé/dimmer) para poder probar
   toda la interfaz sin hardware conectado.

   Para conectarlo al ESP32 real:
   1) Cambia SIMULATION_MODE a false.
   2) Ajusta ESP32_BASE_URL a la IP/mDNS de tu placa
      (ej. "http://lumi.local" o "http://192.168.1.50").
   3) En el ESP32, expón endpoints REST (o un WebSocket) que
      respondan/acepten el mismo formato de datos usado aquí,
      por ejemplo:
        GET  /api/status   -> { power, brightness, mode, pir, ldr }
        POST /api/light    <- { power, brightness }
        POST /api/mode     <- { mode: "auto" | "manual" }
        GET  /api/history?range=dia|semana|mes
        POST /api/rules    <- { inactivityMin, night: {...}, security: {...} }
      Cada función marcada con "🔌 ESP32:" indica dónde reemplazar
      el mock por la llamada real (fetch/WebSocket).
   ============================================================ */

const SIMULATION_MODE = true;
const ESP32_BASE_URL = "http://lumi.local"; // usar cuando SIMULATION_MODE = false

const STORAGE_KEY = "lumi-state-v1";

/* ---------- Estado central de la app ---------- */
const defaultState = {
  power: true,
  brightness: 75,
  mode: "auto", // "auto" | "manual"
  pir: true,
  ldr: 420,
  inactivityMin: 5,
  night: { enabled: true, intensity: 60, start: "22:00", end: "06:00" },
  security: {
    enabled: true,
    start: "23:00",
    end: "05:00",
    alerts: [{ label: "Última detección: 03:15 AM" }]
  },
  savingsPct: 38,
  weeklyKwh: 4.2,
  history: {
    dia: { labels: ["00", "04", "08", "12", "16", "20"], values: [0.1, 0.05, 0.3, 0.6, 0.5, 0.8] },
    semana: { labels: ["L", "M", "X", "J", "V", "S", "D"], values: [2.9, 3.7, 2.8, 3.3, 4.7, 4.1, 2.2] },
    mes: { labels: ["S1", "S2", "S3", "S4"], values: [18.4, 21.2, 19.8, 23.6] }
  }
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    return { ...structuredClone(defaultState), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* almacenamiento no disponible: se ignora */ }
}

/* ============================================================
   NAVEGACIÓN ENTRE VISTAS
   ============================================================ */
const navButtons = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view, btn));
});

function switchView(viewId, btn) {
  views.forEach((v) => v.classList.toggle("view--active", v.id === viewId));
  navButtons.forEach((b) => {
    const active = b === btn;
    b.classList.toggle("nav-btn--active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
}

/* ============================================================
   PANTALLA: INICIO
   ============================================================ */
const dial = document.getElementById("dial");
const dialProgress = document.getElementById("dialProgress");
const brightnessValue = document.getElementById("brightnessValue");
const powerToggle = document.getElementById("powerToggle");
const modeAutoBtn = document.getElementById("modeAuto");
const modeManualBtn = document.getElementById("modeManual");
const pirCard = document.getElementById("pirCard");
const pirValue = document.getElementById("pirValue");
const ldrValue = document.getElementById("ldrValue");
const shortcutDay = document.getElementById("shortcutDay");
const shortcutNight = document.getElementById("shortcutNight");

const DIAL_RADIUS = 92;
const DIAL_CIRC = 2 * Math.PI * DIAL_RADIUS;
dialProgress.style.strokeDasharray = `${DIAL_CIRC}`;

function renderDial() {
  const pct = Math.max(0, Math.min(100, state.power ? state.brightness : 0));
  const offset = DIAL_CIRC - (pct / 100) * DIAL_CIRC;
  dialProgress.style.strokeDashoffset = offset;
  brightnessValue.textContent = `${Math.round(pct)}%`;
  dial.setAttribute("aria-valuenow", Math.round(pct));
}

function renderPower() {
  powerToggle.textContent = state.power ? "Encendido" : "Apagado";
  powerToggle.classList.toggle("state-value--off", !state.power);
  renderDial();
}

function renderMode() {
  const isAuto = state.mode === "auto";
  modeAutoBtn.classList.toggle("segmented-btn--active", isAuto);
  modeAutoBtn.setAttribute("aria-selected", isAuto ? "true" : "false");
  modeManualBtn.classList.toggle("segmented-btn--active", !isAuto);
  modeManualBtn.setAttribute("aria-selected", !isAuto ? "true" : "false");
  // En modo manual el usuario puede arrastrar el dial; en automático lo decide el ESP32.
  dial.style.cursor = isAuto ? "default" : "pointer";
}

function renderSensors() {
  pirValue.textContent = state.pir ? "Ocupado" : "Libre";
  pirCard.classList.toggle("sensor-card--active", state.pir);
  ldrValue.textContent = `${Math.round(state.ldr)} Lux`;
}

powerToggle.addEventListener("click", () => {
  state.power = !state.power;
  renderPower();
  saveState();
  sendLightCommand(); // 🔌 ESP32: POST /api/light { power, brightness }
});

modeAutoBtn.addEventListener("click", () => setMode("auto"));
modeManualBtn.addEventListener("click", () => setMode("manual"));

function setMode(mode) {
  state.mode = mode;
  renderMode();
  saveState();
  sendModeCommand(); // 🔌 ESP32: POST /api/mode { mode }
}

shortcutDay.addEventListener("click", () => {
  state.mode = "auto";
  state.power = true;
  state.brightness = 80;
  renderMode(); renderPower();
  saveState();
  sendLightCommand();
  sendModeCommand();
});

shortcutNight.addEventListener("click", () => {
  state.mode = "manual";
  state.power = true;
  state.brightness = state.night.intensity;
  renderMode(); renderPower();
  saveState();
  sendLightCommand();
  sendModeCommand();
});

/* --- Interacción con el dial circular (solo en modo manual) --- */
let draggingDial = false;

function angleFromEvent(evt) {
  const rect = dial.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const point = evt.touches ? evt.touches[0] : evt;
  const dx = point.clientX - cx;
  const dy = point.clientY - cy;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90; // 0° arriba
  if (deg < 0) deg += 360;
  return deg;
}

function setBrightnessFromAngle(evt) {
  if (state.mode !== "manual") return;
  const deg = angleFromEvent(evt);
  const pct = Math.round((deg / 360) * 100);
  state.brightness = Math.max(0, Math.min(100, pct));
  state.power = state.brightness > 0;
  renderPower();
}

dial.addEventListener("pointerdown", (e) => {
  if (state.mode !== "manual") return;
  draggingDial = true;
  setBrightnessFromAngle(e);
});
window.addEventListener("pointermove", (e) => {
  if (draggingDial) setBrightnessFromAngle(e);
});
window.addEventListener("pointerup", () => {
  if (draggingDial) {
    draggingDial = false;
    saveState();
    sendLightCommand(); // 🔌 ESP32: POST /api/light { power, brightness }
  }
});

dial.addEventListener("keydown", (e) => {
  if (state.mode !== "manual") return;
  if (e.key === "ArrowUp" || e.key === "ArrowRight") {
    state.brightness = Math.min(100, state.brightness + 5);
  } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
    state.brightness = Math.max(0, state.brightness - 5);
  } else return;
  state.power = state.brightness > 0;
  renderPower();
  saveState();
  sendLightCommand();
});

/* ============================================================
   PANTALLA: REGLAS
   ============================================================ */
const connDot = document.getElementById("connDot");
const inactivityRange = document.getElementById("inactivityRange");
const inactivityValue = document.getElementById("inactivityValue");

const nightModeToggle = document.getElementById("nightModeToggle");
const nightModeBody = document.getElementById("nightModeBody");
const nightIntensityRange = document.getElementById("nightIntensityRange");
const nightStart = document.getElementById("nightStart");
const nightEnd = document.getElementById("nightEnd");

const securityModeToggle = document.getElementById("securityModeToggle");
const securityModeBody = document.getElementById("securityModeBody");
const securityStart = document.getElementById("securityStart");
const securityEnd = document.getElementById("securityEnd");
const lastAlert = document.getElementById("lastAlert");
const alertBanner = document.getElementById("alertBanner");

function fillSlider(input) {
  const min = Number(input.min), max = Number(input.max), val = Number(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty("--fill", `${pct}%`);
}

function renderRules() {
  inactivityRange.value = state.inactivityMin;
  inactivityValue.textContent = state.inactivityMin;
  fillSlider(inactivityRange);

  nightModeToggle.checked = state.night.enabled;
  nightModeBody.style.opacity = state.night.enabled ? "1" : ".4";
  nightModeBody.style.pointerEvents = state.night.enabled ? "auto" : "none";
  nightIntensityRange.value = state.night.intensity;
  fillSlider(nightIntensityRange);
  nightStart.value = state.night.start;
  nightEnd.value = state.night.end;

  securityModeToggle.checked = state.security.enabled;
  securityModeBody.style.opacity = state.security.enabled ? "1" : ".4";
  securityModeBody.style.pointerEvents = state.security.enabled ? "auto" : "none";
  securityStart.value = state.security.start;
  securityEnd.value = state.security.end;
  const alerts = state.security.alerts;
  lastAlert.textContent = alerts.length
    ? alerts[alerts.length - 1].label
    : "Sin detecciones registradas";
}

inactivityRange.addEventListener("input", () => {
  state.inactivityMin = Number(inactivityRange.value);
  inactivityValue.textContent = state.inactivityMin;
  fillSlider(inactivityRange);
});
inactivityRange.addEventListener("change", () => { saveState(); sendRules(); });

nightModeToggle.addEventListener("change", () => {
  state.night.enabled = nightModeToggle.checked;
  renderRules();
  saveState();
  sendRules(); // 🔌 ESP32: POST /api/rules
});

nightIntensityRange.addEventListener("input", () => {
  state.night.intensity = Number(nightIntensityRange.value);
  fillSlider(nightIntensityRange);
});
nightIntensityRange.addEventListener("change", () => { saveState(); sendRules(); });

nightStart.addEventListener("change", () => { state.night.start = nightStart.value; saveState(); sendRules(); });
nightEnd.addEventListener("change", () => { state.night.end = nightEnd.value; saveState(); sendRules(); });

securityModeToggle.addEventListener("change", () => {
  state.security.enabled = securityModeToggle.checked;
  renderRules();
  saveState();
  sendRules();
});
securityStart.addEventListener("change", () => { state.security.start = securityStart.value; saveState(); sendRules(); });
securityEnd.addEventListener("change", () => { state.security.end = securityEnd.value; saveState(); sendRules(); });

alertBanner.addEventListener("click", () => {
  // En producción esto podría abrir un historial completo o una vista de log.
  switchView("view-estadisticas", document.getElementById("tab-estadisticas"));
});

/* ============================================================
   PANTALLA: ESTADÍSTICAS
   ============================================================ */
const chart = document.getElementById("chart");
const rangeButtons = document.querySelectorAll(".range-btn");
const savingsValue = document.getElementById("savingsValue");
const weeklyValue = document.getElementById("weeklyValue");

let currentRange = "semana";

rangeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentRange = btn.dataset.range;
    rangeButtons.forEach((b) => {
      const active = b === btn;
      b.classList.toggle("range-btn--active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    renderChart();
    loadHistory(currentRange); // 🔌 ESP32: GET /api/history?range=...
  });
});

function renderChart() {
  const { labels, values } = state.history[currentRange];
  const W = 340, H = 300;
  const paddingBottom = 30, paddingTop = 20;
  const usableH = H - paddingBottom - paddingTop;
  const maxVal = Math.max(...values) * 1.15 || 1;

  const barGap = 14;
  const barW = (W - barGap * (values.length + 1)) / values.length;

  let svg = "";

  // líneas de referencia horizontales
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = paddingTop + (usableH / gridLines) * i;
    const val = (maxVal * (gridLines - i)) / gridLines;
    svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#233043" stroke-width="1"/>`;
    svg += `<text x="0" y="${y - 6}" fill="#93a0b3" font-size="11">${val.toFixed(1)}</text>`;
  }

  values.forEach((v, i) => {
    const barH = (v / maxVal) * usableH;
    const x = barGap + i * (barW + barGap);
    const y = paddingTop + usableH - barH;
    svg += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, 2)}"
              rx="6" fill="none" stroke="#55d6f2" stroke-width="2.5"
              style="filter:drop-shadow(0 0 6px rgba(85,214,242,.65))"></rect>`;
    svg += `<text x="${x + barW / 2}" y="${H - paddingBottom + 20}" fill="#93a0b3"
              font-size="13" text-anchor="middle">${labels[i]}</text>`;
  });

  chart.innerHTML = svg;
}

function renderStats() {
  savingsValue.textContent = state.savingsPct;
  weeklyValue.textContent = state.weeklyKwh.toFixed(1);
}

/* ============================================================
   COMUNICACIÓN CON EL ESP32 (mock ↔ real)
   ============================================================ */
async function sendLightCommand() {
  if (SIMULATION_MODE) return; // el mock ya actualizó el estado local
  try {
    await fetch(`${ESP32_BASE_URL}/api/light`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ power: state.power, brightness: state.brightness })
    });
  } catch (err) {
    console.error("No se pudo contactar al ESP32 (light):", err);
    setConnection(false);
  }
}

async function sendModeCommand() {
  if (SIMULATION_MODE) return;
  try {
    await fetch(`${ESP32_BASE_URL}/api/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: state.mode })
    });
  } catch (err) {
    console.error("No se pudo contactar al ESP32 (mode):", err);
    setConnection(false);
  }
}

async function sendRules() {
  if (SIMULATION_MODE) return;
  try {
    await fetch(`${ESP32_BASE_URL}/api/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inactivityMin: state.inactivityMin,
        night: state.night,
        security: state.security
      })
    });
  } catch (err) {
    console.error("No se pudo contactar al ESP32 (rules):", err);
    setConnection(false);
  }
}

async function loadHistory(range) {
  if (SIMULATION_MODE) return; // ya usamos los datos mock guardados en state.history
  try {
    const res = await fetch(`${ESP32_BASE_URL}/api/history?range=${range}`);
    const data = await res.json();
    state.history[range] = data; // { labels: [...], values: [...] }
    renderChart();
  } catch (err) {
    console.error("No se pudo obtener el historial del ESP32:", err);
    setConnection(false);
  }
}

function setConnection(isOnline) {
  connDot.classList.toggle("conn-dot--on", isOnline);
  connDot.classList.toggle("conn-dot--off", !isOnline);
}

/* --- Simulación de lecturas en tiempo real (solo demo) --- */
function simulateSensors() {
  if (!SIMULATION_MODE) return;

  // Ruido leve en el sensor de luz ambiental (LDR)
  state.ldr = Math.max(0, Math.round(state.ldr + (Math.random() - 0.5) * 30));

  // El PIR cambia ocasionalmente de estado
  if (Math.random() < 0.15) {
    state.pir = !state.pir;
  }

  // Si está en modo automático, la luz reacciona a presencia + luz ambiental
  if (state.mode === "auto") {
    if (state.pir && state.ldr < 500) {
      state.power = true;
      state.brightness = Math.max(30, Math.min(100, Math.round(100 - state.ldr / 8)));
    } else if (!state.pir) {
      state.power = false;
    }
  }

  renderSensors();
  renderPower();
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
function init() {
  renderPower();
  renderMode();
  renderSensors();
  renderRules();
  renderChart();
  renderStats();
  setConnection(true);

  setInterval(simulateSensors, 3000);

  // Registro del Service Worker (PWA) — se ignora si no hay soporte o si se
  // abre el archivo directamente (protocolo file://).
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

init();