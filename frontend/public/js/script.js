document.addEventListener('DOMContentLoaded', () => {
    // URL dari API backend Anda tetap sama.
    // fetch(`/api/makanan/mie`)
    // ...

    // --- MENGGUNAKAN DATA TIRUAN ---
    const mockData = {
        nama: "Mie",
        porsiDefault: "100 gram",
        // PERUBAHAN DI SINI: Menggunakan path lokal dari folder img
        // Pastikan Anda punya gambar di folder 'frontend/public/img/'
        fotoUrl: "../img/mie-goreng.jpg", 
        persenAKG: 7,
        ringkasanGizi: {
            kalori: 137,
            lemak: 2.06,
            karbo: 25.01,
            protein: 4.51
        },
        makroNutrien: {
            karbohidrat: 73,
            lemak: 14,
            protein: 13
        },
        infoLengkap: [
            { nama: "Energi", nilai: "573 kj" },
            { nama: "Lemak", nilai: "2,06g" },
            { nama: "Lemak Jenuh", nilai: "0,417g" },
            { nama: "Protein", nilai: "4,51g" },
            { nama: "Karbohidrat", nilai: "25,01g" },
            { nama: "Gula", nilai: "1,2g" },
            { nama: "Sodium", nilai: "236mg" },
            { nama: "Kalium", nilai: "38mg" },
        ],
        porsiUmum: [
            { nama: "1 ons, kering, hasil", kalori: 101 },
            { nama: "100 gram (g)", kalori: 137 },
            { nama: "1 mangkuk, kering, hasil", kalori: 151 },
            { nama: "1 mangkuk, masak", kalori: 219 },
            { nama: "1 porsi (160 g)", kalori: 219 },
        ]
    };
    
    // Panggil fungsi displayFoodData, sisanya sama
    displayFoodData(mockData);
});

// Fungsi displayFoodData dan createMacroChart tidak ada perubahan.
// Salin saja dari kode sebelumnya.

function displayFoodData(data) {
    document.getElementById('nama-makanan').textContent = data.nama;
    document.getElementById('ukuran-porsi').textContent = data.porsiDefault;
    
    // Mengatur path gambar dari data
    const imgElement = document.getElementById('foto-makanan');
    imgElement.src = data.fotoUrl;
    imgElement.alt = `Foto ${data.nama}`;
    // Jika gambar tidak ditemukan, tampilkan placeholder
    imgElement.onerror = function() { 
        this.src = 'https://via.placeholder.com/400x300?text=Gambar+Tidak+Ditemukan';
    };

    document.getElementById('persen-akg').textContent = `${data.persenAKG}% dari AKG*`;
    document.getElementById('info-kalori').textContent = Math.round(data.ringkasanGizi.kalori);
    document.getElementById('info-lemak').textContent = data.ringkasanGizi.lemak.toFixed(2) + 'g';
    document.getElementById('info-karbo').textContent = data.ringkasanGizi.karbo.toFixed(2) + 'g';
    document.getElementById('info-protein').textContent = data.ringkasanGizi.protein.toFixed(2) + 'g';

    const tabelGiziBody = document.getElementById('tabel-gizi');
    tabelGiziBody.innerHTML = '';
    data.infoLengkap.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.nama}</td><td>${item.nilai}</td>`;
        tabelGiziBody.appendChild(row);
    });

    const listPorsi = document.getElementById('porsi-umum');
    listPorsi.innerHTML = '';
    data.porsiUmum.forEach(porsi => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<span>${porsi.nama}</span><strong>${porsi.kalori} Kal</strong>`;
        listPorsi.appendChild(listItem);
    });
    
    createMacroChart(data.makroNutrien);
}

function createMacroChart(makroData) {
    const ctx = document.getElementById('macro-chart').getContext('2d');
    if (window.myMacroChart) {
        window.myMacroChart.destroy();
    }
    window.myMacroChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Karbohidrat', 'Lemak', 'Protein'],
            datasets: [{
                label: 'Rincian Kalori',
                data: [makroData.karbohidrat, makroData.lemak, makroData.protein],
                backgroundColor: ['#4CAF50', '#FFC107', '#F44336'],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw}%`;
                        }
                    }
                }
            }
        }
    });
    const rincianMakroDiv = document.getElementById('rincian-makro');
    rincianMakroDiv.innerHTML = `Rincian Kalori: ${makroData.lemak}% lemak, ${makroData.karbohidrat}% karb, ${makroData.protein}% prot.`;
}