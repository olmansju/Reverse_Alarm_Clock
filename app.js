// Reverse Alarm Clock (CodePen-friendly)

const el = (id) => document.getElementById(id);

const wakeTimeEl = el("wakeTime");
const sleepHoursEl = el("sleepHours");
const ritualMinsEl = el("ritualMins");

const notifyToggleEl = el("notifyToggle");

const calcBtn = el("calcBtn");
const startBtn = el("startBtn");
const stopBtn = el("stopBtn");
const testBtn = el("testBtn");

const countdownOut = el("countdownOut");
const countdownHint = el("countdownHint");
const warningMinsEl = el("warningMins");
const testWarningBtn = el("testWarningBtn");

const ritualStartOut = el("ritualStartOut");
const lightsOutOut = el("lightsOutOut");
const wakeOut = el("wakeOut");

const statusOut = el("statusOut");
const nextCheckOut = el("nextCheckOut");

const alarmBox = el("alarmBox");
const dismissBtn = el("dismissBtn");

const setupView = el("setupView");
const nightView = el("nightView");
const stopBtnNight = el("stopBtnNight");


// --- localStorage defaults ---
const STORAGE_KEY = "reverseAlarm.defaults.v1";

function showSetupView() {
  setupView.classList.remove("hidden");
  nightView.classList.add("hidden");
}

function showNightView() {
  setupView.classList.add("hidden");
  nightView.classList.remove("hidden");
}

function saveDefaults() {
  const data = {
    wakeTime: wakeTimeEl.value,                // "HH:MM"
    sleepHours: sleepHoursEl.value,            // string; fine
    ritualMins: ritualMinsEl.value,            // string; fine
    notifyEnabled: notifyToggleEl.checked,
    warningMins: Number(warningMinsEl.value)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadDefaults() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    if (data.wakeTime) wakeTimeEl.value = data.wakeTime;
    if (data.sleepHours != null) sleepHoursEl.value = data.sleepHours;
    if (data.ritualMins != null) ritualMinsEl.value = data.ritualMins;
    if (typeof data.notifyEnabled === "boolean") notifyToggleEl.checked = data.notifyEnabled;
    if (data.warningMins != null) warningMinsEl.value = String(data.warningMins);
  } catch (e) {
    // If corrupted, ignore
  }
}

[wakeTimeEl, sleepHoursEl, ritualMinsEl].forEach((input) => {
  input.addEventListener("change", saveDefaults);
  input.addEventListener("input", () => {
    // optional: save as they type, but can be noisy; keep simple:
  });
});

warningMinsEl.addEventListener("change", () => {
  saveDefaults();
  fired.warning = false;
});

notifyToggleEl.addEventListener("change", () => {
  saveDefaults();
});


// --- Web Audio alarm (more reliable than <audio> autoplay) ---
let audioCtx = null;
let alarmInterval = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

async function ensureAudioRunning() {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

function playAlarmBurst(durationMs = 900) {
  const ctx = getAudioCtx();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // "Alarm-ish" tone with a bit of movement
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(880, ctx.currentTime);           // A5
  osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
  osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.36);
  osc.frequency.exponentialRampToValueAtTime(770, ctx.currentTime + 0.54);

  // Volume envelope to avoid clicks
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);

  osc.connect(gain).connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000);
}

function startAlarmSound() {
  // Repeating bursts until dismissed
  stopAlarmSound();
  let bursts = 0;

  alarmInterval = setInterval(() => {
    playAlarmBurst(900);
    bursts += 1;

    // Every few bursts, slightly vary it
    if (bursts % 4 === 0) playAlarmBurst(650);
  }, 1100);
}

function stopAlarmSound() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

function playWarningChime() {
  const ctx = getAudioCtx();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
  osc.frequency.exponentialRampToValueAtTime(784, ctx.currentTime + 0.12); // G5

  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.36);
}

let monitorTimer = null;
let fired = { warning: false, ritual: false, lights: false };

let plan = null;
// plan = { ritualStart: Date, lightsOut: Date, wake: Date }

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTime(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  const isPM = h >= 12;
  const hr12 = ((h + 11) % 12) + 1;
  return `${hr12}:${pad2(m)} ${isPM ? "PM" : "AM"}`;
}

function minutesFromTimeInput(value) {
  // "HH:MM" => minutes since midnight
  const [hh, mm] = value.split(":").map(Number);
  return hh * 60 + mm;
}

function computePlan() {
  const wakeMins = minutesFromTimeInput(wakeTimeEl.value);
  const sleepHours = Number(sleepHoursEl.value);
  const ritualMins = Number(ritualMinsEl.value);

  if (!Number.isFinite(sleepHours) || sleepHours < 0) {
    alert("Sleep goal must be a valid number of hours.");
    return null;
  }
  if (!Number.isFinite(ritualMins) || ritualMins < 0) {
    alert("Ritual minutes must be a valid number.");
    return null;
  }

  // Build wake datetime: if wake time already passed today, assume tomorrow.
  const now = new Date();
  const wake = new Date(now);
  wake.setHours(Math.floor(wakeMins / 60), wakeMins % 60, 0, 0);

  if (wake <= now) {
    wake.setDate(wake.getDate() + 1);
  }

  const sleepMins = Math.round(sleepHours * 60);
  const lightsOut = new Date(wake.getTime() - sleepMins * 60 * 1000);
  const ritualStart = new Date(lightsOut.getTime() - ritualMins * 60 * 1000);

  return { ritualStart, lightsOut, wake, sleepMins, ritualMins };
}

function renderPlan(p) {
  ritualStartOut.textContent = formatTime(p.ritualStart);
  lightsOutOut.textContent = formatTime(p.lightsOut);
  wakeOut.textContent = formatTime(p.wake);

  const now = new Date();
  const tonightOrTomorrow = p.ritualStart.toDateString() === now.toDateString()
    ? "today"
    : "tomorrow";

  statusOut.textContent = `Ready (${tonightOrTomorrow})`;
  nextCheckOut.textContent =
    `Will trigger at ${formatTime(p.ritualStart)} (ritual start) and optionally at ${formatTime(p.lightsOut)} (lights out).`;
}

async function showAlarm(messageTitle, messageSub) {
  alarmBox.classList.remove("hidden");
  alarmBox.querySelector(".alarm-title").textContent = messageTitle;
  alarmBox.querySelector(".alarm-sub").textContent = messageSub;

  // Web Audio requires a user gesture at least once in many browsers.
  // We'll try; if blocked, the Test button / Start button will usually count as gesture.
  try {
    await ensureAudioRunning();
    startAlarmSound();
  } catch (e) {
    // If blocked, user can hit "Test Alarm" once to unlock audio.
  }

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(messageTitle, { body: messageSub });
  }
}


function dismissAlarm() {
  stopAlarmSound();
  alarmBox.classList.add("hidden");
}


async function enableNotificationsIfPossible() {
  if (!("Notification" in window)) {
    alert("Notifications aren’t supported in this browser.");
    notifyToggleEl.checked = false;
    return;
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    alert("Notifications not enabled (permission denied).");
    notifyToggleEl.checked = false;
  }
}

function formatCountdown(ms) {
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);

  const totalSeconds = Math.floor(abs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${sign}${hours}h ${pad2(minutes)}m ${pad2(seconds)}s`;
  return `${sign}${minutes}m ${pad2(seconds)}s`;
}

function refreshPlanIfStale() {
  if (!plan) return;

  const now = new Date();

  // If the last plan's wake time is already in the past, it's stale.
  if (plan.wake <= now) {
    const fresh = computePlan();
    if (!fresh) return;
    plan = fresh;
    renderPlan(plan);

    // If you're not currently monitoring, make sure UI state is sane
    // (optional, but keeps things consistent)
    startBtn.disabled = false;
  }
}


function updateCountdownUI() {
  if (!plan) {
    countdownOut.textContent = "—";
    countdownHint.textContent = "";
    return;
  }
  
  refreshPlanIfStale();
  
  const now = new Date();
  const msToRitual = plan.ritualStart - now;

  countdownOut.textContent = formatCountdown(msToRitual);

  if (msToRitual > 0) {
    countdownHint.textContent = `Ritual starts at ${formatTime(plan.ritualStart)}.`;
  } else if (now < plan.wake) {
    countdownHint.textContent = `Ritual time has passed — aim for lights out by ${formatTime(plan.lightsOut)}.`;
  } else {
    countdownHint.textContent = "";
  }
}

function startMonitor() {
  // Always recompute so we don't monitor yesterday's plan
  const fresh = computePlan();
  if (!fresh) return;
  plan = fresh;
  renderPlan(plan);

  showNightView();
  
  fired = { warning: false, ritual: false, lights: false };
  alarmBox.classList.add("hidden");

  startBtn.disabled = true;
  stopBtn.disabled = false;
  calcBtn.disabled = true;

  statusOut.textContent = "Monitoring… (keep this tab open)";
  nextCheckOut.textContent = "";

  // check every 10 seconds (cheap + fine for this use)
  monitorTimer = setInterval(() => {
    const now = new Date();
    // --- WARNING CHECK (place this BEFORE the ritual alarm) ---
    const warningMins = Number(warningMinsEl.value) || 0;
    const warningTime = warningMins > 0
      ? new Date(plan.ritualStart.getTime() - warningMins * 60 * 1000)
      : null;

    if (warningTime && !fired.warning && now >= warningTime && now < plan.ritualStart) {
      fired.warning = true;

      ensureAudioRunning()
  .then(() => {
    playWarningChime();
    setTimeout(playWarningChime, 700);
    setTimeout(playWarningChime, 1400);
    setTimeout(playWarningChime, 2100);
    setTimeout(playWarningChime, 2800);
    setTimeout(playWarningChime, 3500);
  })
  .catch(() => {});

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Bedtime routine soon", {
          body: `${warningMins} minutes until ritual start.`
        });
      }
    }
    // --- END WARNING CHECK ---

    // Recompute if day boundary weirdness occurs? Keep simple for v1.

    if (!fired.ritual && now >= plan.ritualStart) {
      fired.ritual = true;
      showAlarm(
        "Start your bedtime routine.",
        `Goal: lights out by ${formatTime(plan.lightsOut)} for ${plan.sleepMins} minutes of sleep.`
      );
    }

    // Optional secondary alert at lights out
    if (!fired.lights && now >= plan.lightsOut) {
      fired.lights = true;
      showAlarm(
        "Lights out.",
        `This is your planned sleep start time to wake at ${formatTime(plan.wake)}.`
      );
    }

    // Stop after wake time passes (cleanup)
    if (now >= plan.wake) {
      stopMonitor();
      statusOut.textContent = "Done (wake time reached)";
    }
  }, 10000);
}

function stopMonitor() {
  stopAlarmSound();
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
  calcBtn.disabled = false;
  statusOut.textContent = "Not running";
  plan = computePlan();
  if (plan) renderPlan(plan);
  showSetupView();
}

calcBtn.addEventListener("click", () => {
  const p = computePlan();
  if (!p) return;
  plan = p;
  renderPlan(p);
  startBtn.disabled = false;
  saveDefaults();
});


startBtn.addEventListener("click", () => startMonitor());
stopBtn.addEventListener("click", () => stopMonitor());

testBtn.addEventListener("click", async () => {
  await ensureAudioRunning();
  showAlarm("Test alarm", "If you hear a repeating alarm, audio is unlocked.");
  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    dismissAlarm();
  }, 4000);
});

setInterval(updateCountdownUI, 1000);

dismissBtn.addEventListener("click", dismissAlarm);

notifyToggleEl.addEventListener("change", async (e) => {
  if (e.target.checked) {
    await enableNotificationsIfPossible();
  }
});

warningMinsEl.addEventListener("change", () => {
  saveDefaults();
  // If you're already monitoring, allow warning to re-fire based on new choice:
  fired.warning = false;
});

testWarningBtn.addEventListener("click", async () => {
  await ensureAudioRunning();
  playWarningChime();
  setTimeout(playWarningChime, 700);
  setTimeout(playWarningChime, 1400);
});

stopBtnNight.addEventListener("click", () => stopMonitor());

// Initial compute on load so it feels alive
(() => {
  loadDefaults();
  plan = computePlan();
  if (plan) {
    renderPlan(plan);
    startBtn.disabled = false;
  }
})();

