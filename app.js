// ===================== DATA =====================
const STORAGE_KEY = "attendance_ot_data_v1";

let data = {
  employees: [],
  records: [] // { id, employeeId, date, checkIn, checkOut, hours, ot }
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (e) {
    console.error("Load error", e);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ===================== HELPERS =====================
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatTime(iso) {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return { hours: 0, ot: 0 };
  const ms = new Date(checkOut) - new Date(checkIn);
  const totalHours = Math.max(0, ms / (1000 * 60 * 60));
  const rounded = Math.round(totalHours * 100) / 100;
  const ot = Math.max(0, Math.round((rounded - 8) * 100) / 100);
  return { hours: rounded, ot };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2500);
}

// ===================== UI UPDATE =====================
function renderEmployees() {
  const sel = document.getElementById("employeeSelect");
  const filter = document.getElementById("filterEmployee");
  const current = sel.value;

  sel.innerHTML = '<option value="">-- Select Employee --</option>';
  filter.innerHTML = '<option value="all">All Employees</option>';

  data.employees.forEach(emp => {
    const opt1 = document.createElement("option");
    opt1.value = emp.id;
    opt1.textContent = emp.name;
    sel.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = emp.id;
    opt2.textContent = emp.name;
    filter.appendChild(opt2);
  });

  if (current) sel.value = current;
}

function getTodayRecord(empId) {
  return data.records.find(r => r.employeeId === empId && r.date === todayStr());
}

function updateActionsUI() {
  const empId = document.getElementById("employeeSelect").value;
  const checkInBtn = document.getElementById("checkInBtn");
  const checkOutBtn = document.getElementById("checkOutBtn");
  const statusBox = document.getElementById("statusBox");
  const statusText = document.getElementById("statusText");
  const timeInfo = document.getElementById("timeInfo");

  if (!empId) {
    checkInBtn.disabled = true;
    checkOutBtn.disabled = true;
    statusBox.className = "status-box";
    statusText.textContent = "Select employee to start";
    timeInfo.style.display = "none";
    return;
  }

  const rec = getTodayRecord(empId);

  if (!rec) {
    // Not checked in
    checkInBtn.disabled = false;
    checkOutBtn.disabled = true;
    statusBox.className = "status-box";
    statusText.textContent = "Not checked in yet";
    timeInfo.style.display = "none";
  } else if (rec.checkIn && !rec.checkOut) {
    // Checked in
    checkInBtn.disabled = true;
    checkOutBtn.disabled = false;
    statusBox.className = "status-box checked-in";
    statusText.textContent = "✅ Checked In — " + formatTime(rec.checkIn);
    timeInfo.style.display = "grid";
    document.getElementById("inTime").textContent = formatTime(rec.checkIn);
    document.getElementById("outTime").textContent = "--";
    document.getElementById("workedHours").textContent = "--";
    document.getElementById("otHours").textContent = "--";
  } else {
    // Checked out
    checkInBtn.disabled = true;
    checkOutBtn.disabled = true;
    statusBox.className = "status-box checked-out";
    statusText.textContent = "Checked Out for today";
    timeInfo.style.display = "grid";
    document.getElementById("inTime").textContent = formatTime(rec.checkIn);
    document.getElementById("outTime").textContent = formatTime(rec.checkOut);
    document.getElementById("workedHours").textContent = rec.hours + "h";
    document.getElementById("otHours").textContent = rec.ot > 0 ? rec.ot + "h" : "0h";
  }
}

function updateTodayStats() {
  const today = todayStr();
  const todayRecs = data.records.filter(r => r.date === today && r.checkOut);
  document.getElementById("todayPresent").textContent = todayRecs.length;
  const totalOT = todayRecs.reduce((sum, r) => sum + (r.ot || 0), 0);
  document.getElementById("todayOT").textContent = totalOT.toFixed(1) + "h";
}

function renderRecords() {
  const list = document.getElementById("recordsList");
  const filterEmp = document.getElementById("filterEmployee").value;
  const filterMonth = document.getElementById("filterMonth").value; // YYYY-MM

  let filtered = [...data.records].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.checkIn || "").localeCompare(a.checkIn || "");
  });

  if (filterEmp !== "all") {
    filtered = filtered.filter(r => r.employeeId === filterEmp);
  }
  if (filterMonth) {
    filtered = filtered.filter(r => r.date.startsWith(filterMonth));
  }

  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty">No records found</p>';
    return;
  }

  list.innerHTML = filtered.map(r => {
    const emp = data.employees.find(e => e.id === r.employeeId);
    const name = emp ? emp.name : "Unknown";
    const hasOT = r.ot > 0;
    return `
      <div class="record-item ${hasOT ? "has-ot" : ""}">
        <div class="record-top">
          <span class="record-name">${name}</span>
          <span class="record-date">${formatDate(r.date)}</span>
        </div>
        <div class="record-times">
          <span>In: ${formatTime(r.checkIn)}</span>
          <span>Out: ${formatTime(r.checkOut)}</span>
          <span>${r.hours || 0}h</span>
        </div>
        ${hasOT ? `<div class="record-ot">⚡ OT: ${r.ot}h</div>` : ""}
      </div>
    `;
  }).join("");
}

function updateMonthlyReport() {
  const empId = document.getElementById("filterEmployee").value;
  const month = document.getElementById("filterMonth").value;
  const box = document.getElementById("monthlyReport");

  if (!month || empId === "all") {
    box.innerHTML = '<p class="empty">Select one employee & month</p>';
    return;
  }

  const recs = data.records.filter(r => r.employeeId === empId && r.date.startsWith(month) && r.checkOut);
  const daysPresent = recs.length;
  const totalHours = recs.reduce((s, r) => s + (r.hours || 0), 0);
  const totalOT = recs.reduce((s, r) => s + (r.ot || 0), 0);

  const emp = data.employees.find(e => e.id === empId);
  const name = emp ? emp.name : "Employee";

  box.innerHTML = `
    <div class="report-row"><span>Employee</span><span>${name}</span></div>
    <div class="report-row"><span>Month</span><span>${month}</span></div>
    <div class="report-row"><span>Days Present</span><span>${daysPresent}</span></div>
    <div class="report-row"><span>Total Hours</span><span>${totalHours.toFixed(1)}h</span></div>
    <div class="report-row"><span>Total OT</span><span style="color:#d97706;font-weight:700">${totalOT.toFixed(1)}h</span></div>
  `;
}

// ===================== ACTIONS =====================
function addEmployee() {
  const name = document.getElementById("newEmployeeName").value.trim();
  if (!name) {
    showToast("Please enter name");
    return;
  }
  if (data.employees.some(e => e.name.toLowerCase() === name.toLowerCase())) {
    showToast("Employee already exists");
    return;
  }
  data.employees.push({ id: generateId(), name });
  saveData();
  renderEmployees();
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("newEmployeeName").value = "";
  showToast(name + " added ✅");
}

function checkIn() {
  const empId = document.getElementById("employeeSelect").value;
  if (!empId) return;

  const existing = getTodayRecord(empId);
  if (existing) {
    showToast("Already checked in today");
    return;
  }

  const now = new Date().toISOString();
  data.records.push({
    id: generateId(),
    employeeId: empId,
    date: todayStr(),
    checkIn: now,
    checkOut: null,
    hours: 0,
    ot: 0
  });
  saveData();
  updateActionsUI();
  updateTodayStats();
  renderRecords();
  showToast("Checked In ✅");
}

function checkOut() {
  const empId = document.getElementById("employeeSelect").value;
  if (!empId) return;

  const rec = getTodayRecord(empId);
  if (!rec || rec.checkOut) {
    showToast("Cannot check out");
    return;
  }

  const now = new Date().toISOString();
  const { hours, ot } = calcHours(rec.checkIn, now);
  rec.checkOut = now;
  rec.hours = hours;
  rec.ot = ot;
  saveData();
  updateActionsUI();
  updateTodayStats();
  renderRecords();
  updateMonthlyReport();
  showToast(ot > 0 ? `Checked Out · OT ${ot}h ⚡` : "Checked Out ✅");
}

function exportCSV() {
  if (data.records.length === 0) {
    showToast("No data to export");
    return;
  }

  const headers = ["Date", "Employee", "Check In", "Check Out", "Hours", "OT Hours"];
  const rows = data.records
    .filter(r => r.checkOut)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(r => {
      const emp = data.employees.find(e => e.id === r.employeeId);
      return [
        r.date,
        emp ? emp.name : "Unknown",
        formatTime(r.checkIn),
        formatTime(r.checkOut),
        r.hours,
        r.ot
      ].join(",");
    });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_ot_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV Downloaded 📥");
}

// ===================== INIT =====================
function init() {
  loadData();

  // Date display
  const d = new Date();
  document.getElementById("currentDate").textContent = d.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  // Default month filter
  document.getElementById("filterMonth").value = todayStr().slice(0, 7);

  renderEmployees();
  updateActionsUI();
  updateTodayStats();
  renderRecords();
  updateMonthlyReport();

  // Event listeners
  document.getElementById("employeeSelect").addEventListener("change", () => {
    updateActionsUI();
  });

  document.getElementById("addEmployeeBtn").addEventListener("click", () => {
    document.getElementById("modal").classList.remove("hidden");
    document.getElementById("newEmployeeName").focus();
  });

  document.getElementById("cancelAdd").addEventListener("click", () => {
    document.getElementById("modal").classList.add("hidden");
  });

  document.getElementById("confirmAdd").addEventListener("click", addEmployee);

  document.getElementById("newEmployeeName").addEventListener("keydown", e => {
    if (e.key === "Enter") addEmployee();
  });

  document.getElementById("checkInBtn").addEventListener("click", checkIn);
  document.getElementById("checkOutBtn").addEventListener("click", checkOut);

  document.getElementById("filterEmployee").addEventListener("change", () => {
    renderRecords();
    updateMonthlyReport();
  });

  document.getElementById("filterMonth").addEventListener("change", () => {
    renderRecords();
    updateMonthlyReport();
  });

  document.getElementById("exportBtn").addEventListener("click", exportCSV);

  // Theme toggle
  const themeBtn = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("att_theme");
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeBtn.textContent = "☀️";
  }
  themeBtn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      themeBtn.textContent = "🌙";
      localStorage.setItem("att_theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      themeBtn.textContent = "☀️";
      localStorage.setItem("att_theme", "dark");
    }
  });
}

init();
