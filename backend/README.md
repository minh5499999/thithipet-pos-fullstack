# ThiThiPet Backend

Backend Node.js + Express + MySQL cho hệ thống ThiThiPet POS/Admin.

## 1. Cài đặt

```bash
cd backend
npm install
```

## 2. Cấu hình database

1. Đổi tên `.env.example` thành `.env`, điền thông tin MySQL thật của bạn.
2. Tạo database + bảng bằng file schema:
   ```bash
   mysql -u root -p < schema.sql
   ```
3. Tạo tài khoản admin mẫu (password đã hash đúng cách bằng bcrypt):
   ```bash
   node seed.js
   ```
   → Tạo user: `username: admin`, `password: 123456`, quyền `QuanTriVien`.

## 3. Chạy server

```bash
npm start
# hoặc khi phát triển, tự restart khi sửa code:
npm run dev
```

Server chạy tại `http://localhost:5000`. Kiểm tra kết nối DB:
```
GET http://localhost:5000/api/health
```

## 4. Các API có sẵn

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/login` | Đăng nhập, body: `{ username, password }` |
| GET | `/api/users` | Lấy danh sách toàn bộ user |
| POST | `/api/users` | Thêm user mới, body: `{ ho_ten, username, password, phan_quyen }` |
| PUT | `/api/users/:stt` | Cập nhật user, body: `{ ho_ten, phan_quyen, password? }` |
| DELETE | `/api/users/:stt` | Xóa user |

## 5. Sửa Login.js (frontend) để gọi API thật

Thay hàm `handleSubmit` hiện tại (đang check cứng `password === '123456'`) bằng:

```javascript
const handleSubmit = async (event) => {
  event.preventDefault();

  if (username.trim() === '') {
    alert('⚠️ Vui lòng nhập tên tài khoản!');
    return;
  }

  try {
    const res = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(`❌ ${data.error}`);
      return;
    }

    // data.phan_quyen sẽ là 'QuanTriVien' hoặc 'NhanVien' lấy từ DB,
    // không còn phụ thuộc vào tab đang chọn trên giao diện nữa
    onLoginSuccess(data.phan_quyen);
  } catch (err) {
    alert('❌ Không kết nối được tới server. Kiểm tra backend đã chạy chưa.');
  }
};
```

Lưu ý: có thể bỏ luôn phần tab "NHÂN VIÊN / QUẢN TRỊ VIÊN" trên giao diện login,
vì giờ quyền hạn được xác định bởi dữ liệu thật trong database, không phải do
người dùng tự chọn tab nữa (tránh việc ai đó tự chọn tab Admin để vào trái phép).

## 6. Bảo mật cần lưu ý trước khi triển khai thật

- Đổi `JWT_SECRET` trong `.env` thành chuỗi ngẫu nhiên, không dùng giá trị mẫu.
- Không commit file `.env` lên Git (thêm vào `.gitignore`).
- Nên thêm JWT token sau khi login để bảo vệ các API còn lại (hiện tại `/api/users` đang mở công khai).
- Giới hạn số lần đăng nhập sai (rate limiting) để chống dò mật khẩu.
