-- ============================================
-- SCHEMA DATABASE: thithipet_db
-- Chạy file này trong MySQL để khởi tạo database
-- Cách chạy: mysql -u root -p < schema.sql
-- ============================================

CREATE DATABASE IF NOT EXISTS thithipet_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE thithipet_db;

CREATE TABLE IF NOT EXISTS users (
  stt        INT AUTO_INCREMENT PRIMARY KEY,
  ho_ten     VARCHAR(100) NOT NULL,
  username   VARCHAR(50)  NOT NULL UNIQUE,
  pass       VARCHAR(255) NOT NULL,      -- lưu password đã hash bằng bcrypt
  ngay_them  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  phan_quyen ENUM('QuanTriVien', 'NhanVien') NOT NULL DEFAULT 'NhanVien'
);

-- BẢNG QUẢN LÝ SẢN PHẨM (KHO HÀNG)
CREATE TABLE IF NOT EXISTS san_pham (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  ten_sp     VARCHAR(255) NOT NULL,
  gia_ban    DECIMAL(15, 2) NOT NULL DEFAULT 0,
  so_luong   INT NOT NULL DEFAULT 0,
  ma_sp      VARCHAR(50) NOT NULL UNIQUE,
  hinh_anh   VARCHAR(500),               -- lưu URL đường dẫn ảnh
  ngay_tao   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- BẢNG QUẢN LÝ VOUCHER (KHUYẾN MÃI)
CREATE TABLE IF NOT EXISTS vouchers (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  ten_chuong_trinh VARCHAR(255) NOT NULL,
  ma_voucher       VARCHAR(50) NOT NULL UNIQUE,
  ngay_bat_dau     DATE NOT NULL,
  ngay_het_han     DATE NOT NULL,
  loai_thuong      VARCHAR(50) NOT NULL,   -- ví dụ: 'discount', 'percent'
  gia_tri_thuong   DECIMAL(15, 2) NOT NULL,
  so_luong         INT NOT NULL DEFAULT 0,  -- số lượng voucher phát hành
  ngay_tao         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- BẢNG QUẢN LÝ HÓA ĐƠN (ĐƠN HÀNG)
CREATE TABLE IF NOT EXISTS hoa_don (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  ma_hoa_don     VARCHAR(50) NOT NULL UNIQUE,
  ngay_tao       DATETIME DEFAULT CURRENT_TIMESTAMP,
  tong_tien      DECIMAL(15, 2) NOT NULL DEFAULT 0,
  giam_gia       DECIMAL(15, 2) DEFAULT 0,
  thanh_toan_cuoi DECIMAL(15, 2) NOT NULL DEFAULT 0,
  nguoi_lap_hd   VARCHAR(100),              -- Tên nhân viên tạo hóa đơn
  phuong_thuc_tt VARCHAR(50)                -- Ví dụ: 'TienMat', 'ChuyenKhoan'
);

-- BẢNG CHI TIẾT HÓA ĐƠN
CREATE TABLE IF NOT EXISTS chi_tiet_hoa_don (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  hoa_don_id     INT NOT NULL,
  san_pham_id    INT,                       -- Có thể null nếu là dịch vụ
  ten_sp_dich_vu VARCHAR(255) NOT NULL,     -- Tên sản phẩm hoặc dịch vụ
  don_gia        DECIMAL(15, 2) NOT NULL,
  so_luong       INT NOT NULL,
  thanh_tien     DECIMAL(15, 2) NOT NULL,
  ghi_chu        VARCHAR(500),
  FOREIGN KEY (hoa_don_id) REFERENCES hoa_don(id) ON DELETE CASCADE,
  FOREIGN KEY (san_pham_id) REFERENCES san_pham(id) ON DELETE SET NULL
);

-- Tài khoản admin mẫu (mật khẩu thật: 123456)
-- Hash bên dưới được tạo sẵn bằng bcrypt, hoặc bạn có thể chạy
-- node seed.js để tự sinh hash (khuyến nghị hơn vì bcrypt có salt ngẫu nhiên)
