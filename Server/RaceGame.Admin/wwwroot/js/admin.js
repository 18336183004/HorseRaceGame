/**
 * RaceGame Admin - Dashboard Interactive & Chart Controller
 * Matches the Dribbble/H-care design aesthetics with smooth curves, bars & donut rings.
 */

document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  initSidebarToggle();
  initClipboardHelpers();
  initTableSearchFilter();
});

/**
 * Initialize all dashboard charts with Chart.js
 */
function initCharts() {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js is not loaded.');
    return;
  }

  // Global Chart.js typography & defaults
  Chart.defaults.font.family = "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  Chart.defaults.color = '#808191';

  // 1. Dual Bar Chart: Rounds Bet Amount & Count
  const trendEl = document.getElementById('roundsTrendChart');
  if (trendEl) {
    const rawLabels = trendEl.getAttribute('data-labels') || '[]';
    const rawAmounts = trendEl.getAttribute('data-amounts') || '[]';
    const rawCounts = trendEl.getAttribute('data-counts') || '[]';

    let labels = [];
    let amounts = [];
    let counts = [];

    try {
      labels = JSON.parse(rawLabels);
      amounts = JSON.parse(rawAmounts);
      counts = JSON.parse(rawCounts);
    } catch (e) {
      console.error('Failed to parse trend chart data:', e);
    }

    if (labels.length === 0) {
      labels = ['R101', 'R102', 'R103', 'R104', 'R105', 'R106', 'R107', 'R108', 'R109', 'R110', 'R111', 'R112'];
      amounts = [1200, 2400, 1800, 3100, 2900, 4200, 3800, 2700, 4600, 3900, 4800, 5200];
      counts = [15, 28, 22, 38, 35, 48, 42, 30, 52, 45, 55, 60];
    }

    new Chart(trendEl, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '投注流水',
            data: amounts,
            backgroundColor: '#6C5DD3',
            borderRadius: 6,
            barThickness: 10,
            yAxisID: 'y'
          },
          {
            label: '注单笔数',
            data: counts,
            backgroundColor: '#00D2B5',
            borderRadius: 6,
            barThickness: 10,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#11142D',
            titleColor: '#fff',
            bodyColor: '#fff',
            cornerRadius: 10,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { size: 11 } }
          },
          y: {
            position: 'left',
            grid: { color: 'rgba(228, 232, 240, 0.6)' },
            border: { display: false },
            ticks: {
              font: { size: 10 },
              callback: val => '¥' + val
            }
          },
          y1: {
            position: 'right',
            grid: { display: false },
            border: { display: false },
            ticks: { font: { size: 10 } }
          }
        }
      }
    });
  }

  // 2. Mini Center Donut Ring (Settlement / Win Rate)
  const ringEl = document.getElementById('miniDonutRing');
  if (ringEl) {
    const rate = parseFloat(ringEl.getAttribute('data-rate') || '78');
    new Chart(ringEl, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [rate, Math.max(0, 100 - rate)],
          backgroundColor: ['#6C5DD3', '#00D2B5'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '72%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
  }

  // 3. Top-Right Donut Chart (Horse Bet Distribution)
  const horseDonutEl = document.getElementById('horseDistChart');
  if (horseDonutEl) {
    new Chart(horseDonutEl, {
      type: 'doughnut',
      data: {
        labels: ['1号 闪电风暴', '2号 疾风烈焰', '3号 霸王征程', '4号 极速先锋', '5号 皇家荣耀', '6号 幸运星'],
        datasets: [{
          data: [28, 22, 18, 14, 11, 7],
          backgroundColor: [
            '#6C5DD3',
            '#00D2B5',
            '#FF754C',
            '#FFAE33',
            '#4D97FF',
            '#FC5A5A'
          ],
          borderWidth: 3,
          borderColor: '#FFFFFF'
        }]
      },
      options: {
        cutout: '68%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#11142D',
            titleColor: '#fff',
            bodyColor: '#fff',
            cornerRadius: 10,
            padding: 10,
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed}%`
            }
          }
        }
      }
    });
  }

  // 4. Bottom-Left Spline Wave Chart (Real-time Throughput Curve)
  const splineEl = document.getElementById('realtimeWaveChart');
  if (splineEl) {
    const ctx = splineEl.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, 'rgba(255, 174, 51, 0.35)');
    gradient.addColorStop(1, 'rgba(255, 174, 51, 0.01)');

    new Chart(splineEl, {
      type: 'line',
      data: {
        labels: ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
        datasets: [{
          label: '实时吞吐注单',
          data: [24, 45, 113, 78, 92, 134, 118, 96, 70],
          borderColor: '#FFAE33',
          borderWidth: 3,
          pointBackgroundColor: '#FFAE33',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          backgroundColor: gradient,
          tension: 0.45
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#11142D',
            titleColor: '#fff',
            bodyColor: '#fff',
            cornerRadius: 8,
            padding: 8
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(228, 232, 240, 0.5)' },
            border: { display: false },
            ticks: { font: { size: 10 } }
          }
        }
      }
    });
  }

  // 5. Purple Highlight Card Mini Wave Chart
  const purpleWaveEl = document.getElementById('purpleCardWave');
  if (purpleWaveEl) {
    const ctx = purpleWaveEl.getContext('2d');
    const waveGrad = ctx.createLinearGradient(0, 0, 0, 70);
    waveGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    waveGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    new Chart(purpleWaveEl, {
      type: 'line',
      data: {
        labels: ['14', '15', '16', '17', '18', '19', '20'],
        datasets: [{
          data: [140, 190, 160, 232, 175, 220, 210],
          borderColor: '#FFFFFF',
          borderWidth: 2.5,
          pointBackgroundColor: '#FFFFFF',
          pointRadius: [0, 0, 0, 5, 0, 0, 0],
          pointHoverRadius: 6,
          fill: true,
          backgroundColor: waveGrad,
          tension: 0.42
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            cornerRadius: 6,
            callbacks: {
              label: ctx => ` 当前峰值: ${ctx.parsed.y}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 9 } }
          },
          y: {
            display: false
          }
        }
      }
    });
  }
}

/**
 * Mobile sidebar drawer toggle
 */
function initSidebarToggle() {
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebar = document.querySelector('.admin-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        sidebar.classList.remove('show');
      }
    });
  }
}

/**
 * Click-to-copy helper for order numbers and round codes
 */
function initClipboardHelpers() {
  document.querySelectorAll('.copyable-code').forEach(el => {
    el.style.cursor = 'pointer';
    el.title = '点击复制';
    el.addEventListener('click', () => {
      const text = el.innerText.trim();
      navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板: ' + text);
      }).catch(err => {
        console.error('复制失败', err);
      });
    });
  });
}

/**
 * Quick search in tables
 */
function initTableSearchFilter() {
  const searchInput = document.getElementById('globalSearchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll('.table-modern tbody tr');
    if (!rows.length) return;

    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      if (!term || text.includes(term)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });
}

/**
 * Light toast alert
 */
function showToast(message) {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.style.cssText = 'background:#11142D;color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.18);opacity:0;transform:translateY(10px);transition:all 0.25s ease;pointer-events:auto;display:flex;align-items:center;gap:8px;';
  toast.innerHTML = `<i class="bi bi-check-circle-fill text-success"></i> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}
