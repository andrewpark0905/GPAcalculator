let token = localStorage.getItem("token");

const gradePoints = {
  "A+": 4.33, "A": 4.00, "A-": 3.67,
  "B+": 3.33, "B": 3.00, "B-": 2.67,
  "C+": 2.33, "C": 2.00, "C-": 1.67,
  "D+": 1.33, "D": 1.00, "D-": 0.67,
  "F": 0.00
};

const levelBoost = { "AP": 1.25, "Honors": 1.0, "CPE": 0.25, "CP": 0.0 };

const authCard = document.getElementById("authCard");
const appCard = document.getElementById("appCard");
const authErr = document.getElementById("authErr");

function showApp() {
  authCard.classList.add("hidden");
  appCard.classList.remove("hidden");
}

function showAuth() {
  authCard.classList.remove("hidden");
  appCard.classList.add("hidden");
}

function classRowTemplate() {
  const div = document.createElement("div");
  div.className = "classRow";
  div.innerHTML = `
    <div class="grid3">
      <input class="courseName" placeholder="Course name (optional)" />
      <select class="grade">
        ${Object.keys(gradePoints).map(g => `<option>${g}</option>`).join("")}
      </select>
      <select class="level">
        ${Object.keys(levelBoost).map(l => `<option>${l}</option>`).join("")}
      </select>
    </div>
    <input class="credits" type="number" min="0.5" step="0.5" value="1" placeholder="Credits" />
    <button class="removeBtn" type="button">Remove</button>
  `;
  div.querySelector(".removeBtn").onclick = () => div.remove();
  return div;
}

function getClassesPayload() {
  const rows = [...document.querySelectorAll(".classRow")];
  return rows.map(r => ({
    name: r.querySelector(".courseName").value.trim(),
    letter: r.querySelector(".grade").value,
    level: r.querySelector(".level").value,
    credits: Number(r.querySelector(".credits").value || 1)
  })).filter(c => c.credits > 0);
}

function calcGPA(classes) {
  let uwNum = 0, wNum = 0, den = 0;

  for (const c of classes) {
    const uw = gradePoints[c.letter] ?? 0;
    const w = uw + (levelBoost[c.level] ?? 0);
    uwNum += uw * c.credits;
    wNum += w * c.credits;
    den += c.credits;
  }

  if (den === 0) return { uw: 0, w: 0 };
  return {
    uw: Math.round((uwNum / den) * 100) / 100,
    w: Math.round((wNum / den) * 100) / 100
  };
}

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// Auth
document.getElementById("registerBtn").onclick = async () => {
  authErr.textContent = "";
  try {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const r = await api("/api/register", { method: "POST", body: JSON.stringify({ email, password }) });
    token = r.token; localStorage.setItem("token", token);
    initApp();
  } catch (e) { authErr.textContent = e.message; }
};

document.getElementById("loginBtn").onclick = async () => {
  authErr.textContent = "";
  try {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const r = await api("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
    token = r.token; localStorage.setItem("token", token);
    initApp();
  } catch (e) { authErr.textContent = e.message; }
};

document.getElementById("logoutBtn").onclick = () => {
  token = null;
  localStorage.removeItem("token");
  showAuth();
};

// App
document.getElementById("addClassBtn").onclick = () => {
  document.getElementById("classes").appendChild(classRowTemplate());
};

document.getElementById("calcBtn").onclick = () => {
  const payload = getClassesPayload();
  const { uw, w } = calcGPA(payload);
  document.getElementById("uwOut").textContent = uw.toFixed(2);
  document.getElementById("wOut").textContent = w.toFixed(2);
};

document.getElementById("saveBtn").onclick = async () => {
  const title = document.getElementById("title").value.trim() || "Untitled";
  const payload = getClassesPayload();
  await api("/api/runs", { method: "POST", body: JSON.stringify({ title, payload }) });
  await loadRuns();
};

async function loadRuns() {
  const { runs } = await api("/api/runs");
  const el = document.getElementById("runs");
  el.innerHTML = "";
  for (const r of runs) {
    const div = document.createElement("div");
    div.className = "classRow";
    div.innerHTML = `
      <div class="row space">
        <div>
          <div><b>${r.title}</b></div>
          <div class="label">${r.created_at}</div>
        </div>
        <div class="row">
          <button class="loadBtn" type="button">Load</button>
          <button class="delBtn" type="button">Delete</button>
        </div>
      </div>
    `;
    div.querySelector(".loadBtn").onclick = async () => {
      const full = await api(`/api/runs/${r.id}`);
      const container = document.getElementById("classes");
      container.innerHTML = "";
      for (const c of full.payload) {
        const row = classRowTemplate();
        row.querySelector(".courseName").value = c.name || "";
        row.querySelector(".grade").value = c.letter;
        row.querySelector(".level").value = c.level;
        row.querySelector(".credits").value = c.credits;
        container.appendChild(row);
      }
      document.getElementById("title").value = full.title;
      document.getElementById("calcBtn").click();
    };
    div.querySelector(".delBtn").onclick = async () => {
      await api(`/api/runs/${r.id}`, { method: "DELETE" });
      await loadRuns();
    };
    el.appendChild(div);
  }
}

async function initApp() {
  showApp();
  const container = document.getElementById("classes");
  container.innerHTML = "";
  container.appendChild(classRowTemplate());
  container.appendChild(classRowTemplate());
  await loadRuns();
}

if (token) initApp(); else showAuth();
