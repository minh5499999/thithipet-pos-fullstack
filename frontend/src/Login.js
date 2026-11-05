import React, { useState } from 'react';
import './Login.css';
import { notify } from './notify';
// Dùng bản đã thu nhỏ đúng kích thước hiển thị — ảnh gốc vẫn nằm nguyên
// trong decorapp/ nếu cần chỉnh sửa lại về sau
import logoPetShop from './decorapp/logopetshop-opt.png';
import pawMascot from './decorapp/pawmascot-opt.png';

// Địa chỉ backend - đổi thành domain thật khi triển khai lên server
const API_URL = 'http://localhost:5000';

function Login({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('NhanVien');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (username.trim() === '') {
      notify.warning('Vui lòng nhập tên tài khoản!');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        notify.error(data.error);
        return;
      }

      // 🔒 Kiểm tra tab đang chọn có khớp với quyền thật trong database không
      if (data.phan_quyen !== activeTab) {
        const tenTabDaChon = activeTab === 'QuanTriVien' ? 'QUẢN TRỊ VIÊN' : 'NHÂN VIÊN';
        notify.error(`Tài khoản này không có quyền "${tenTabDaChon}". Vui lòng chọn đúng vai trò của bạn.`);
        return;
      }

      // 🚀 Truyền TOÀN BỘ thông tin user (không chỉ mỗi phan_quyen) lên App.js
      // để các trang sau (Admin.js, trang POS) hiển thị đúng tên người đang đăng nhập
      notify.success(`Xin chào ${data.ho_ten}! Đăng nhập thành công.`);
      onLoginSuccess({
        ho_ten: data.ho_ten,
        username: data.username,
        phan_quyen: data.phan_quyen,
      });
    } catch (err) {
      notify.error('Không kết nối được tới server. Kiểm tra backend đã chạy chưa (node server.js trong thư mục backend).');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pet-pos-login-env">
      <div className="pet-pos-login-card">
        <div className="pet-pos-logo-wrapper">
          <img src={logoPetShop} alt="ThiThiPet Logo" className="pet-brand-img" />
        </div>

        <h1 className="pet-pos-title">ThiThiPet POS</h1>
        <p className="pet-pos-subtitle">Hệ thống quản lý bán hàng &amp; chăm sóc thú cưng</p>

        <div className="pet-pos-tab-capsule" role="tablist" aria-label="Chọn vai trò đăng nhập">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'NhanVien'}
            className={`pet-tab-btn ${activeTab === 'NhanVien' ? 'active-staff' : ''}`}
            onClick={() => setActiveTab('NhanVien')}
          >
            NHÂN VIÊN
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'QuanTriVien'}
            className={`pet-tab-btn ${activeTab === 'QuanTriVien' ? 'active-admin' : ''}`}
            onClick={() => setActiveTab('QuanTriVien')}
          >
            QUẢN TRỊ VIÊN
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pet-pos-form">
          <div className="pet-input-group">
            <span className="pet-input-icon-left" aria-hidden="true">👤</span>
            <input
              type="text"
              placeholder="Tên Đăng Nhập / Email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              aria-label="Tên đăng nhập"
              required
            />
          </div>

          <div className="pet-input-group" style={{ marginBottom: '28px' }}>
            <span className="pet-input-icon-left" aria-hidden="true">🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Mật Khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-label="Mật khẩu"
              required
            />
            <span
              className="pet-input-icon-right-toggle"
              onClick={() => setShowPassword(!showPassword)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPassword(!showPassword); } }}
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? '👁️' : '🙈'}
            </span>
          </div>

          <button type="submit" className="pet-btn-submit" disabled={isLoading}>
            {isLoading && <span className="pet-spinner" aria-hidden="true" />}
            {isLoading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
          </button>
        </form>

        <p className="pet-login-hint">
          Chọn đúng vai trò trước khi đăng nhập để vào đúng khu vực làm việc.
        </p>

        <img src={pawMascot} alt="" aria-hidden="true" className="paw-decoration" />
      </div>

      <div className="pet-pos-login-footer">© ThiThiPet Shop — An Ngãi Trung, Vũng Liêm, Vĩnh Long</div>
    </div>
  );
}

export default Login;
