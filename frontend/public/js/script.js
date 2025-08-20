document.addEventListener('DOMContentLoaded', () => {
  // ===== THEME =====
  const THEME_KEY = 'sc-theme';
  const toggle = document.getElementById('theme-toggle');
  toggle.checked = (document.documentElement.getAttribute('data-theme') === 'dark');
  toggle.addEventListener('change', () => {
    const val = toggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', val);
    localStorage.setItem(THEME_KEY, val);
  });

  // ===== DOM =====
  const landing = document.getElementById('landing');
  const detail = document.getElementById('detail');
  const goHome = document.getElementById('go-home');
  const backBtn = document.getElementById('back-to-home');

  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const resultsWrap = document.getElementById('search-results');
  const tags = Array.from(document.querySelectorAll('.tag'));
  const openScannerBtn = document.getElementById('open-scanner');

  const namaMakanan = document.getElementById('nama-makanan');
  const ukuranPorsi = document.getElementById('ukuran-porsi');
  const tabelGizi = document.getElementById('tabel-gizi');
  const persenAKG = document.getElementById('persen-akg');
  const rincianMakro = document.getElementById('rincian-makro');
  const fotoMakanan = document.getElementById('foto-makanan');
  const infoKal = document.getElementById('info-kalori');
  const infoLemak = document.getElementById('info-lemak');
  const infoKarbo = document.getElementById('info-karbo');
  const infoProtein = document.getElementById('info-protein');
  const porsiUmum = document.getElementById('porsi-umum');

  // ===== DATA DEMO =====
  const PRODUCTS = [
    {
      id: 'mie-001',
      name: 'Mie Instan Goreng',
      barcode: '8991234567890',
      ecode: ['E621', 'E110'],
      halalStatus: 'MUSHBOOH',
      servingSize: 100,
      nutrients: [
        { label: 'Energi', value: 573, unit: 'Kal' },
        { label: 'Lemak', value: 2.86, unit: 'g' },
        { label: 'Lemak Jenuh', value: 0.41, unit: 'g' },
        { label: 'Protein', value: 4.51, unit: 'g' },
        { label: 'Karbohidrat', value: 25.01, unit: 'g' },
        { label: 'Gula', value: 1.2, unit: 'g' },
        { label: 'Sodium', value: 238, unit: 'mg' },
        { label: 'Kalium', value: 38, unit: 'mg' }
      ],
      macroComposition: { carbs: 55, fat: 30, protein: 15 },
      servingOptions: [
        { label: '1 porsi (100 g)', grams: 100 },
        { label: '½ porsi (50 g)', grams: 50 },
        { label: '1½ porsi (150 g)', grams: 150 }
      ],
      image: './img/Foto-Produk/Mie-Instan.png'
    }
  ];

  // ===== ROUTER SEDERHANA =====
  function show(section) {
    if (section === 'home') {
      landing.hidden = false; detail.hidden = true;
      if (location.hash !== '#home') location.hash = '#home';
      searchInput.focus();
    } else {
      landing.hidden = true; detail.hidden = false;
      if (location.hash !== '#detail') location.hash = '#detail';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  goHome.addEventListener('click', () => show('home'));
  backBtn.addEventListener('click', () => show('home'));
  window.addEventListener('hashchange', () => (location.hash === '#detail' ? show('detail') : show('home')));
  if (location.hash === '#detail') show('detail'); else show('home');

  // ===== SEARCH =====
  function renderResults(list) {
    resultsWrap.innerHTML = '';
    if (!list.length) {
      resultsWrap.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center">Tidak ada hasil.</div>';
      return;
    }
    list.forEach(p => {
      const card = document.createElement('div');
      card.className = 'result-card'; card.role = 'button'; card.tabIndex = 0;

      const img = document.createElement('img');
      img.className = 'result-thumb'; img.src = p.image; img.alt = p.name;

      const meta = document.createElement('div'); meta.className = 'result-meta';
      const title = document.createElement('div'); title.className = 'result-title'; title.textContent = p.name;
      const sub = document.createElement('div'); sub.className = 'result-sub';
      sub.textContent = `Barcode: ${p.barcode}${p.ecode?.length ? ' • E-code: ' + p.ecode.join(', ') : ''}`;

      const badge = document.createElement('span');
      badge.className = 'badge ' + (p.halalStatus || 'HALAL').toLowerCase();
      badge.textContent = p.halalStatus || 'HALAL';

      meta.append(title, sub, badge);
      card.append(img, meta);

      card.addEventListener('click', () => openDetail(p));
      card.addEventListener('keyup', e => e.key === 'Enter' && openDetail(p));

      resultsWrap.appendChild(card);
    });
  }
  function doSearch(q) {
    const query = (q || '').trim().toLowerCase();
    if (!query) { resultsWrap.innerHTML = ''; return; }
    const list = PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.barcode.includes(query) ||
      (p.ecode || []).some(e => e.toLowerCase().includes(query))
    );
    renderResults(list);
  }
  searchForm.addEventListener('submit', e => { e.preventDefault(); doSearch(searchInput.value); });
  searchInput.addEventListener('input', e => { const v = e.target.value; if (v.length >= 2) doSearch(v); else resultsWrap.innerHTML = ''; });
  tags.forEach(t => t.addEventListener('click', () => { const q = t.dataset.q; searchInput.value = q; doSearch(q); }));

  // ===== DETAIL =====
  let macroChart;
  function openDetail(product) {
    namaMakanan.textContent = product.name;
    ukuranPorsi.textContent = (product.servingSize || 100) + ' g';
    fotoMakanan.src = product.image; fotoMakanan.alt = product.name;

    tabelGizi.innerHTML = '';
    (product.nutrients || []).forEach(n => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${n.label}</td><td>${n.value} ${n.unit}</td>`;
      tabelGizi.appendChild(tr);
    });

    const energi = (product.nutrients || []).find(n => n.label.toLowerCase().includes('energi'));
    const lemak = (product.nutrients || []).find(n => n.label.toLowerCase() === 'lemak');
    const karb = (product.nutrients || []).find(n => n.label.toLowerCase().startsWith('karbo'));
    const prot = (product.nutrients || []).find(n => n.label.toLowerCase().startsWith('protein'));

    infoKal.textContent = energi ? energi.value : 0;
    infoLemak.textContent = lemak ? `${lemak.value}${lemak.unit}` : '0g';
    infoKarbo.textContent = karb ? `${karb.value}${karb.unit}` : '0g';
    infoProtein.textContent = prot ? `${prot.value}${prot.unit}` : '0g';

    porsiUmum.innerHTML = '';
    (product.servingOptions || []).forEach(opt => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${opt.label}</span><span>${opt.grams} g</span>`;
      porsiUmum.appendChild(li);
    });

    const akg = energi ? Math.round((energi.value / 2000) * 100) : 0;
    persenAKG.textContent = `≈ ${akg}% dari AKG*`;

    const ctx = document.getElementById('macro-chart').getContext('2d');
    if (macroChart) macroChart.destroy();
    const css = getComputedStyle(document.documentElement);
    const carbColor = css.getPropertyValue('--chart-carb').trim() || '#42a5f5';
    const proteinColor = css.getPropertyValue('--chart-protein').trim() || '#66bb6a';
    const fatColor = css.getPropertyValue('--chart-fat').trim() || '#ff7043';

    const carbs = product.macroComposition?.carbs ?? 0;
    const fat = product.macroComposition?.fat ?? 0;
    const protein = product.macroComposition?.protein ?? 0;
    rincianMakro.textContent = `Karbohidrat ${carbs}%, Lemak ${fat}%, Protein ${protein}%`;

    macroChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['Karbo', 'Protein', 'Lemak'],
        datasets: [{ data: [carbs, protein, fat], backgroundColor: [carbColor, proteinColor, fatColor] }] },
      options: { plugins: { legend: { position: 'bottom' } }, cutout: '65%' }
    });

    show('detail');
  }

 // ===== SCANNER (reworked) =====
const modal = document.getElementById('scanner-modal');
const closeEls = Array.from(modal.querySelectorAll('[data-close]'));
const cameraSelect = document.getElementById('camera-select');
const switchBtn = document.getElementById('switch-camera');
const fileInput = document.getElementById('barcode-file');
let html5Qrcode;
let activeCamId = null;

async function startWithCamera(deviceIdOrFacingMode) {
  if (!html5Qrcode) html5Qrcode = new Html5Qrcode('qr-reader');
  const config = {
    fps: 12,
    qrbox: { width: 260, height: 140 },
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E
    ]
  };
  await html5Qrcode.start(
    deviceIdOrFacingMode,
    config,
    async (decodedText) => {
      // Panggil BACKEND scan exact:
      try {
        const r = await fetch(`http://localhost:3000/api/products/scan/${decodedText}`);
        const j = await r.json();
        if (j.success) {
          stopScanner();
          // tampilkan di detail (mapping sesuai struktur backend)
          const p = j.data.product;
          openDetail({
            name: p.product_name,
            barcode: p.barcode,
            servingSize: parseInt(p.nf_serving_size) || 100,
            nutrients: [
              {label:'Energi', value: p.nf_calories || 0, unit:'Kal'},
              {label:'Lemak', value: p.nf_total_fat || 0, unit:'g'},
              {label:'Lemak Jenuh', value: p.nf_saturated_fat || 0, unit:'g'},
              {label:'Protein', value: p.nf_protein || 0, unit:'g'},
              {label:'Karbohidrat', value: p.nf_total_carbs || 0, unit:'g'},
              {label:'Gula', value: p.nf_total_sugars || 0, unit:'g'},
              {label:'Sodium', value: p.nf_sodium || 0, unit:'mg'},
            ],
            macroComposition: {
              carbs: 55, fat: 30, protein: 15 // opsional: bisa dihitung beneran
            },
            image: p.main_image || './img/Foto-Produk/Mie-Instan.png'
          });
        } else {
          console.log('Tidak ditemukan:', decodedText);
        }
      } catch (e) { console.error(e); }
    },
    _ => {}
  );
}

function bestBackCamera(cameras) {
  // pilih yg labelnya mengandung 'back' / 'rear', kalau tidak ada pakai pertama
  const back = cameras.find(c => /back|rear|environment/i.test(c.label));
  return back ? back.id : (cameras[0] && cameras[0].id);
}

function populateCameraSelect(cameras, selectedId) {
  cameraSelect.innerHTML = '';
  cameras.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.label || c.id;
    if (c.id === selectedId) opt.selected = true;
    cameraSelect.appendChild(opt);
  });
}

async function openScanner() {
  modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras || cameras.length === 0) {
      alert('Kamera tidak ditemukan. Coba “Scan dari Foto”.');
      return;
    }
    activeCamId = bestBackCamera(cameras);
    populateCameraSelect(cameras, activeCamId);
    await startWithCamera(activeCamId);
  } catch (err) {
    console.error('Tidak bisa akses kamera:', err);
    // fallback facingMode environment (untuk beberapa WebView)
    try {
      await startWithCamera({ facingMode: 'environment' });
    } catch (e) {
      alert('Akses kamera gagal. Coba “Scan dari Foto”.');
    }
  }
}

function stopScanner() {
  if (html5Qrcode && html5Qrcode.isScanning) {
    html5Qrcode.stop().catch(()=>{}).finally(()=>{
      modal.hidden = true; modal.setAttribute('aria-hidden','true');
    });
  } else {
    modal.hidden = true; modal.setAttribute('aria-hidden','true');
  }
}

openScannerBtn.addEventListener('click', openScanner);
cameraSelect.addEventListener('change', async () => {
  const newId = cameraSelect.value;
  if (newId && newId !== activeCamId) {
    await html5Qrcode.stop().catch(()=>{});
    activeCamId = newId;
    await startWithCamera(activeCamId);
  }
});
switchBtn.addEventListener('click', async () => {
  const opts = Array.from(cameraSelect.options);
  if (opts.length < 2) return;
  const idx = opts.findIndex(o => o.value === cameraSelect.value);
  const next = opts[(idx + 1) % opts.length].value;
  cameraSelect.value = next;
  cameraSelect.dispatchEvent(new Event('change'));
});
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (!html5Qrcode) html5Qrcode = new Html5Qrcode('qr-reader');
    const result = await html5Qrcode.scanFile(file, true);
    // hasilnya string barcode → panggil backend seperti di atas
    const r = await fetch(`http://localhost:3000/api/products/scan/${result}`);
    const j = await r.json();
    if (j.success) {
      stopScanner();
      const p = j.data.product;
      openDetail({
        name: p.product_name, barcode: p.barcode,
        servingSize: parseInt(p.nf_serving_size) || 100,
        nutrients: [
          {label:'Energi', value: p.nf_calories || 0, unit:'Kal'},
          {label:'Lemak', value: p.nf_total_fat || 0, unit:'g'},
          {label:'Lemak Jenuh', value: p.nf_saturated_fat || 0, unit:'g'},
          {label:'Protein', value: p.nf_protein || 0, unit:'g'},
          {label:'Karbohidrat', value: p.nf_total_carbs || 0, unit:'g'},
          {label:'Gula', value: p.nf_total_sugars || 0, unit:'g'},
          {label:'Sodium', value: p.nf_sodium || 0, unit:'mg'},
        ],
        macroComposition: { carbs:55, fat:30, protein:15 },
        image: p.main_image || './img/Foto-Produk/Mie-Instan.png'
      });
    } else {
      alert('Produk tidak ditemukan untuk barcode: ' + result);
    }
  } catch (err) {
    console.error(err);
    alert('Gagal memindai dari foto.');
  } finally {
    e.target.value = '';
  }
});
closeEls.forEach(el => el.addEventListener('click', stopScanner));
modal.addEventListener('click', e => {
  if (e.target === modal || e.target.classList.contains('modal-backdrop')) stopScanner();
});

  // Demo awal
  doSearch('Mie');
});

function isValidEan13(code) {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = code.split('').map(d=>+d);
  const sum = digits.slice(0,12).reduce((acc,d,i)=> acc + d * (i%2===0?1:3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === digits[12];
}
// di /scan:
if (!/^\d{8,14}$/.test(barcode) || (barcode.length===13 && !isValidEan13(barcode))) {
  return res.status(400).json({ success:false, message:'Invalid barcode' });
}
