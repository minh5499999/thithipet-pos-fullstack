// ========================================================
// 🚀 SERVER.JS - BACKEND HOÀN CHỈNH 100% CHO THITHIPET POS
// ========================================================
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt'); // Vẫn giữ lại để dịch ngược các tài khoản cũ
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Mở cấu hình CORS chia sẻ tài nguyên chéo nguồn cho Frontend
app.use(cors());

// Tăng giới hạn tải trọng (payload) xử lý chuỗi dữ liệu ảnh Base64 cực lớn từ POS
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================
// 1. CẤU HÌNH KẾT NỐI DATABASE MYSQL TRỰC TIẾP
// ============================================
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',      
  password: '12345', // Mật khẩu máy của bạn
  database: 'thithipet_db', 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ============================================
// 2. CẤU HÌNH THƯ MỤC LƯU TRỮ HÌNH ẢNH (UPLOADS & SERVICES)
// ============================================

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'uploads/'); },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });

const serviceUploadDir = path.join(__dirname, 'services');
if (!fs.existsSync(serviceUploadDir)) {
  fs.mkdirSync(serviceUploadDir);
}
app.use('/services', express.static(path.join(__dirname, 'services')));

const storageService = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'services/'); },
  filename: function (req, file, cb) { cb(null, Date.now() + '-sv-' + file.originalname); }
});
const uploadService = multer({ storage: storageService });

// API Health Check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Database disconnected' });
  }
});

// ============================================
// 3. API XÁC THỰC TÀI KHOẢN (LOGIN) - HỖ TRỢ LAI 2 CHUẨN MẬT KHẨU
// ============================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, pass } = req.body; 
    const plainPassword = password || pass; 

    if (!plainPassword) return res.status(400).json({ error: 'Vui lòng nhập mật khẩu!' });

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

    if (rows.length === 0) return res.status(401).json({ error: 'Tài khoản không tồn tại!' });

    const user = rows[0];
    const dbPasswordHash = user.password || user.pass;

    if (!dbPasswordHash) return res.status(500).json({ error: 'Lỗi DB: Không tìm thấy cột mật khẩu của tài khoản này!' });

    // THUẬT TOÁN LAI: Kiểm tra xem mật khẩu trong DB là mã hóa hay chữ thô
    let isMatch = false;
    if (dbPasswordHash.startsWith('$2b$')) {
      // Nếu là tài khoản cũ, dùng bcrypt để so sánh
      isMatch = await bcrypt.compare(plainPassword, dbPasswordHash);
    } else {
      // Nếu là tài khoản mới, so sánh chữ thô trực tiếp
      isMatch = (plainPassword === dbPasswordHash);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Mật khẩu không chính xác!' });
    }

    res.json({ 
      message: 'Đăng nhập thành công!', 
      ho_ten: user.ho_ten, 
      username: user.username, 
      phan_quyen: user.phan_quyen 
    });

  } catch (err) { 
    console.error('❌ Lỗi API Login:', err);
    res.status(500).json({ error: 'Lỗi máy chủ Backend' }); 
  }
});

// ============================================
// 4. API QUẢN LÝ NHÂN SỰ CHI TIẾT (USERS)
// ============================================
app.get('/api/users', async (req, res) => {
  try {
    // Truy vấn lấy trực tiếp cột 'pass' từ Database
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows);
  } catch (err) { 
    console.error("❌ Lỗi GET users:", err.message);
    res.status(500).json({ error: 'Lỗi không thể lấy danh sách nhân viên' }); 
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { ho_ten, username, password, phan_quyen } = req.body;
    const [existing] = await pool.query('SELECT stt FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(409).json({ error: 'Tên đăng nhập này đã tồn tại!' });

    // BỎ MÃ HÓA - LƯU TRỰC TIẾP CHỮ THÔ
    await pool.query(
      'INSERT INTO users (ho_ten, username, pass, phan_quyen, ngay_them) VALUES (?, ?, ?, ?, NOW())',
      [ho_ten, username, password, phan_quyen]
    );
    res.status(201).json({ message: 'Tạo tài khoản nhân sự thành công!' });
  } catch (err) { 
    console.error("❌ Lỗi chi tiết thêm user:", err.message);
    res.status(500).json({ error: 'Lỗi khi tạo tài khoản mới' }); 
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ho_ten, password, phan_quyen } = req.body;
    if (password) {
      // BỎ MÃ HÓA - LƯU TRỰC TIẾP CHỮ THÔ
      await pool.query('UPDATE users SET ho_ten = ?, pass = ?, phan_quyen = ? WHERE stt = ?', [ho_ten, password, phan_quyen, id]);
    } else {
      await pool.query('UPDATE users SET ho_ten = ?, phan_quyen = ? WHERE stt = ?', [ho_ten, phan_quyen, id]);
    }
    res.json({ message: 'Cập nhật tài khoản nhân sự thành công!' });
  } catch (err) { 
    console.error("❌ Lỗi chi tiết sửa user:", err.message);
    res.status(500).json({ error: 'Lỗi cập nhật tài khoản nhân viên' }); 
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE stt = ?', [req.params.id]);
    res.json({ message: 'Đã xóa tài khoản nhân sự khỏi hệ thống!' });
  } catch (err) { 
    res.status(500).json({ error: 'Lỗi không thể xóa tài khoản này' }); 
  }
});

// ============================================
// CÁC API KHÁC GIỮ NGUYÊN (KHO HÀNG, DỊCH VỤ, ĐƠN HÀNG, VOUCHER)
// ============================================
app.get('/api/products', async (req, res) => {
  try { const [rows] = await pool.query('SELECT * FROM san_pham ORDER BY id DESC'); res.json(rows); } 
  catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.post('/api/products', upload.single('hinh_anh_file'), async (req, res) => {
  try {
    const { ten_sp, gia_ban, so_luong, ma_sp } = req.body;
    if (Number(gia_ban) < 0) return res.status(400).json({ error: 'Giá bán không được nhỏ hơn 0!' });
    if (Number(so_luong) < 0) return res.status(400).json({ error: 'Số lượng tồn kho không được nhỏ hơn 0!' });
    const hinh_anh = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : null;
    await pool.query('INSERT INTO san_pham (ten_sp, gia_ban, so_luong, ma_sp, hinh_anh) VALUES (?, ?, ?, ?, ?)', [ten_sp, Number(gia_ban), Number(so_luong), ma_sp, hinh_anh]);
    res.status(201).json({ message: 'Thành công' });
  } catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.put('/api/products/:id', upload.single('hinh_anh_file'), async (req, res) => {
  try {
    const { id } = req.params; const { ten_sp, gia_ban, so_luong, ma_sp, hinh_anh_cu } = req.body;
    if (Number(gia_ban) < 0) return res.status(400).json({ error: 'Giá bán không được nhỏ hơn 0!' });
    if (Number(so_luong) < 0) return res.status(400).json({ error: 'Số lượng tồn kho không được nhỏ hơn 0!' });
    const hinh_anh = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : hinh_anh_cu;
    await pool.query('UPDATE san_pham SET ten_sp=?, gia_ban=?, so_luong=?, ma_sp=?, hinh_anh=? WHERE id=?', [ten_sp, Number(gia_ban), Number(so_luong), ma_sp, hinh_anh, id]);
    res.json({ message: 'Thành công' });
  } catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.delete('/api/products/:id', async (req, res) => {
  try { await pool.query('DELETE FROM san_pham WHERE id = ?', [req.params.id]); res.json({ message: 'Xóa xong' }); } 
  catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.get('/api/vouchers', async (req, res) => {
  try { const [rows] = await pool.query('SELECT * FROM vouchers ORDER BY id DESC'); res.json(rows); } 
  catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.post('/api/vouchers', async (req, res) => {
  try {
    const { ten_chuong_trinh, ma_voucher, ngay_bat_dau, ngay_het_han, loai_thuong, gia_tri_thuong, so_luong } = req.body;
    await pool.query('INSERT INTO vouchers (ten_chuong_trinh, ma_voucher, ngay_bat_dau, ngay_het_han, loai_thuong, gia_tri_thuong, so_luong) VALUES (?, ?, ?, ?, ?, ?, ?)', [ten_chuong_trinh, ma_voucher, ngay_bat_dau, ngay_het_han, loai_thuong, gia_tri_thuong, Number(so_luong)]);
    res.status(201).json({ message: 'Thành công' });
  } catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.put('/api/vouchers/:id', async (req, res) => {
  try {
    const { id } = req.params; const { ten_chuong_trinh, ma_voucher, ngay_bat_dau, ngay_het_han, loai_thuong, gia_tri_thuong, so_luong } = req.body;
    await pool.query('UPDATE vouchers SET ten_chuong_trinh=?, ma_voucher=?, ngay_bat_dau=?, ngay_het_han=?, loai_thuong=?, gia_tri_thuong=?, so_luong=? WHERE id=?', [ten_chuong_trinh, ma_voucher, ngay_bat_dau, ngay_het_han, loai_thuong, gia_tri_thuong, Number(so_luong), id]);
    res.json({ message: 'Thành công' });
  } catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.delete('/api/vouchers/:id', async (req, res) => {
  try { await pool.query('DELETE FROM vouchers WHERE id = ?', [req.params.id]); res.json({ message: 'Xóa xong' }); } 
  catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.get('/api/orders', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT o.*, JSON_ARRAYAGG(JSON_OBJECT('ten_san_pham', oi.ten_san_pham, 'ma_sp', oi.ma_sp, 'so_luong_ban', oi.so_luong_ban, 'gia_ban', oi.gia_ban)) AS danh_sach_sp FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id GROUP BY o.id ORDER BY o.id DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.post('/api/orders', async (req, res) => {
  const { ma_don, ten_nhan_vien, tong_tien, items, bill_image_base64, ma_voucher_da_dung, phuong_thuc_tt, ghi_chu } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Trống' });
  const connection = await pool.getConnection(); await connection.beginTransaction();
  try {
    let hinh_anh_bill_url = null;
    if (bill_image_base64) {
      const base64Data = bill_image_base64.replace(/^data:image\/png;base64,/, ""); const fileName = `bill_${ma_don}_${Date.now()}.png`; const filePath = path.join(__dirname, 'uploads', fileName); fs.writeFileSync(filePath, base64Data, 'base64'); hinh_anh_bill_url = `http://localhost:5000/uploads/${fileName}`; 
    }
    const [orderResult] = await connection.query('INSERT INTO orders (ma_don, ten_nhan_vien, tong_tien, hinh_anh_bill, phuong_thuc_tt, ghi_chu) VALUES (?, ?, ?, ?, ?, ?)', [ma_don, ten_nhan_vien, tong_tien, hinh_anh_bill_url, phuong_thuc_tt || 'Tiền mặt', ghi_chu]);
    const orderId = orderResult.insertId;
    for (let item of items) {
      await connection.query('INSERT INTO order_items (order_id, ten_san_pham, ma_sp, so_luong_ban, gia_ban) VALUES (?, ?, ?, ?, ?)', [orderId, item.ten_sp, item.ma_sp, item.quantity, item.gia_ban]);
      if (!item.is_service) {
        const [updateResult] = await connection.query('UPDATE san_pham SET so_luong = so_luong - ? WHERE ma_sp = ? AND so_luong >= ?', [item.quantity, item.ma_sp, item.quantity]);
        if (updateResult.affectedRows === 0) throw new Error(`Kho không đủ!`);
      }
    }
    if (ma_voucher_da_dung) { await connection.query('UPDATE vouchers SET so_luong = so_luong - 1 WHERE ma_voucher = ? AND so_luong > 0', [ma_voucher_da_dung]); }
    await connection.commit(); res.status(201).json({ message: 'Thành công' });
  } catch (err) { await connection.rollback(); res.status(500).json({ error: err.message }); } finally { connection.release(); }
});

app.delete('/api/orders/:id', async (req, res) => {
  const connection = await pool.getConnection(); 
  await connection.beginTransaction();
  try {
    const orderId = req.params.id;
    const [items] = await connection.query('SELECT ma_sp, so_luong_ban FROM order_items WHERE order_id = ?', [orderId]);
    for (let item of items) {
      await connection.query('UPDATE san_pham SET so_luong = so_luong + ? WHERE ma_sp = ?', [item.so_luong_ban, item.ma_sp]);
    }
    await connection.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    await connection.query('DELETE FROM orders WHERE id = ?', [orderId]);
    await connection.commit();
    res.json({ message: 'Xóa xong' });
  } catch (err) { 
    await connection.rollback();
    res.status(500).json({ error: 'Lỗi' }); 
  } finally {
    connection.release();
  }
});

app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const [[{ tong_doanh_thu }]] = await pool.query('SELECT SUM(tong_tien) AS tong_doanh_thu FROM orders');
    const [[{ tong_don }]] = await pool.query('SELECT COUNT(id) AS tong_don FROM orders');
    res.json({ tong_doanh_thu: tong_doanh_thu || 0, tong_don: tong_don || 0 });
  } catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.get('/api/dashboard/revenue-by-day', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT DATE(ngay_ban) AS ngay, SUM(tong_tien) AS doanh_thu FROM orders WHERE ngay_ban >= CURDATE() - INTERVAL 6 DAY GROUP BY DATE(ngay_ban)`);
    const revenueMap = {}; rows.forEach(r => { const key = new Date(r.ngay).toISOString().slice(0, 10); revenueMap[key] = Number(r.doanh_thu) || 0; });
    const tenThu = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']; const result = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = d.toISOString().slice(0, 10); result.push({ ngay: key, label: tenThu[d.getDay()], doanh_thu: revenueMap[key] || 0 }); }
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.get('/api/dashboard/top-products', async (req, res) => {
  try { const [rows] = await pool.query(`SELECT ten_san_pham AS name, SUM(so_luong_ban * gia_ban) AS revenue FROM order_items GROUP BY ma_sp, ten_san_pham ORDER BY revenue DESC LIMIT 10`); res.json(rows); } 
  catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.get('/api/dashboard/top-employees', async (req, res) => {
  try { const [rows] = await pool.query(`SELECT ten_nhan_vien AS name, SUM(tong_tien) AS revenue FROM orders GROUP BY ten_nhan_vien ORDER BY revenue DESC LIMIT 10`); res.json(rows); } 
  catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.get('/api/services', async (req, res) => {
  try { const [rows] = await pool.query('SELECT * FROM dich_vu ORDER BY id DESC'); res.json(rows); } 
  catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.post('/api/services', uploadService.single('hinh_anh_file'), async (req, res) => {
  try {
    const { ten_dv, gia_dv, ma_dv } = req.body; const hinh_anh = req.file ? `http://localhost:5000/services/${req.file.filename}` : null;
    await pool.query('INSERT INTO dich_vu (ten_dv, gia_dv, ma_dv, hinh_anh) VALUES (?, ?, ?, ?)', [ten_dv, Number(gia_dv), ma_dv, hinh_anh]);
    res.status(201).json({ message: 'Thành công' });
  } catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.put('/api/services/:id', uploadService.single('hinh_anh_file'), async (req, res) => {
  try {
    const { ten_dv, gia_dv, ma_dv, hinh_anh_cu } = req.body; const hinh_anh = req.file ? `http://localhost:5000/services/${req.file.filename}` : hinh_anh_cu;
    await pool.query('UPDATE dich_vu SET ten_dv=?, gia_dv=?, ma_dv=?, hinh_anh=? WHERE id=?', [ten_dv, Number(gia_dv), ma_dv, hinh_anh, req.params.id]);
    res.json({ message: 'Thành công' });
  } catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.delete('/api/services/:id', async (req, res) => {
  try { await pool.query('DELETE FROM dich_vu WHERE id = ?', [req.params.id]); res.json({ message: 'Xóa xong' }); } 
  catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

// ============================================
// 9. API CÀI ĐẶT CỬA HÀNG (SETTINGS)
// Yêu cầu bảng `settings` chỉ có 1 dòng cố định id = 1:
//
// CREATE TABLE IF NOT EXISTS settings (
//   id INT PRIMARY KEY DEFAULT 1,
//   ten_cua_hang VARCHAR(255),
//   dia_chi VARCHAR(255),
//   so_dien_thoai VARCHAR(50),
//   ten_ngan_hang VARCHAR(255),
//   so_tai_khoan VARCHAR(100),
//   chu_tai_khoan VARCHAR(255),
//   qr_thanh_toan VARCHAR(500)
// );
// ============================================
app.get('/api/settings', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1');
    res.json(rows[0] || {});
  } catch (err) {
    console.error("❌ Lỗi GET settings:", err.message);
    res.status(500).json({ error: 'Lỗi lấy cài đặt cửa hàng' });
  }
});

app.put('/api/settings', upload.single('qr_file'), async (req, res) => {
  try {
    const { ten_cua_hang, dia_chi, so_dien_thoai, ten_ngan_hang, so_tai_khoan, chu_tai_khoan, qr_cu } = req.body;
    // Nếu có file QR mới upload thì dùng file đó, không thì giữ nguyên đường dẫn QR cũ
    const qr_thanh_toan = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : (qr_cu || null);

    await pool.query(
      `INSERT INTO settings (id, ten_cua_hang, dia_chi, so_dien_thoai, ten_ngan_hang, so_tai_khoan, chu_tai_khoan, qr_thanh_toan)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ten_cua_hang = VALUES(ten_cua_hang),
         dia_chi = VALUES(dia_chi),
         so_dien_thoai = VALUES(so_dien_thoai),
         ten_ngan_hang = VALUES(ten_ngan_hang),
         so_tai_khoan = VALUES(so_tai_khoan),
         chu_tai_khoan = VALUES(chu_tai_khoan),
         qr_thanh_toan = VALUES(qr_thanh_toan)`,
      [ten_cua_hang, dia_chi, so_dien_thoai, ten_ngan_hang, so_tai_khoan, chu_tai_khoan, qr_thanh_toan]
    );
    res.json({ message: 'Đã lưu cài đặt cửa hàng!', qr_thanh_toan });
  } catch (err) {
    console.error("❌ Lỗi PUT settings:", err.message);
    res.status(500).json({ error: 'Lỗi lưu cài đặt cửa hàng' });
  }
});

const PORT = 5000;
app.listen(PORT, () => { console.log(`🚀 MÁY CHỦ BACKEND ĐÃ CHẠY TẠI CỔNG: ${PORT}`); });