#!/bin/bash
# Launcher installer Orkay untuk Linux.
# Jalankan: ./pasang-orkay.sh (atau double-click bila desktop mengizinkan).

cd "$(dirname "$0")" || exit 1

echo "======================================"
echo "        Pemasangan Orkay"
echo "======================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  [!] Node.js belum terpasang."
  echo "      Pasang Node.js 18+ dari https://nodejs.org atau package manager distro-mu."
  echo "      Setelah terpasang, jalankan file ini lagi."
  echo ""
  read -r -p "  Tekan Enter untuk menutup..."
  exit 1
fi

echo "  Membuka wizard di browser..."
echo "  (Biarkan terminal ini terbuka selama pemasangan.)"
echo ""

node scripts/wizard/server.mjs

echo ""
read -r -p "  Wizard ditutup. Tekan Enter untuk keluar..."
