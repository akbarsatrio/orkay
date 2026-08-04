#!/bin/bash
# Launcher installer Orkay untuk macOS.
# Double-click file ini untuk membuka wizard pemasangan di browser.

cd "$(dirname "$0")" || exit 1

echo "======================================"
echo "        Pemasangan Orkay"
echo "======================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  [!] Node.js belum terpasang."
  echo "      Silakan unduh & pasang dari: https://nodejs.org (pilih versi LTS)."
  echo "      Setelah terpasang, jalankan file ini lagi."
  echo ""
  read -r -p "  Tekan Enter untuk menutup..."
  exit 1
fi

echo "  Membuka wizard di browser..."
echo "  (Biarkan jendela ini terbuka selama pemasangan.)"
echo ""

node scripts/wizard/server.mjs

echo ""
read -r -p "  Wizard ditutup. Tekan Enter untuk keluar..."
