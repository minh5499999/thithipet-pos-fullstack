import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App, { POSDashboard } from './App';
import AdminDashboard from './Admin';
import { notify, confirmAction, NotifyHost } from './notify';

// Backend không chạy khi test -> giả lập fetch trả về danh sách rỗng
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
  );
});

test('màn hình đăng nhập hiển thị đủ thành phần', () => {
  render(<App />);

  expect(screen.getByText('ThiThiPet POS')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'NHÂN VIÊN' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'QUẢN TRỊ VIÊN' })).toBeInTheDocument();
  expect(screen.getByLabelText('Tên đăng nhập')).toBeInTheDocument();
  expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ĐĂNG NHẬP' })).toBeInTheDocument();
});

test('nút chuyển vai trò đổi trạng thái được chọn', () => {
  render(<App />);

  const tabAdmin = screen.getByRole('tab', { name: 'QUẢN TRỊ VIÊN' });
  expect(tabAdmin).toHaveAttribute('aria-selected', 'false');

  fireEvent.click(tabAdmin);
  expect(tabAdmin).toHaveAttribute('aria-selected', 'true');
});

test('nút con mắt bật/tắt hiện mật khẩu', () => {
  render(<App />);

  const passInput = screen.getByLabelText('Mật khẩu');
  expect(passInput).toHaveAttribute('type', 'password');

  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(passInput).toHaveAttribute('type', 'text');
});

test('màn hình POS dựng được với dữ liệu rỗng', async () => {
  await act(async () => {
    render(<POSDashboard onLogout={() => {}} currentUser={{ ho_ten: 'Nguyễn Thị Thi', phan_quyen: 'NhanVien' }} />);
  });

  expect(screen.getByText('🧾 PHIẾU THANH TOÁN')).toBeInTheDocument();
  expect(screen.getByText('Thu ngân: Nguyễn Thị Thi')).toBeInTheDocument();
  expect(screen.getByText('Đang chờ khách ghé thăm...')).toBeInTheDocument();
  // Không có hàng trong giỏ -> nút thanh toán phải bị khóa
  expect(screen.getByRole('button', { name: '💳 THANH TOÁN' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: '🕒 Lịch Sử Bán' }));
  expect(await screen.findByText('Chưa có hóa đơn nào')).toBeInTheDocument();
});

test('bấm thẻ sản phẩm thì thêm được vào hóa đơn và cộng tiền đúng', async () => {
  const products = [
    { id: 1, ten_sp: 'Hạt cho mèo Whiskas', ma_sp: 'SP01', gia_ban: 120000, so_luong: 10, hinh_anh: '' },
    { id: 2, ten_sp: 'Vòng cổ chống ve', ma_sp: 'SP02', gia_ban: 45000, so_luong: 0, hinh_anh: '' },
  ];
  global.fetch = jest.fn((url) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(String(url).includes('/api/products') ? products : []),
    })
  );

  let container;
  await act(async () => {
    ({ container } = render(<POSDashboard onLogout={() => {}} currentUser={{ ho_ten: 'Thu Ngân A' }} />));
  });
  const total = () => container.querySelector('.sum-total-value').textContent;

  // Thẻ hết hàng phải hiện nhãn "Hết hàng"
  expect(screen.getByText('Hết hàng')).toBeInTheDocument();
  expect(screen.getByText('Tồn: 10')).toBeInTheDocument();

  fireEvent.click(screen.getByTitle('Thêm "Hạt cho mèo Whiskas" vào hóa đơn'));
  fireEvent.click(screen.getByTitle('Thêm "Hạt cho mèo Whiskas" vào hóa đơn'));

  // 2 món -> thành tiền 240.000 đ, nút thanh toán mở khóa
  expect(total()).toBe('240.000 đ');
  expect(screen.getByRole('button', { name: '💳 THANH TOÁN' })).toBeEnabled();

  // Giảm 1 rồi xóa khỏi hóa đơn
  fireEvent.click(screen.getByLabelText('Giảm số lượng'));
  expect(total()).toBe('120.000 đ');

  fireEvent.click(screen.getByLabelText('Xóa khỏi hóa đơn'));
  expect(screen.getByText('Đang chờ khách ghé thăm...')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '💳 THANH TOÁN' })).toBeDisabled();
});

test('tìm kiếm lọc đúng danh sách sản phẩm', async () => {
  const products = [
    { id: 1, ten_sp: 'Hạt cho mèo Whiskas', ma_sp: 'SP01', gia_ban: 120000, so_luong: 10, hinh_anh: '' },
    { id: 2, ten_sp: 'Sữa tắm cho chó', ma_sp: 'SP02', gia_ban: 85000, so_luong: 4, hinh_anh: '' },
  ];
  global.fetch = jest.fn((url) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(String(url).includes('/api/products') ? products : []),
    })
  );

  await act(async () => {
    render(<POSDashboard onLogout={() => {}} currentUser={{ ho_ten: 'Thu Ngân A' }} />);
  });

  fireEvent.change(screen.getByLabelText('Tìm kiếm hàng hóa'), { target: { value: 'sữa tắm' } });

  expect(screen.getByText('Sữa tắm cho chó')).toBeInTheDocument();
  expect(screen.queryByText('Hạt cho mèo Whiskas')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Tìm kiếm hàng hóa'), { target: { value: 'không tồn tại' } });
  expect(screen.getByText('Không tìm thấy bé nào cả...')).toBeInTheDocument();
});

test('màn hình Admin dựng được và đổi tiêu đề theo menu', async () => {
  await act(async () => {
    render(<AdminDashboard onLogout={() => {}} currentUser={{ ho_ten: 'Quản Trị', phan_quyen: 'QuanTriVien' }} />);
  });

  expect(screen.getByText('📊 Dashboard Tổng Quan')).toBeInTheDocument();

  await act(async () => { fireEvent.click(screen.getByText('Quản lý nhân viên')); });
  expect(screen.getByText('👥 Quản Lý Nhân Viên')).toBeInTheDocument();
  expect(screen.getByText(/Chưa có tài khoản nào/)).toBeInTheDocument();

  await act(async () => { fireEvent.click(screen.getByText('Quản lý Voucher')); });
  expect(screen.getByText('🎟️ Quản Lý Voucher')).toBeInTheDocument();
  expect(screen.getByText('Chưa có Voucher nào')).toBeInTheDocument();
});

test('toast hiển thị rồi tự đóng được', async () => {
  render(<NotifyHost />);

  act(() => { notify.success('Đã lưu thành công'); });
  expect(await screen.findByText('Đã lưu thành công')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
  await waitFor(() => expect(screen.queryByText('Đã lưu thành công')).not.toBeInTheDocument());
});

test('hộp thoại xác nhận trả về true khi bấm đồng ý', async () => {
  render(<NotifyHost />);

  let answer;
  act(() => { answer = confirmAction({ title: 'Xóa sản phẩm', message: 'Chắc chưa?', confirmText: 'Xóa ngay' }); });

  fireEvent.click(await screen.findByRole('button', { name: 'Xóa ngay' }));
  await expect(answer).resolves.toBe(true);
});

test('hộp thoại xác nhận trả về false khi bấm hủy', async () => {
  render(<NotifyHost />);

  let answer;
  act(() => { answer = confirmAction({ message: 'Chắc chưa?' }); });

  fireEvent.click(await screen.findByRole('button', { name: 'Hủy bỏ' }));
  await expect(answer).resolves.toBe(false);
});
