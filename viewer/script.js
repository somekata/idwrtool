let allRows = []; // CSV全行（配列の配列）
let chartInstance = null;
let availableYears = [];
let availableDiseases = [];
let datasetType = "weekly"; // "weekly" or "yearly"
let currentChartTitle = "";

document.addEventListener("DOMContentLoaded", () => {
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  modeRadios.forEach(r => r.addEventListener("change", handleModeChange));

  const dtypeRadios = document.querySelectorAll('input[name="dtype"]');
  dtypeRadios.forEach(r =>
    r.addEventListener("change", handleDatasetTypeChange)
  );

  const fileInput = document.getElementById("csvFileInput");
  const drawBtn = document.getElementById("drawBtn");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modal = document.getElementById("chartModal");
  const downloadHtmlBtn = document.getElementById("downloadHtmlBtn");

  fileInput.addEventListener("change", handleFileSelect);
  drawBtn.addEventListener("click", () => {
    drawChart();
  });

  modalCloseBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", e => {
    if (e.target === modal) {
      closeModal();
    }
  });

  downloadHtmlBtn.addEventListener("click", downloadChartAsHtml);

  // 初期のUI状態
  handleDatasetTypeChange();
});

// データ種別（weekly / yearly）変更時のUI制御
function handleDatasetTypeChange() {
  const dtype = document.querySelector('input[name="dtype"]:checked').value;
  datasetType = dtype;

  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const yearSingle = document.getElementById("yearSingle");
  const yearMulti = document.getElementById("yearMulti");

  if (dtype === "weekly") {
    modeRadios.forEach(r => (r.disabled = false));
    // モードに応じて年入力欄を切り替え
    handleModeChange();
  } else {
    // yearly のときは比較モードは意味を持たないので無効化
    modeRadios.forEach(r => (r.disabled = true));
    yearSingle.disabled = true;
    // yearly は複数年選択を使う
    yearMulti.disabled = false;
  }
}

// weekly 時の比較モード切り替え
function handleModeChange() {
  if (datasetType !== "weekly") return;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const yearSingle = document.getElementById("yearSingle");
  const yearMulti = document.getElementById("yearMulti");

  if (mode === "byDisease") {
    yearSingle.disabled = false;
    yearMulti.disabled = true;
  } else {
    yearSingle.disabled = true;
    yearMulti.disabled = false;
  }
}

// CSV ファイル読み込み
function handleFileSelect(event) {
  const file = event.target.files[0];
  const info = document.getElementById("fileInfo");
  const summary = document.getElementById("dataSummary");
  const drawBtn = document.getElementById("drawBtn");

  if (!file) {
    info.textContent = "ファイルが選択されていません。";
    allRows = [];
    drawBtn.disabled = true;
    summary.textContent = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    allRows = parseCSV(text);

    if (allRows.length <= 1) {
      info.textContent = "データ行がありません。";
      drawBtn.disabled = true;
      summary.textContent = "";
      return;
    }

    info.textContent = `読み込み成功：${allRows.length - 1} 行`;
    drawBtn.disabled = false;

    analyzeData(); // 利用可能な年・疾患を抽出してUIに反映
  };
  reader.onerror = () => {
    info.textContent = "ファイルの読み込みに失敗しました。";
    allRows = [];
    drawBtn.disabled = true;
  };
  reader.readAsText(file, "utf-8");
}

// 簡易CSVパース（カンマ区切りのみ想定）
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  return lines.map(line => line.split(","));
}

// 利用可能な年・疾患を抽出して、選択肢とサマリーに反映
function analyzeData() {
  const header = allRows[0];
  const yearIdx = header.indexOf("year");
  const diseaseIdx = header.indexOf("disease");

  const summary = document.getElementById("dataSummary");
  const diseaseSelect = document.getElementById("diseaseSelect");
  const yearSingle = document.getElementById("yearSingle");
  const yearMulti = document.getElementById("yearMulti");

  if (yearIdx === -1 || diseaseIdx === -1) {
    summary.textContent =
      "注意：CSV に year または disease 列がありません。列名を確認してください。";
    diseaseSelect.disabled = true;
    yearSingle.disabled = true;
    yearMulti.disabled = true;
    return;
  }

  const yearSet = new Set();
  const diseaseSet = new Set();

  allRows.slice(1).forEach(row => {
    if (row[yearIdx]) yearSet.add(row[yearIdx]);
    if (row[diseaseIdx]) diseaseSet.add(row[diseaseIdx]);
  });

  availableYears = Array.from(yearSet).sort((a, b) => Number(a) - Number(b));
  availableDiseases = Array.from(diseaseSet).sort();

  // サマリー表示
  summary.innerHTML =
    `<strong>利用可能な年:</strong> ${availableYears.join(", ")}<br>` +
    `<strong>利用可能な感染症:</strong> ${availableDiseases.join(", ")}`;

  // 感染症セレクトに反映（複数選択）
  diseaseSelect.innerHTML = "";
  availableDiseases.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    diseaseSelect.appendChild(opt);
  });
  diseaseSelect.disabled = false;

  // 年セレクト（単一用）
  yearSingle.innerHTML = '<option value="">選択してください</option>';
  availableYears.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSingle.appendChild(opt);
  });

  // 年セレクト（複数用）
  yearMulti.innerHTML = "";
  availableYears.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearMulti.appendChild(opt);
  });

  // データ種別に応じて UI を再調整
  handleDatasetTypeChange();
}

// グラフ描画（weekly / yearly で分岐）
function drawChart() {
  const message = document.getElementById("message");
  message.textContent = "";

  if (!allRows.length) {
    message.textContent = "先にCSVファイルを読み込んでください。";
    return;
  }

  const header = allRows[0];
  const yearIdx = header.indexOf("year");
  const diseaseIdx = header.indexOf("disease");
  const casesIdx = header.indexOf("cases");
  const weekIdx = header.indexOf("week");

  if (datasetType === "weekly") {
    if (
      yearIdx === -1 ||
      weekIdx === -1 ||
      diseaseIdx === -1 ||
      casesIdx === -1
    ) {
      message.textContent =
        "weekly モードでは year, week, disease, cases 列が必要です。";
      return;
    }

    const mode = document.querySelector('input[name="mode"]:checked').value;
    if (mode === "byDisease") {
      drawByDisease(yearIdx, weekIdx, diseaseIdx, casesIdx);
    } else if (mode === "byYear") {
      drawByYear(yearIdx, weekIdx, diseaseIdx, casesIdx);
    } else if (mode === "tandem") {
      drawTandemYears(yearIdx, weekIdx, diseaseIdx, casesIdx);
    }
  } else {
    // yearly モード
    if (yearIdx === -1 || diseaseIdx === -1 || casesIdx === -1) {
      message.textContent =
        "yearly モードでは year, disease, cases 列が必要です。";
      return;
    }
    drawYearlyByDisease(yearIdx, diseaseIdx, casesIdx);
  }
}

// === weekly: 同一年で複数感染症を比較 ===
function drawByDisease(yearIdx, weekIdx, diseaseIdx, casesIdx) {
  const message = document.getElementById("message");
  const diseaseSelect = document.getElementById("diseaseSelect");
  const yearSingle = document.getElementById("yearSingle");

  const selectedDiseases = Array.from(
    diseaseSelect.selectedOptions,
    opt => opt.value
  );
  const year = yearSingle.value;

  if (!year) {
    message.textContent = "年（同一年で感染症比較）を選択してください。";
    return;
  }
  if (!selectedDiseases.length) {
    message.textContent = "比較する感染症を1つ以上選択してください。";
    return;
  }

  const targetYear = Number(year);
  const filtered = allRows.slice(1).filter(row => {
    const y = Number(row[yearIdx]);
    const d = row[diseaseIdx];
    return y === targetYear && selectedDiseases.includes(d);
  });

  if (!filtered.length) {
    message.textContent = "条件に合致するデータがありません。";
    updateChart([], [], "byDisease");
    return;
  }

  const weekSet = new Set();
  filtered.forEach(row => {
    weekSet.add(Number(row[weekIdx]));
  });
  const weeks = Array.from(weekSet).sort((a, b) => a - b);

  const maps = {};
  selectedDiseases.forEach(d => {
    maps[d] = {};
  });

  filtered.forEach(row => {
    const d = row[diseaseIdx];
    const w = Number(row[weekIdx]);
    const c = Number(row[casesIdx]);
    if (!Number.isNaN(w) && !Number.isNaN(c)) {
      if (!maps[d]) maps[d] = {};
      maps[d][w] = c;
    }
  });

  const datasets = selectedDiseases.map(d => {
    const data = weeks.map(w => (maps[d][w] != null ? maps[d][w] : null));
    return {
      label: `${targetYear}年 ${d}`,
      data,
      borderWidth: 2,
      tension: 0
    };
  });

  updateChart(weeks, datasets, "byDisease");
  openModal();
}

// === weekly: 同一感染症で複数年を比較 ===
function drawByYear(yearIdx, weekIdx, diseaseIdx, casesIdx) {
  const message = document.getElementById("message");
  const diseaseSelect = document.getElementById("diseaseSelect");
  const yearMulti = document.getElementById("yearMulti");

  const selectedDiseases = Array.from(
    diseaseSelect.selectedOptions,
    opt => opt.value
  );
  const selectedYears = Array.from(yearMulti.selectedOptions, opt => opt.value);

  if (!selectedDiseases.length) {
    message.textContent =
      "年比較モードでは、感染症を1つ選択してください（最初の1つのみ使用します）。";
    return;
  }
  if (!selectedYears.length) {
    message.textContent = "比較する年を1つ以上選択してください。";
    return;
  }

  const disease = selectedDiseases[0];
  const years = selectedYears.map(y => Number(y)).sort((a, b) => a - b);

  const filtered = allRows.slice(1).filter(row => {
    const y = Number(row[yearIdx]);
    const d = row[diseaseIdx];
    return years.includes(y) && d === disease;
  });

  if (!filtered.length) {
    message.textContent = "条件に合致するデータがありません。";
    updateChart([], [], "byYear");
    return;
  }

  const weekSet = new Set();
  filtered.forEach(row => {
    weekSet.add(Number(row[weekIdx]));
  });
  const weeks = Array.from(weekSet).sort((a, b) => a - b);

  const maps = {};
  years.forEach(y => {
    maps[y] = {};
  });

  filtered.forEach(row => {
    const y = Number(row[yearIdx]);
    const w = Number(row[weekIdx]);
    const c = Number(row[casesIdx]);
    if (!Number.isNaN(w) && !Number.isNaN(c)) {
      if (!maps[y]) maps[y] = {};
      maps[y][w] = c;
    }
  });

  const datasets = years.map(y => {
    const data = weeks.map(w => (maps[y][w] != null ? maps[y][w] : null));
    return {
      label: `${y}年 ${disease}`,
      data,
      borderWidth: 2,
      tension: 0
    };
  });

  updateChart(weeks, datasets, "byYear");
  openModal();
}

// === weekly: 同一感染症で複数年を連結（タンデム） ===
function drawTandemYears(yearIdx, weekIdx, diseaseIdx, casesIdx) {
  const message = document.getElementById("message");
  const diseaseSelect = document.getElementById("diseaseSelect");
  const yearMulti = document.getElementById("yearMulti");

  const selectedDiseases = Array.from(
    diseaseSelect.selectedOptions,
    opt => opt.value
  );
  const selectedYears = Array.from(yearMulti.selectedOptions, opt => opt.value);

  if (!selectedDiseases.length) {
    message.textContent =
      "タンデムモードでは、感染症を1つ選択してください（最初の1つのみ使用します）。";
    return;
  }
  if (!selectedYears.length) {
    message.textContent = "連結する年を1つ以上選択してください。";
    return;
  }

  const disease = selectedDiseases[0];
  const years = selectedYears.map(y => Number(y)).sort((a, b) => a - b);

  const filtered = allRows.slice(1).filter(row => {
    const y = Number(row[yearIdx]);
    const d = row[diseaseIdx];
    return years.includes(y) && d === disease;
  });

  if (!filtered.length) {
    message.textContent = "条件に合致するデータがありません。";
    updateChart([], [], "tandem");
    return;
  }

  const maps = {};
  const weekSets = {};
  years.forEach(y => {
    maps[y] = {};
    weekSets[y] = new Set();
  });

  filtered.forEach(row => {
    const y = Number(row[yearIdx]);
    const w = Number(row[weekIdx]);
    const c = Number(row[casesIdx]);
    if (!Number.isNaN(y) && !Number.isNaN(w) && !Number.isNaN(c)) {
      if (!maps[y]) maps[y] = {};
      if (!weekSets[y]) weekSets[y] = new Set();
      maps[y][w] = c;
      weekSets[y].add(w);
    }
  });

  const labels = [];
  const data = [];

  years.forEach(y => {
    const weeks = Array.from(weekSets[y] || []).sort((a, b) => a - b);
    weeks.forEach(w => {
      labels.push(`${y}-${w}`);
      data.push(maps[y][w] != null ? maps[y][w] : null);
    });
  });

  const dataset = {
    label: `${disease}（${years.join("〜")}年を連結）`,
    data,
    borderWidth: 2,
    tension: 0
  };

  updateChart(labels, [dataset], "tandem");
  openModal();
}

// === yearly: 複数感染症 × 年次推移 ===
function drawYearlyByDisease(yearIdx, diseaseIdx, casesIdx) {
  const message = document.getElementById("message");
  const diseaseSelect = document.getElementById("diseaseSelect");
  const yearMulti = document.getElementById("yearMulti");

  const selectedDiseases = Array.from(
    diseaseSelect.selectedOptions,
    opt => opt.value
  );
  let years = Array.from(yearMulti.selectedOptions, opt => Number(opt.value));

  if (!selectedDiseases.length) {
    message.textContent =
      "yearly モードでは、比較する感染症を1つ以上選択してください。";
    return;
  }

  if (!years.length) {
    // 年未選択なら全期間
    years = availableYears.map(y => Number(y));
  }
  years.sort((a, b) => a - b);

  const filtered = allRows.slice(1);

  const datasets = selectedDiseases.map(d => {
    const data = years.map(y => {
      const row = filtered.find(
        r => Number(r[yearIdx]) === y && r[diseaseIdx] === d
      );
      return row ? Number(row[casesIdx]) : null;
    });
    return {
      label: d,
      data,
      borderWidth: 2,
      tension: 0
    };
  });

  updateChart(years, datasets, "yearly");
  openModal();
}

// Chart.js の描画更新
function updateChart(labels, datasets, mode) {
  const ctx = document.getElementById("weeklyChart").getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
  }

  let titleText = "";
  if (mode === "byDisease") {
    titleText = "同一年での感染症比較（週別）";
  } else if (mode === "byYear") {
    titleText = "同一感染症での年ごとの週別推移比較";
  } else if (mode === "tandem") {
    titleText = "同一感染症で複数年を連結した週別推移（タンデム）";
  } else if (mode === "yearly") {
    titleText = "複数感染症の年次推移比較";
  } else {
    titleText = "IDWR グラフ";
  }
  currentChartTitle = titleText;
  document.getElementById("modalTitle").textContent = titleText;

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      interaction: {
        mode: "index",
        intersect: false
      },
    plugins: {
    legend: {
        position: "top",
        labels: {
        color: "#000",     // ← 黒
        font: {
            size: 14
        }
        }
    },
    title: {
        display: false
    }
    },
    scales: {
    x: {
        title: {
        display: true,
        text:
            mode === "yearly"
            ? "年"
            : mode === "tandem"
            ? "年-週"
            : "週",
        color: "#000",       // ← 黒
        font: {
            size: 16,          // ← 大きめ
            weight: "bold"
        }
        },
        ticks: {
        color: "#000",       // ← 黒
        font: {
            size: 14           // ← X軸の数字
        },
        maxRotation: 45,
        minRotation: 45
        }
    },
  y: {
    title: {
      display: true,
      text: "報告数",
      color: "#000",
      font: {
        size: 16,
        weight: "bold"
      }
    },
    ticks: {
      color: "#000",
      font: {
        size: 14           // ← Y軸の数字
      }
    },
    beginAtZero: true
  }
}


    }
  });
}

// ===== モーダル制御 =====
function openModal() {
  const modal = document.getElementById("chartModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const modal = document.getElementById("chartModal");
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
}

// ===== グラフを HTML としてダウンロード =====
function downloadChartAsHtml() {
  if (!chartInstance) {
    alert("先にグラフを描画してください。");
    return;
  }

  const dataUrl = chartInstance.toBase64Image();
  const title = currentChartTitle || "IDWR グラフ";
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace("T", " ")
    .replace(/\..+/, "");

  const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        "Helvetica Neue", Arial, sans-serif;
      margin: 1.5rem;
      background: #f9fafb;
      color: #111827;
    }
    h1 {
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
    }
    p {
      font-size: 0.85rem;
      color: #4b5563;
    }
    img {
      max-width: 100%;
      height: auto;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #ffffff;
      padding: 0.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>生成日時: ${timestamp}</p>
  <img src="${dataUrl}" alt="chart image" />
  <p style="margin-top:1rem;font-size:0.75rem;color:#9ca3af;">
    このHTMLはIDWR Viewerからエクスポートされました。
  </p>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "idwr_chart.html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
