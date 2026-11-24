# AG Token Manager

Panel admin sederhana untuk membuat token `AG-...` yang kompatibel dengan fungsi Supabase `public.create_customer_order(p_token, p_form_data)`.

## Keamanan
- Token dibuat di Supabase Edge Function menggunakan `crypto.getRandomValues`.
- `access_tokens.token_hash` = SHA-256 hex dari teks token asli. Kode asli hanya ditampilkan saat pembuatan.
- Backend memverifikasi JWT Supabase Auth **dan** UUID admin di `ADMIN_USER_IDS`.
- Backend membatasi origin melalui `APP_ORIGIN` (bukan pengganti verifikasi admin).
- Tidak pernah menyimpan `service_role` di GitHub/browser.
- Nonaktifkan token hanya saat status `unused`, tanpa menghapus riwayat.

## Instalasi
1. Buat repository GitHub `ag-token-manager`, unggah seluruh file ini.
2. Di Supabase: **Authentication → Users**, buat user admin secara manual (nonaktifkan public sign-up jika tidak dibutuhkan). Salin UUID user admin.
3. Edit `config.js`; isi `SUPABASE_URL` dan **anon/publishable key**, bukan secret/service_role.
4. Tambahkan secret Edge Function `ADMIN_USER_IDS` dengan UUID user admin (dipisah koma jika lebih dari satu) dan `APP_ORIGIN` dengan **origin** hosting, misalnya `https://USERNAME.github.io` (tanpa trailing slash, tanpa path repo). `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` umumnya tersedia otomatis di Supabase Hosted Edge Functions; cek lingkungan Anda.
5. Deploy: `supabase functions deploy ag-tokens --no-verify-jwt`. **Penting:** JWT tetap diverifikasi di dalam kode dengan `auth.getUser(jwt)`. `--no-verify-jwt` hanya mematikan pemeriksaan gateway yang bisa menolak publishable key baru; jangan hapus verifikasi aplikasi.
6. Atur GitHub Pages dari branch `main`, folder `/ (root)`.
7. Periksa bahwa user non-admin mendapat 403 pada fungsi. Lalu login admin dan buat satu token untuk diuji di formulir yang sudah ada.

## Catatan implementasi
- Untuk repo GitHub Pages `https://USERNAME.github.io/ag-token-manager/`, nilai `APP_ORIGIN` adalah `https://USERNAME.github.io`.
- `config.js` berisi URL proyek dan anon/publishable key yang boleh dipublikasikan. **Jangan memasukkan secret.**
- Kolom `status` harus menerima nilai `revoked` (cek constraint yang berlaku); validasi `create_customer_order` tetap menerima hanya `unused`.
- Fungsi ini tidak mencakup pembayaran, audit log admin, atau rate limit per akun. Cocok untuk MVP internal, bukan portal admin publik berskala besar.
