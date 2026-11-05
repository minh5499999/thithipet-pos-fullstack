require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./db');

const accounts = [
  { ho_ten: 'Admin Anna',      username: 'admin',     password: '123456', phan_quyen: 'QuanTriVien' },
  { ho_ten: 'Nguyễn Văn Bình', username: 'nhanvien1', password: '123456', phan_quyen: 'NhanVien' },
];

async function seed() {
  try {
    for (const acc of accounts) {
      const [existing] = await pool.query(
        'SELECT stt FROM users WHERE username = ?',
        [acc.username]
      );

      if (existing.length > 0) {
        console.log(`⚠️  Tài khoản "${acc.username}" đã tồn tại, bỏ qua.`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(acc.password, 10);

      await pool.query(
        'INSERT INTO users (ho_ten, username, pass, phan_quyen) VALUES (?, ?, ?, ?)',
        [acc.ho_ten, acc.username, hashedPassword, acc.phan_quyen]
      );

      console.log(`✅ Đã tạo: username="${acc.username}", password="${acc.password}", quyền="${acc.phan_quyen}"`);
    }

    console.log('🎉 Hoàn tất!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi seed dữ liệu:', err.message);
    process.exit(1);
  }
}

seed();