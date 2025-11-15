# Conntrack Dashboard

Dashboard interaktif untuk monitoring, agregasi, dan visualisasi data conntrack dari mesin Linux Anda.

## Fitur

- 📊 **Visualisasi Real-time**: Grafik interaktif untuk protocol, state, IP addresses, dan ports
- 🔍 **Agregasi & Grouping**: Data dikelompokkan berdasarkan berbagai kriteria
- 📈 **Multiple Charts**: 
  - Distribusi Protocol (Doughnut Chart)
  - Distribusi State (Bar Chart)
  - Top 10 Source IP
  - Top 10 Destination IP
  - Top 10 Destination Ports
  - Protocol vs State Matrix (Stacked Bar Chart)
- 🔎 **Pencarian & Filter**: Filter koneksi berdasarkan protocol, state, IP, atau port
- ⚡ **Auto-refresh**: Update otomatis setiap 5 detik
- 📱 **Responsive Design**: Tampilan yang optimal di desktop dan mobile

## Persyaratan

- Python 3.7+
- Akses ke `/proc/net/nf_conntrack` atau command `conntrack`
- Akses root atau user dengan permission membaca conntrack data

## Instalasi

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Pastikan Anda memiliki akses ke conntrack data:
```bash
# Cek apakah conntrack command tersedia
conntrack -L

# Atau cek file /proc/net/nf_conntrack
cat /proc/net/nf_conntrack | head
```

## Menjalankan Dashboard

**PENTING**: Dashboard memerlukan akses root untuk membaca data conntrack.

### Opsi 1: Menggunakan Docker (Recommended untuk Production)

**Menggunakan Docker Compose (Paling Mudah):**
```bash
# Build dan jalankan
docker-compose up -d

# Lihat logs
docker-compose logs -f

# Stop
docker-compose down
```

**Menggunakan Docker langsung:**
```bash
# Build image
docker build -t conntrack-dashboard .

# Jalankan container
docker run -d \
  --name conntrack-dashboard \
  --cap-add=NET_ADMIN \
  --cap-add=NET_RAW \
  --network=host \
  -p 8000:8000 \
  --restart unless-stopped \
  conntrack-dashboard
```

**Akses dashboard:**
```
http://localhost:8000
```

**Catatan Docker:**
- Container memerlukan `NET_ADMIN` dan `NET_RAW` capabilities untuk akses conntrack
- Menggunakan `network_mode: host` untuk akses langsung ke network stack host
- Dengan `network_mode: host`, container sudah memiliki akses ke `/proc/net/nf_conntrack` tanpa perlu volume mount

### Opsi 2: Menggunakan sudo (Recommended untuk Development)

**Jika menggunakan virtual environment:**
```bash
# Aktifkan venv terlebih dahulu
source venv/bin/activate  # atau nama venv Anda

# Kemudian jalankan script
chmod +x start_sudo.sh
./start_sudo.sh
```

**Atau manual dengan venv:**
```bash
source venv/bin/activate
sudo $(which python) app.py
```

**Tanpa venv:**
```bash
sudo python3 app.py
```

### Opsi 3: Tanpa sudo (jika sudah ada CAP_NET_ADMIN)
```bash
python app.py
```

Atau menggunakan uvicorn langsung:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### Opsi 4: Berikan CAP_NET_ADMIN capability (tanpa sudo)
```bash
sudo setcap cap_net_admin+ep $(which python3)
python app.py
```

2. Buka browser dan akses:
```
http://localhost:8000
```

## Struktur Proyek

```
Conntrack/
├── app.py                 # FastAPI backend server
├── conntrack_parser.py    # Parser untuk data conntrack
├── requirements.txt       # Python dependencies
├── Dockerfile             # Docker image definition
├── docker-compose.yml    # Docker Compose configuration
├── .dockerignore         # Files to ignore in Docker build
├── README.md             # Dokumentasi
├── start.sh              # Script untuk menjalankan tanpa sudo
├── start_sudo.sh         # Script untuk menjalankan dengan sudo
└── static/
    ├── index.html        # Dashboard HTML
    ├── style.css         # Styling
    └── dashboard.js      # JavaScript untuk visualisasi
```

## API Endpoints

- `GET /` - Dashboard HTML
- `GET /api/connections` - Semua koneksi conntrack
- `GET /api/summary` - Ringkasan agregasi lengkap
- `GET /api/aggregate/protocol` - Agregasi berdasarkan protocol
- `GET /api/aggregate/state` - Agregasi berdasarkan state
- `GET /api/aggregate/source-ip?top_n=10` - Top N source IP
- `GET /api/aggregate/destination-ip?top_n=10` - Top N destination IP
- `GET /api/aggregate/ports?port_type=dport&top_n=10` - Top N ports
- `GET /api/group/protocol-state` - Grouping protocol dan state

## Penggunaan

### Dashboard

1. **Statistik Overview**: Lihat total koneksi, protocol aktif, dan state unik
2. **Charts**: Scroll ke bawah untuk melihat berbagai visualisasi
3. **Tabel Detail**: Lihat semua koneksi dengan fitur pencarian dan filter
4. **Auto-refresh**: Data akan ter-update otomatis setiap 5 detik (dapat di-disable)

### Filter & Pencarian

- Gunakan search box untuk mencari berdasarkan IP, port, protocol, atau state
- Gunakan dropdown filter untuk memfilter berdasarkan protocol atau state
- Filter dapat dikombinasikan dengan pencarian

## Troubleshooting

### Error: "Error membaca conntrack" atau "Permission denied"

- **Solusi utama**: Jalankan server dengan `sudo python app.py`
- Pastikan Anda menjalankan sebagai root atau user dengan permission yang cukup
- Cek apakah `/proc/net/nf_conntrack` dapat dibaca: `sudo cat /proc/net/nf_conntrack | head`
- Atau install `conntrack-tools`: `sudo apt-get install conntrack-tools`
- Verifikasi dengan: `sudo conntrack -L | head`

### Tidak ada data yang muncul

- **Paling umum**: Server tidak dijalankan dengan sudo. Coba `sudo python app.py`
- Pastikan ada koneksi aktif di sistem (coba buka website atau ping)
- Cek apakah conntrack module sudah di-load: `lsmod | grep nf_conntrack`
- Coba jalankan `sudo conntrack -L` secara manual untuk verifikasi
- Dashboard akan menampilkan pesan error yang jelas jika ada masalah permission
- Tekan `Ctrl+F5` atau `Shift+F5` untuk hard refresh (clear cache) / Atau buka Developer Tools (F12) > Network tab > check "Disable cache"

### Port 8000 sudah digunakan

- Ubah port di `app.py` atau gunakan:
```bash
uvicorn app:app --host 0.0.0.0 --port 8080
```

- Untuk Docker, ubah port di `docker-compose.yml` atau gunakan:
```bash
docker run -d --name conntrack-dashboard --cap-add=NET_ADMIN --cap-add=NET_RAW --network=host -p 8080:8000 conntrack-dashboard
```

### Docker container tidak bisa membaca conntrack

- Pastikan container dijalankan dengan capabilities yang diperlukan:
  ```bash
  --cap-add=NET_ADMIN --cap-add=NET_RAW
  ```
- Atau gunakan `network_mode: host` di docker-compose.yml
- Atau gunakan `--privileged` mode (kurang secure):
  ```bash
  docker run --privileged ...
  ```
- Verifikasi dengan:
  ```bash
  docker exec conntrack-dashboard conntrack -L
  ```

## Catatan Keamanan

- Dashboard ini membaca data conntrack yang mungkin berisi informasi sensitif
- Jangan expose dashboard ke internet tanpa autentikasi
- Gunakan firewall atau reverse proxy dengan autentikasi untuk production

## Lisensi

MIT License

