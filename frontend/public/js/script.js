// =======================================================
// SUGAR CHECKER - Script gabungan (data + theme + chart)
// =======================================================
(() => {
  // ---------------------------
  // THEME: toggle + persistence
  // ---------------------------
  const STORAGE_KEY = 'sc-theme';

  function getPreferredTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    } catch (_) {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Sinkron posisi switch
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.checked = theme === 'dark';

    // Selaraskan warna navbar browser (Android)
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', getCSSVar('--bg') || '#ffffff');

    // Perbarui warna chart bila sudah ada
    if (window.macroChart) updateChartTheme(window.macroChart);
  }

  function initTheme() {
    applyTheme(getPreferredTheme());

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        const next = e.target.checked ? 'dark' : 'light';
        try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
        applyTheme(next);
      });
    }

    // Ikuti perubahan system theme jika user belum pilih manual
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', (e) => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) {
          applyTheme(e.matches ? 'dark' : 'light');
        }
      } catch (_) {}
    });
  }

  // ---------------------------
  // CHART helpers (tema-aware)
  // ---------------------------
  function chartColors() {
    return {
      text: getCSSVar('--text') || '#222',
      grid: getCSSVar('--table-row-border') || '#e5e5e5',
      ds: [
        getCSSVar('--chart-carb') || '#42a5f5',    // Karbo
        getCSSVar('--chart-fat') || '#ff7043',     // Lemak
        getCSSVar('--chart-protein') || '#66bb6a'  // Protein
      ],
      ringBorder: getCSSVar('--bg') || '#fff'
    };
  }

  function updateChartTheme(chart) {
    const c = chartColors();

    // dataset warna (urutan: Karbo, Lemak, Protein)
    if (chart.data?.datasets?.[0]) {
      chart.data.datasets[0].backgroundColor = c.ds;
      chart.data.datasets[0].borderColor = c.ringBorder;
    }

    // Legend/axis kalau nanti diaktifkan
    if (chart.options?.plugins?.legend?.labels) {
      chart.options.plugins.legend.labels.color = c.text;
    }
    if (chart.options?.scales) {
      Object.values(chart.options.scales).forEach((sc) => {
        if (sc.ticks) sc.ticks.color = c.text;
        if (sc.grid) sc.grid.color = c.grid;
      });
    }

    chart.update();
  }

  function createOrUpdateMacroChart(macros) {
    const canvas = document.getElementById('macro-chart');
    if (!canvas || !window.Chart) return;

    const c = chartColors();
    const dataArr = [macros.carbs, macros.fat, macros.protein];

    if (window.macroChart) {
      // Update data + tema
      window.macroChart.data.datasets[0].data = dataArr;
      updateChartTheme(window.macroChart);
      return;
    }

    const ctx = canvas.getContext('2d');
    window.macroChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Karbohidrat', 'Lemak', 'Protein'],
        datasets: [{
          data: dataArr,
          backgroundColor: c.ds,
          borderColor: c.ringBorder, // supaya ring rapi di kedua tema
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            display: false, // mengikuti konfigurasi kamu sebelumnya
            labels: { color: c.text }
          },
          tooltip: { enabled: false }
        }
      }
    });
  }

  // =======================================================
  // APP: Data produk + render DOM (kodemu yang digabung)
  // =======================================================
  document.addEventListener('DOMContentLoaded', () => {
    // Init tema dulu agar warna awal konsisten
    initTheme();

    // Simulasi data produk dari API (kode aslimu)
    const productData = {
      name: "Mie Instan Goreng",
      servingSize: 100, // in grams
      nutrients: [
        { label: "Energi", value: 573, unit: "Kal" },
        { label: "Lemak", value: 2.86, unit: "g" },
        { label: "Lemak Jenuh", value: 0.41, unit: "g" },
        { label: "Protein", value: 4.51, unit: "g" },
        { label: "Karbohidrat", value: 25.01, unit: "g" },
        { label: "Gula", value: 1.2, unit: "g" },
        { label: "Sodium", value: 238, unit: "mg" },
        { label: "Kalium", value: 38, unit: "mg" }
      ],
      macroComposition: {
        carbs: 55,
        fat: 30,
        protein: 15
      },
      servingOptions: [
        { label: "1 porsi, kering", value: "101 Kal" },
        { label: "100 gram (g)", value: "137 Kal" },
        { label: "1 mangkuk, kering", value: "151 Kal" },
        { label: "1 mangkuk, masak", value: "219 Kal" },
        { label: "1 porsi (160 g)", value: "219 Kal" }
      ],
      image: "https://via.placeholder.com/400x300.png?text=Gambar+Mie+Instan"
    };

    // Render ke DOM (kode aslimu, disesuaikan panggil chart baru)
    function updateProductInfo(data) {
      // nama & porsi
      document.getElementById('nama-makanan').innerText = data.name;
      document.getElementById('ukuran-porsi').innerText = data.servingSize + " g";

      // tabel gizi
      const tabelGizi = document.getElementById('tabel-gizi');
      tabelGizi.innerHTML = '';
      data.nutrients.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.label}</td>
          <td>${item.value}${item.unit}</td>
        `;
        tabelGizi.appendChild(row);
      });

      // ringkasan
      const calories = data.nutrients.find(item => item.label === "Energi")?.value || 0;
      const fat = data.nutrients.find(item => item.label === "Lemak")?.value || 0;
      const carbs = data.nutrients.find(item => item.label === "Karbohidrat")?.value || 0;
      const protein = data.nutrients.find(item => item.label === "Protein")?.value || 0;

      document.getElementById('info-kalori').innerText = calories;
      document.getElementById('info-lemak').innerText = fat + "g";
      document.getElementById('info-karbo').innerText = carbs + "g";
      document.getElementById('info-protein').innerText = protein + "g";

      // foto
      document.getElementById('foto-makanan').src = data.image;

      // porsi umum
      const porsiUmum = document.getElementById('porsi-umum');
      porsiUmum.innerHTML = '';
      data.servingOptions.forEach(option => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${option.label}</span><span>${option.value}</span>`;
        porsiUmum.appendChild(li);
      });

      // chart makro (tema-aware)
      createOrUpdateMacroChart(data.macroComposition);

      // rincian di bawah chart
      const m = data.macroComposition;
      document.getElementById('rincian-makro').innerHTML =
        `Rincian Kalori: ${m.carbs}% Karb, ${m.fat}% Lemak, ${m.protein}% Prot.`;
    }

    // Panggil saat halaman load
    updateProductInfo(productData);

    // Form submit (kode aslimu)
    const logForm = document.getElementById('log-food-form');
    logForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const tanggal = document.getElementById('tanggal').value;
      const makanan = document.getElementById('makanan').value;
      const jumlah = document.getElementById('jumlah').value;

      alert(`Anda berhasil menyimpan: ${jumlah}g untuk makanan ${makanan} pada tanggal ${tanggal}`);
      // TODO: kirim ke backend
    });

    // Animasi card (kode aslimu)
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
      card.style.opacity = 0;
      card.style.transform = 'translateY(20px)';
    });
    let delay = 0;
    cards.forEach(card => {
      setTimeout(() => {
        card.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        card.style.opacity = 1;
        card.style.transform = 'translateY(0)';
      }, delay);
      delay += 200;
    });
  });
})();
