"use strict";

const $ = (id) => document.getElementById(id);

const state = {
  readings: [],
  history: [],
  lastStatus: "",
  lastEventKey: "",
  lastEventTime: 0,
  nextId: 1
};

const scenarios = {
  normal: { level: 42, rain: 8, flow: 1.8, turbidity: 12 },
  warning: { level: 68, rain: 28, flow: 3.4, turbidity: 24 },
  danger: { level: 91, rain: 62, flow: 5.7, turbidity: 48 },
  quality: { level: 45, rain: 12, flow: 2.1, turbidity: 95 }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function updateClock() {
  $("clock").textContent = new Date().toLocaleTimeString();
}

function generateReading() {
  const base = scenarios[$("scenario").value] || scenarios.normal;

  // Small random changes simulate sensor variation.
  return {
    time: getTime(),
    timestamp: Date.now(),
    level: Math.round(clamp(base.level + (Math.random() - 0.5) * 8, 0, 100)),
    rain: Math.round(clamp(base.rain + (Math.random() - 0.5) * 6, 0, 100)),
    flow: Number(clamp(base.flow + (Math.random() - 0.5) * 0.6, 0, 10).toFixed(1)),
    turbidity: Math.round(clamp(base.turbidity + (Math.random() - 0.5) * 8, 0, 100))
  };
}

function assessRisk(reading) {
  // Educational demonstration rules, not a validated flood model.
  let score = 0;

  score += reading.level * 0.55;
  score += Math.min(reading.rain, 100) * 0.20;
  score += Math.min(reading.flow * 10, 100) * 0.15;
  score += Math.min(reading.turbidity, 100) * 0.10;

  score = Math.round(clamp(score, 0, 100));

  // Water-level overrides provide clear scenario demonstrations.
  if (reading.level >= 80) score = Math.max(score, 80);
  else if (reading.level >= 60) score = Math.max(score, 60);

  // Water quality problems can generate warnings independently
  // of the flood-related score.
  let status = "normal";
  let explanation = "Simulated readings are below configured warning levels.";

  if (reading.level >= 80 || score >= 80) {
    status = "danger";
    explanation = "Critical simulated water conditions. Immediate review would be required in a real system.";
  } else if (
    reading.level >= 60 ||
    score >= 60 ||
    reading.turbidity >= 50
  ) {
    status = "warning";
    explanation = reading.turbidity >= 50
      ? "High simulated turbidity. Water quality needs investigation."
      : "Simulated conditions have crossed a configured warning threshold.";
  }

  return { score, status, explanation };
}

function setMeter(id, value, maximum) {
  const width = clamp((value / maximum) * 100, 0, 100);
  $(id).style.width = width + "%";
}

function updateMeters(reading) {
  $("waterLevel").textContent = reading.level;
  $("rainfall").textContent = reading.rain;
  $("flowRate").textContent = reading.flow.toFixed(1);
  $("turbidity").textContent = reading.turbidity;

  setMeter("waterBar", reading.level, 100);
  setMeter("rainBar", reading.rain, 100);
  setMeter("flowBar", reading.flow, 10);
  setMeter("turbidityBar", reading.turbidity, 100);

  $("waterNote").textContent =
    reading.level >= 80 ? "Critical demonstration level" :
    reading.level >= 60 ? "Warning threshold crossed" :
    "Below configured warning threshold";
}

function updateRisk(assessment) {
  $("riskScore").textContent = assessment.score;
  $("riskStatus").textContent = assessment.status.toUpperCase() + " RISK";
  $("riskStatus").className = "status-pill " + assessment.status;
  $("riskExplanation").textContent = assessment.explanation;

  const colors = {
    normal: "#245f55",
    warning: "#9c712b",
    danger: "#a13e52"
  };

  $("riskCircle").style.borderColor = colors[assessment.status];
}

function drawChart() {
  const canvas = $("levelChart");
  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const left = 35;
  const right = 12;
  const top = 15;
  const bottom = 25;
  const chartW = width - left - right;
  const chartH = height - top - bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.font = "11px Segoe UI, Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  // Horizontal grid and percentage labels.
  for (let value = 0; value <= 100; value += 25) {
    const y = top + chartH * (1 - value / 100);

    ctx.strokeStyle = "#263b51";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();

    ctx.fillStyle = "#91a5bd";
    ctx.fillText(value, left - 8, y);
  }

  // Configured warning and critical reference lines.
  [
    { value: 60, color: "#ffbe55" },
    { value: 80, color: "#ff687d" }
  ].forEach((line) => {
    const y = top + chartH * (1 - line.value / 100);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = line.color;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    ctx.restore();
  });

  const data = state.readings;

  if (!data.length) return;

  const x = (i) => left +
    (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);

  const y = (value) => top + chartH * (1 - value / 100);

  // Filled area under the water-level line.
  const gradient = ctx.createLinearGradient(0, top, 0, height - bottom);
  gradient.addColorStop(0, "rgba(57,213,223,0.22)");
  gradient.addColorStop(1, "rgba(57,213,223,0.01)");

  ctx.beginPath();
  data.forEach((item, i) => {
    if (i === 0) ctx.moveTo(x(i), y(item.level));
    else ctx.lineTo(x(i), y(item.level));
  });
  ctx.lineTo(x(data.length - 1), height - bottom);
  ctx.lineTo(x(0), height - bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Trend line.
  ctx.beginPath();
  data.forEach((item, i) => {
    if (i === 0) ctx.moveTo(x(i), y(item.level));
    else ctx.lineTo(x(i), y(item.level));
  });
  ctx.strokeStyle = "#39d5df";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  // Mark the latest reading.
  const last = data[data.length - 1];
  ctx.beginPath();
  ctx.arc(x(data.length - 1), y(last.level), 4, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#39d5df";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Time labels.
  ctx.fillStyle = "#91a5bd";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const labels = [
    { index: 0, text: data[0].time },
    { index: Math.floor((data.length - 1) / 2), text: data[Math.floor((data.length - 1) / 2)].time },
    { index: data.length - 1, text: last.time }
  ];

  labels.forEach((label) => {
    ctx.fillText(label.text, x(label.index), height - bottom + 8);
  });
}

function recordEvent(reading, assessment, force = false) {
  const eventKey = assessment.status + "-" +
    (reading.level >= 80 ? "critical" : reading.level >= 60 ? "elevated" : "ordinary") +
    (reading.turbidity >= 50 ? "-quality" : "");

  // Record changes in risk state, not every routine refresh.
  // Manual scenario tests can also be recorded.
  const changed = eventKey !== state.lastEventKey;
  const cooldownPassed = Date.now() - state.lastEventTime > 30000;

  if (!force && (!changed || !cooldownPassed)) return;

  state.lastEventKey = eventKey;
  state.lastEventTime = Date.now();

  const messages = {
    normal: "Conditions within configured limits",
    warning: reading.turbidity >= 50
      ? "Water quality warning: high turbidity"
      : "Water-level or combined risk warning",
    danger: "Critical simulated water-level condition"
  };

  state.history.unshift({
    time: reading.time,
    event: messages[assessment.status],
    level: reading.level,
    score: assessment.score,
    status: assessment.status
  });

  state.history = state.history.slice(0, 50);
  renderHistory();
  updateLatestEvent(reading, assessment, messages[assessment.status]);
}

function updateLatestEvent(reading, assessment, message) {
  const icons = { normal: "✓", warning: "!", danger: "!" };

  $("latestEvent").innerHTML = "";

  const icon = document.createElement("span");
  icon.className = "event-icon";
  icon.textContent = icons[assessment.status];

  const details = document.createElement("div");
  const title = document.createElement("strong");
  const description = document.createElement("p");

  title.textContent = message;
  description.textContent =
    `${reading.time} · Water level ${reading.level}% · Risk score ${assessment.score}/100`;

  details.append(title, description);
  $("latestEvent").append(icon, details);
}

function renderHistory() {
  const tbody = $("alertRows");
  tbody.innerHTML = "";

  if (!state.history.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty-cell";
    cell.textContent = "No events recorded yet.";
    row.append(cell);
    tbody.append(row);
    return;
  }

  state.history.forEach((event) => {
    const row = document.createElement("tr");
    const values = [
      event.time,
      event.event,
      event.level + "%",
      event.score + "/100"
    ];

    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = "table-status " + event.status;
    status.textContent = event.status.toUpperCase();
    statusCell.append(status);
    row.append(statusCell);

    tbody.append(row);
  });
}

function runAssessment(forceLog = false) {
  const reading = generateReading();
  const assessment = assessRisk(reading);

  state.readings.push(reading);
  state.readings = state.readings.slice(-24);

  updateMeters(reading);
  updateRisk(assessment);
  drawChart();

  if (forceLog) {
    // A manual test creates a history entry even if the status
    // is unchanged, making demonstrations easier to follow.
    state.lastEventKey = "";
    state.lastEventTime = 0;
  }

  recordEvent(reading, assessment, forceLog);
}

$("scenario").addEventListener("change", () => runAssessment(true));
$("refreshBtn").addEventListener("click", () => runAssessment(true));

$("clearBtn").addEventListener("click", () => {
  state.history = [];
  renderHistory();
});

window.addEventListener("resize", drawChart);

updateClock();
setInterval(updateClock, 1000);

// Start the simulation and continue updating every five seconds.
runAssessment(true);
setInterval(() => runAssessment(false), 5000);
