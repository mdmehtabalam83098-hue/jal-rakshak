"use strict";

const $ = id => document.getElementById(id);

const stations = {
  river: {
    name: "River Watch",
    description: "Illustrative river monitoring profile",
    level: 0, rain: 0, flow: 0, turbidity: 0
  },
  reservoir: {
    name: "Reservoir Guard",
    description: "Illustrative reservoir monitoring profile",
    level: -10, rain: -3, flow: -0.5, turbidity: -2
  },
  village: {
    name: "Village Water Tank",
    description: "Illustrative village tank monitoring profile",
    level: -18, rain: -5, flow: -0.8, turbidity: 8
  }
};

const scenarios = {
  normal:  { level: 42, rain: 8,  flow: 1.8, turbidity: 12 },
  warning: { level: 68, rain: 28, flow: 3.4, turbidity: 24 },
  danger:  { level: 91, rain: 62, flow: 5.7, turbidity: 48 },
  quality: { level: 45, rain: 12, flow: 2.1, turbidity: 95 }
};

const state = {
  readings: {},
  history: {},
  lastAssessment: null
};

Object.keys(stations).forEach(id => {
  state.readings[id] = [];
  state.history[id] = [];
});

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

function currentStationId() {
  return $("station").value;
}

function generateReading() {
  const id = currentStationId();
  const station = stations[id] || stations.river;
  const scenarioId = $("scenario").value;
  const base = scenarios[scenarioId] || scenarios.normal;

  // Station offsets distinguish normal-condition profiles.
  // Warning and danger tests remain reliable at every station.
  const useOffsets = scenarioId === "normal" ||
                     scenarioId === "quality";

  const offset = useOffsets ? 1 : 0;

  return {
    stationId: id,
    stationName: station.name,
    time: getTime(),
    timestamp: Date.now(),

    level: Math.round(clamp(
      base.level + station.level * offset +
      (Math.random() - 0.5) * 6, 0, 100
    )),

    rain: Math.round(clamp(
      base.rain + station.rain * offset +
      (Math.random() - 0.5) * 4, 0, 100
    )),

    flow: Number(clamp(
      base.flow + station.flow * offset +
      (Math.random() - 0.5) * 0.4, 0, 10
    ).toFixed(1)),

    turbidity: Math.round(clamp(
      base.turbidity + station.turbidity * offset +
      (Math.random() - 0.5) * 6, 0, 100
    ))
  };
}

function assessRisk(r) {
  let score = Math.round(
    r.level * 0.55 +
    Math.min(r.rain, 100) * 0.20 +
    Math.min(r.flow * 10, 100) * 0.15 +
    Math.min(r.turbidity, 100) * 0.10
  );

  score = clamp(score, 0, 100);

  let status = "normal";
  let explanation =
    "Simulated readings are below configured warning levels.";

  if (r.level >= 80) {
    status = "danger";
    score = Math.max(score, 80);
    explanation =
      "Critical simulated water level. Immediate review would be required in a real system.";
  } else if (r.level >= 60 || score >= 60 || r.turbidity >= 50) {
    status = "warning";
    score = Math.max(score, r.level >= 60 ? 60 : 0);
    explanation = r.turbidity >= 50
      ? "High simulated turbidity. Water quality needs investigation."
      : "Simulated water conditions crossed a configured warning threshold.";
  }

  return { score, status, explanation };
}

function setMeter(id, value, maximum) {
  $(id).style.width =
    clamp(value / maximum * 100, 0, 100) + "%";
}

function updateMeters(r) {
  $("waterLevel").textContent = r.level;
  $("rainfall").textContent = r.rain;
  $("flowRate").textContent = r.flow.toFixed(1);
  $("turbidity").textContent = r.turbidity;

  setMeter("waterBar", r.level, 100);
  setMeter("rainBar", r.rain, 100);
  setMeter("flowBar", r.flow, 10);
  setMeter("turbidityBar", r.turbidity, 100);

  $("waterNote").textContent =
    r.level >= 80 ? "Critical demonstration level" :
    r.level >= 60 ? "Warning threshold crossed" :
    "Below configured warning threshold";
}

function updateRisk(a) {
  $("riskScore").textContent = a.score;
  $("riskStatus").textContent =
    a.status.toUpperCase() + " RISK";
  $("riskStatus").className = "status-pill " + a.status;
  $("riskExplanation").textContent = a.explanation;

  const colors = {
    normal: "#245f55",
    warning: "#9c712b",
    danger: "#a13e52"
  };

  $("riskCircle").style.borderColor = colors[a.status];
}

function drawChart() {
  const id = currentStationId();
  const data = state.readings[id] || [];
  const canvas = $("levelChart");
  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const left = 36, right = 12, top = 15, bottom = 27;
  const chartW = w - left - right;
  const chartH = h - top - bottom;

  ctx.clearRect(0, 0, w, h);
  ctx.font = "11px Segoe UI, Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let value = 0; value <= 100; value += 25) {
    const y = top + chartH * (1 - value / 100);

    ctx.strokeStyle = "#263b51";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - right, y);
    ctx.stroke();

    ctx.fillStyle = "#91a5bd";
    ctx.fillText(String(value), left - 8, y);
  }

  [
    { value: 60, color: "#ffbe55" },
    { value: 80, color: "#ff687d" }
  ].forEach(line => {
    const y = top + chartH * (1 - line.value / 100);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = line.color;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - right, y);
    ctx.stroke();
    ctx.restore();
  });

  if (!data.length) return;

  const x = i => left +
    (data.length === 1 ? chartW / 2 :
      i / (data.length - 1) * chartW);

  const y = value => top + chartH * (1 - value / 100);

  const gradient = ctx.createLinearGradient(0, top, 0, h - bottom);
  gradient.addColorStop(0, "rgba(57,213,223,0.22)");
  gradient.addColorStop(1, "rgba(57,213,223,0.01)");

  ctx.beginPath();
  data.forEach((r, i) => {
    if (i === 0) ctx.moveTo(x(i), y(r.level));
    else ctx.lineTo(x(i), y(r.level));
  });
  ctx.lineTo(x(data.length - 1), h - bottom);
  ctx.lineTo(x(0), h - bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  data.forEach((r, i) => {
    if (i === 0) ctx.moveTo(x(i), y(r.level));
    else ctx.lineTo(x(i), y(r.level));
  });
  ctx.strokeStyle = "#39d5df";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const last = data[data.length - 1];
  ctx.beginPath();
  ctx.arc(x(data.length - 1), y(last.level), 4, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  ctx.fillStyle = "#91a5bd";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const middle = Math.floor((data.length - 1) / 2);
  [
    { i: 0, text: data[0].time },
    { i: middle, text: data[middle].time },
    { i: data.length - 1, text: last.time }
  ].forEach(label => {
    ctx.fillText(label.text, x(label.i), h - bottom + 8);
  });
}

function updateStationInfo() {
  const station = stations[currentStationId()];
  $("stationName").textContent = station.name;
  $("stationDescription").textContent = station.description;
}

function renderHistory() {
  const tbody = $("alertRows");
  const history = state.history[currentStationId()] || [];
  tbody.replaceChildren();

  if (!history.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty-cell";
    cell.textContent = "No events recorded for this station yet.";
    row.append(cell);
    tbody.append(row);
    return;
  }

  history.forEach(event => {
    const row = document.createElement("tr");

    [
      event.time,
      event.stationName,
      event.event,
      event.level + "%",
      event.score + "/100"
    ].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });

    const cell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "table-status " + event.status;
    badge.textContent = event.status.toUpperCase();
    cell.append(badge);
    row.append(cell);
    tbody.append(row);
  });
}

function recordEvent(r, a, force = false) {
  const history = state.history[r.stationId];
  const last = history[0];

  const sameState = last &&
    last.status === a.status &&
    last.event === eventMessage(a.status, r);

  // Avoid adding a duplicate entry every five seconds.
  if (!force && sameState) return;

  const event = {
    time: r.time,
    timestamp: r.timestamp,
    stationId: r.stationId,
    stationName: r.stationName,
    event: eventMessage(a.status, r),
    level: r.level,
    rain: r.rain,
    flow: r.flow,
    turbidity: r.turbidity,
    score: a.score,
    status: a.status
  };

  history.unshift(event);
  state.history[r.stationId] = history.slice(0, 100);

  updateLatestEvent(event);
  renderHistory();
}

function eventMessage(status, r) {
  if (status === "danger") return "Critical water-level condition";
  if (status === "warning" && r.turbidity >= 50) {
    return "Water quality warning: high turbidity";
  }
  if (status === "warning") return "Water-level risk warning";
  return "Conditions within configured limits";
}

function updateLatestEvent(event) {
  const container = $("latestEvent");
  container.replaceChildren();

  const icon = document.createElement("span");
  icon.className = "event-icon";
  icon.textContent = event.status === "normal" ? "✓" : "!";

  const details = document.createElement("div");
  const title = document.createElement("strong");
  const description = document.createElement("p");

  title.textContent = event.event;
  description.textContent =
    `${event.time} · ${event.stationName} · Level ${event.level}% · Risk ${event.score}/100`;

  details.append(title, description);
  container.append(icon, details);
}

function runAssessment(forceLog = false) {
  const r = generateReading();
  const a = assessRisk(r);
  const id = r.stationId;

  state.readings[id].push(r);
  state.readings[id] = state.readings[id].slice(-24);

  state.lastAssessment = { reading: r, assessment: a };

  updateStationInfo();
  updateMeters(r);
  updateRisk(a);
  drawChart();

  recordEvent(r, a, forceLog);
}

function downloadCSV() {
  const history = state.history[currentStationId()];

  if (!history.length) {
    alert("No alert history to export. Refresh the data first.");
    return;
  }

  const columns = [
    "time", "stationName", "event", "level",
    "rain", "flow", "turbidity", "score", "status"
  ];

  const escapeCSV = value =>
    '"' + String(value).replace(/"/g, '""') + '"';

  const rows = [
    columns.join(","),
    ...history.map(event =>
      columns.map(key => escapeCSV(event[key])).join(",")
    )
  ];

  const blob = new Blob(
    ["\uFEFF" + rows.join("\r\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = currentStationId() + "-jal-rakshak-alerts.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

$("scenario").addEventListener("change", () => runAssessment(true));

$("station").addEventListener("change", () => {
  updateStationInfo();
  renderHistory();

  const history = state.history[currentStationId()];
  if (history.length) {
    updateLatestEvent(history[0]);
  }

  runAssessment(true);
});

$("refreshBtn").addEventListener("click", () => runAssessment(true));

$("clearBtn").addEventListener("click", () => {
  state.history[currentStationId()] = [];
  renderHistory();
});

$("exportBtn").addEventListener("click", downloadCSV);

window.addEventListener("resize", drawChart);

updateClock();
setInterval(updateClock, 1000);

updateStationInfo();
renderHistory();
runAssessment(true);
setInterval(() => runAssessment(false), 5000);
