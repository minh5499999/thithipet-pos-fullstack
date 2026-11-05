import React, { useState, useEffect, useMemo } from 'react';
import './Admin.css';
import logoPetShop from './decorapp/logopetshop-opt.png';
import petDuo from './decorapp/pet-duo.png';
import petSleep from './decorapp/pet-sleep.png';
import petCat from './decorapp/pet-cat.png';
import petVet from './decorapp/pet-vet.png';
import * as XLSX from 'xlsx';
import { notify, confirmAction } from './notify';

const formatMoney = (value) => Number(value || 0).toLocaleString('vi-VN');

// Tiêu đề + mô tả hiển thị trên thanh đầu trang, đổi theo mục đang mở
const PAGE_META = {
  dashboard: { title: '📊 Dashboard Tổng Quan', desc: 'Bức tranh doanh thu và hiệu suất bán hàng' },
  employee: { title: '👥 Quản Lý Nhân Viên', desc: 'Tài khoản đăng nhập và phân quyền hệ thống' },
  product: { title: '📦 Quản Lý Sản Phẩm', desc: 'Kho hàng hóa và danh mục dịch vụ chăm sóc' },
  voucher: { title: '🎟️ Quản Lý Voucher', desc: 'Mã khuyến mãi áp dụng tại quầy thu ngân' },
  history: { title: '🕒 Lịch Sử Giao Dịch', desc: 'Nhật ký hóa đơn đã xuất tại cửa hàng' },
  settings: { title: '⚙️ Cài Đặt Cửa Hàng', desc: 'Thông tin in bill, tài khoản VietQR và báo cáo' },
};

// Dòng "chưa có dữ liệu" kèm hình thú cưng minh họa, dùng lại cho mọi bảng
function EmptyRow({ colSpan, art, title, desc }) {
  return (
    <tr className="table-empty">
      <td colSpan={colSpan}>
        <div className="ui-empty">
          <img src={art} alt="" aria-hidden="true" className="ui-empty__art ui-empty__art--sm" />
          <div className="ui-empty__title">{title}</div>
          {desc && <div className="ui-empty__desc">{desc}</div>}
        </div>
      </td>
    </tr>
  );
}

function AdminDashboard({ onLogout, currentUser }) {
  const [activeMenu, setActiveMenu] = useState('dashboard');

  // ==========================================
  // 1. TRẠNG THÁI QUẢN LÝ NHÂN VIÊN
  // ==========================================
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); 
  const [editingId, setEditingId] = useState(null); 
  
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('NhanVien');
  const [showPassword, setShowPassword] = useState(false); 
  const [showTablePasswords, setShowTablePasswords] = useState({});

  const toggleRowPassword = (rowKey) => {
    setShowTablePasswords((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  // ==========================================
  // 2. TRẠNG THÁI QUẢN LÝ SẢN PHẨM & DỊCH VỤ
  // ==========================================
  const [productSubMenu, setProductSubMenu] = useState('goods'); 
  
  const [products, setProducts] = useState([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productMode, setProductMode] = useState('create');
  const [editingProductId, setEditingProductId] = useState(null);
  
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodCode, setProdCode] = useState('');
  const [prodImagePreview, setProdImagePreview] = useState(''); 
  const [prodImageFile, setProdImageFile] = useState(null);     

  const [services, setServices] = useState([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceMode, setServiceMode] = useState('create');
  const [editingServiceId, setEditingServiceId] = useState(null);
  
  const [svName, setSvName] = useState('');
  const [svPrice, setSvPrice] = useState('');
  const [svCode, setSvCode] = useState('');
  const [svImagePreview, setSvImagePreview] = useState(''); 
  const [svImageFile, setSvImageFile] = useState(null); 

  // ==========================================
  // 2.5. TRẠNG THÁI QUẢN LÝ VOUCHER
  // ==========================================
  const [vouchers, setVouchers] = useState([]); 
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [voucherMode, setVoucherMode] = useState('create');
  const [editingVoucherId, setEditingVoucherId] = useState(null);
  
  const [voucherName, setVoucherName] = useState('');       
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherStartDate, setVoucherStartDate] = useState('');
  const [voucherEndDate, setVoucherEndDate] = useState('');
  const [voucherType, setVoucherType] = useState('discount'); 
  const [voucherValue, setVoucherValue] = useState('');
  const [voucherQuantity, setVoucherQuantity] = useState('');

  // ==========================================
  // 2.8. TRẠNG THÁI LỊCH SỬ BÁN HÀNG
  // ==========================================
  const [orders, setOrders] = useState([]); 
  const [searchHistoryType, setSearchHistoryType] = useState('employee'); 
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null); 
  const [isViewOrderOpen, setIsViewOrderOpen] = useState(false);

  // ==========================================
  // 3. TRẠNG THÁI DASHBOARD 
  // ==========================================
  const [dashboardSummary, setDashboardSummary] = useState({ tong_doanh_thu: 0, tong_don: 0 });
  const [topProductsList, setTopProductsList] = useState([]);
  const [topEmployeesList, setTopEmployeesList] = useState([]);
  const [revenueChartData, setRevenueChartData] = useState([]);

  // ==========================================
  // 3.5. TRẠNG THÁI CÀI ĐẶT CỬA HÀNG
  // ==========================================
  const [storeSettings, setStoreSettings] = useState({
    ten_cua_hang: '',
    dia_chi: '',
    so_dien_thoai: '',
    ten_ngan_hang: '',
    so_tai_khoan: '',
    chu_tai_khoan: '',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ==========================================
  // 4. LẤY DỮ LIỆU TỰ ĐỘNG KHI CHUYỂN TAB
  // ==========================================
  useEffect(() => {
    if (activeMenu === 'employee') fetchEmployees();
    if (activeMenu === 'product') { 
      fetchProducts();
      fetchServices(); 
    }
    if (activeMenu === 'voucher') fetchVouchers(); 
    if (activeMenu === 'history') fetchOrders(); 
    if (activeMenu === 'dashboard') fetchDashboardData(); 
    if (activeMenu === 'settings') fetchSettings();
  }, [activeMenu]);

  // Tải thông tin cửa hàng ngay từ đầu để hóa đơn xem lại ở tab Lịch sử
  // hiển thị đúng tên/địa chỉ thật thay vì chuỗi mặc định cứng trong code
  useEffect(() => { fetchSettings(); }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/users');
      if (response.ok) setEmployees(await response.json());
    } catch (error) { console.error("Lỗi lấy DS nhân viên:", error); }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/products');
      if (response.ok) setProducts(await response.json());
    } catch (error) { console.error("Lỗi lấy DS sản phẩm:", error); }
  };

  const fetchServices = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/services');
      if (response.ok) setServices(await response.json());
    } catch (error) { console.error("Lỗi lấy DS dịch vụ:", error); }
  };

  const fetchVouchers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/vouchers');
      if (response.ok) setVouchers(await response.json());
    } catch (error) { console.error("Lỗi lấy DS voucher:", error); }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/orders');
      if (response.ok) setOrders(await response.json());
    } catch (error) { console.error("Lỗi lấy lịch sử giao dịch:", error); }
  };

  const fetchDashboardData = async () => {
    try {
      const summaryRes = await fetch('http://localhost:5000/api/dashboard/summary');
      if (summaryRes.ok) setDashboardSummary(await summaryRes.json());

      const prodRes = await fetch('http://localhost:5000/api/dashboard/top-products');
      if (prodRes.ok) setTopProductsList(await prodRes.json());

      const empRes = await fetch('http://localhost:5000/api/dashboard/top-employees');
      if (empRes.ok) setTopEmployeesList(await empRes.json());

      const revenueRes = await fetch('http://localhost:5000/api/dashboard/revenue-by-day');
      if (revenueRes.ok) setRevenueChartData(await revenueRes.json());
    } catch (error) { console.error("Lỗi lấy dữ liệu Dashboard:", error); }
  };

  // ==========================================
  // 8. CÁC HÀM XỬ LÝ CÀI ĐẶT CỬA HÀNG
  // ==========================================
  const fetchSettings = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/settings');
      if (response.ok) {
        const data = await response.json();
        setStoreSettings(prev => ({ ...prev, ...data }));
      }
    } catch (error) { console.error("Lỗi lấy cài đặt cửa hàng:", error); }
  };

  const handleSettingsChange = (field, value) => {
    setStoreSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      // Vẫn dùng FormData để tương thích 100% với Backend cũ (server.js) của bạn
      const formData = new FormData();
      formData.append('ten_cua_hang', storeSettings.ten_cua_hang || '');
      formData.append('dia_chi', storeSettings.dia_chi || '');
      formData.append('so_dien_thoai', storeSettings.so_dien_thoai || '');
      formData.append('ten_ngan_hang', storeSettings.ten_ngan_hang || '');
      formData.append('so_tai_khoan', storeSettings.so_tai_khoan || '');
      formData.append('chu_tai_khoan', storeSettings.chu_tai_khoan || '');
      formData.append('qr_cu', ''); // Gửi chuỗi rỗng để xóa link ảnh tĩnh cũ trên Database

      const response = await fetch('http://localhost:5000/api/settings', { method: 'PUT', body: formData });
      const data = await response.json();

      if (response.ok) {
        notify.success('Đã lưu cài đặt cửa hàng thành công!');
        fetchSettings();
      } else { notify.error(`Lỗi: ${data.error}`); }
    } catch (error) {
      notify.error('Lỗi kết nối Backend!');
    } finally { setIsSavingSettings(false); }
  };

  // ==========================================
  // 9. CÁC HÀM XUẤT BÁO CÁO EXCEL DOANH THU
  // ==========================================
  const fetchOrdersForExport = async () => {
    const response = await fetch('http://localhost:5000/api/orders');
    if (!response.ok) throw new Error('Không tải được dữ liệu đơn hàng từ server');
    return await response.json();
  };

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const buildRevenueWorkbook = (ordersList, sheetName) => {
    const rows = ordersList.map((o, idx) => ({
      'STT': idx + 1,
      'Mã đơn': o.ma_don || '',
      'Thời gian': o.ngay_ban ? new Date(o.ngay_ban).toLocaleString('vi-VN') : '',
      'Nhân viên': o.ten_nhan_vien || '',
      'Số lượng SP': o.danh_sach_sp?.reduce((sum, sp) => sum + (Number(sp.so_luong_ban) || 0), 0) || 0,
      'Tổng tiền (đ)': Number(o.tong_tien) || 0,
    }));

    const tongDoanhThu = rows.reduce((sum, r) => sum + r['Tổng tiền (đ)'], 0);
    rows.push({});
    rows.push({ 'Nhân viên': 'TỔNG DOANH THU', 'Tổng tiền (đ)': tongDoanhThu });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 16 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return wb;
  };

  const handleExportDailyRevenue = async () => {
    setIsExporting(true);
    try {
      const allOrders = await fetchOrdersForExport();
      const today = new Date();
      const todayOrders = allOrders.filter(o => o.ngay_ban && isSameDay(new Date(o.ngay_ban), today));

      if (todayOrders.length === 0) { notify.info('Chưa có đơn hàng nào trong hôm nay.'); return; }

      const wb = buildRevenueWorkbook(todayOrders, 'Doanh thu ngày');
      const tenFile = `DoanhThu_Ngay_${today.toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(wb, tenFile);
      notify.success(`Đã xuất ${todayOrders.length} đơn hàng ra file Excel.`);
    } catch (error) {
      notify.error(`Lỗi xuất file: ${error.message}`);
    } finally { setIsExporting(false); }
  };

  const handleExportWeeklyRevenue = async () => {
    setIsExporting(true);
    try {
      const allOrders = await fetchOrdersForExport();
      const now = new Date();
      const startOfWeek = getStartOfWeek(now);
      const weekOrders = allOrders.filter(o => o.ngay_ban && new Date(o.ngay_ban) >= startOfWeek);

      if (weekOrders.length === 0) { notify.info('Chưa có đơn hàng nào trong tuần này.'); return; }

      const wb = buildRevenueWorkbook(weekOrders, 'Doanh thu tuần');
      const tenFile = `DoanhThu_Tuan_${startOfWeek.toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(wb, tenFile);
      notify.success(`Đã xuất ${weekOrders.length} đơn hàng ra file Excel.`);
    } catch (error) {
      notify.error(`Lỗi xuất file: ${error.message}`);
    } finally { setIsExporting(false); }
  };

  // ==========================================
  // 5. CÁC HÀM XỬ LÝ NHÂN VIÊN
  // ==========================================
  const handleSubmitAccount = async (e) => {
    e.preventDefault();
    try {
      const url = modalMode === 'create' ? 'http://localhost:5000/api/users' : `http://localhost:5000/api/users/${editingId}`; 
      const method = modalMode === 'create' ? 'POST' : 'PUT';
      const payload = { ho_ten: fullName, phan_quyen: role === 'Admin' ? 'QuanTriVien' : 'NhanVien' };
      
      if (modalMode === 'create') {
        payload.username = username; payload.password = password;
      } else if (password) {
        payload.password = password; 
      }

      const response = await fetch(url, {
        method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await response.json();
      
      if (response.ok) {
        notify.success(modalMode === 'create' ? 'Đã thêm tài khoản mới!' : 'Cập nhật tài khoản thành công!');
        setIsModalOpen(false); fetchEmployees();
      } else { notify.error(`Lỗi: ${data.error}`); }
    } catch (error) { notify.error('Lỗi kết nối Backend!'); }
  };

  const openEditModal = (emp) => {
    setModalMode('edit'); setEditingId(emp.stt); setFullName(emp.ho_ten);
    setUsername(emp.username); setRole(emp.phan_quyen === 'QuanTriVien' ? 'Admin' : 'NhanVien');
    setPassword(''); setShowPassword(false); setIsModalOpen(true);
  };

  const handleDelete = async (stt, name) => {
    const agreed = await confirmAction({
      title: 'Xóa tài khoản nhân sự',
      message: `Tài khoản của "${name}" sẽ bị xóa vĩnh viễn khỏi hệ thống. Bạn chắc chắn chứ?`,
      confirmText: 'Xóa tài khoản',
    });
    if (!agreed) return;

    try {
      const response = await fetch(`http://localhost:5000/api/users/${stt}`, { method: 'DELETE' });
      if (response.ok) { notify.success(`Đã xóa tài khoản của ${name}.`); fetchEmployees(); }
      else { notify.error('Không thể xóa tài khoản này!'); }
    } catch (error) { notify.error('Lỗi kết nối Backend!'); }
  };
  
  const openCreateModal = () => {
    setModalMode('create'); setFullName(''); setUsername(''); setPassword(''); setRole('NhanVien'); setShowPassword(false); setIsModalOpen(true);
  };

  // ==========================================
  // 6. CÁC HÀM XỬ LÝ SẢN PHẨM & ẢNH
  // ==========================================
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProdImageFile(file); 
      const reader = new FileReader();
      reader.onloadend = () => { setProdImagePreview(reader.result); };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    if (Number(prodPrice) < 0) { notify.warning('Giá bán không được nhỏ hơn 0!'); return; }
    if (Number(prodStock) < 0) { notify.warning('Tồn kho không được nhỏ hơn 0!'); return; }
    try {
      const url = productMode === 'create' ? 'http://localhost:5000/api/products' : `http://localhost:5000/api/products/${editingProductId}`;
      const method = productMode === 'create' ? 'POST' : 'PUT';
      
      const formData = new FormData();
      formData.append('ten_sp', prodName);
      formData.append('gia_ban', Number(prodPrice));
      formData.append('so_luong', Number(prodStock));
      formData.append('ma_sp', prodCode);
      
      if (prodImageFile) {
        formData.append('hinh_anh_file', prodImageFile); 
      } else if (productMode === 'edit') {
        formData.append('hinh_anh_cu', prodImagePreview); 
      }

      const response = await fetch(url, { method: method, body: formData });
      const data = await response.json();
      if (response.ok) {
        notify.success(productMode === 'create' ? 'Đã thêm sản phẩm vào kho!' : 'Cập nhật sản phẩm thành công!');
        setIsProductModalOpen(false); fetchProducts();
      } else { notify.error(`Lỗi: ${data.error}`); }
    } catch (error) { notify.error('Lỗi kết nối Backend!'); }
  };

  const openEditProductModal = (prod) => {
    setProductMode('edit'); setEditingProductId(prod.id);
    setProdName(prod.ten_sp); setProdPrice(prod.gia_ban); setProdStock(prod.so_luong); setProdCode(prod.ma_sp);
    setProdImagePreview(prod.hinh_anh || ''); setProdImageFile(null); setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (id, name) => {
    const agreed = await confirmAction({
      title: 'Xóa sản phẩm khỏi kho',
      message: `Sản phẩm "${name}" sẽ bị gỡ khỏi danh mục kho hàng. Bạn chắc chắn chứ?`,
      confirmText: 'Xóa sản phẩm',
      icon: '📦',
    });
    if (!agreed) return;

    try {
      const response = await fetch(`http://localhost:5000/api/products/${id}`, { method: 'DELETE' });
      if (response.ok) { notify.success(`Đã xóa sản phẩm "${name}".`); fetchProducts(); }
      else { notify.error('Không thể xóa sản phẩm này!'); }
    } catch (error) { notify.error('Lỗi kết nối Backend!'); }
  };

  const openCreateProductModal = () => {
    setProductMode('create'); setProdName(''); setProdPrice(''); setProdStock(''); setProdCode(''); setProdImagePreview(''); setProdImageFile(null);
    setIsProductModalOpen(true);
  };

  // ==========================================
  // 6.5. CÁC HÀM XỬ LÝ DỊCH VỤ (SERVICES)
  // ==========================================
  const handleImageUploadService = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSvImageFile(file); 
      const reader = new FileReader();
      reader.onloadend = () => { setSvImagePreview(reader.result); };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitService = async (e) => {
    e.preventDefault();
    try {
      const url = serviceMode === 'create' ? 'http://localhost:5000/api/services' : `http://localhost:5000/api/services/${editingServiceId}`;
      const method = serviceMode === 'create' ? 'POST' : 'PUT';
      
      const formData = new FormData();
      formData.append('ten_dv', svName);
      formData.append('gia_dv', Number(svPrice));
      formData.append('ma_dv', svCode);
      
      if (svImageFile) {
        formData.append('hinh_anh_file', svImageFile); 
      } else if (serviceMode === 'edit') {
        formData.append('hinh_anh_cu', svImagePreview); 
      }

      const response = await fetch(url, { method: method, body: formData });
      const data = await response.json();
      if (response.ok) {
        notify.success(serviceMode === 'create' ? 'Đã thêm dịch vụ thành công!' : 'Cập nhật dịch vụ thành công!');
        setIsServiceModalOpen(false); fetchServices();
      } else { notify.error(`Lỗi: ${data.error}`); }
    } catch (error) { notify.error('Lỗi kết nối Backend!'); }
  };

  const openEditServiceModal = (sv) => {
    setServiceMode('edit'); setEditingServiceId(sv.id);
    setSvName(sv.ten_dv); setSvPrice(sv.gia_dv); setSvCode(sv.ma_dv);
    setSvImagePreview(sv.hinh_anh || ''); setSvImageFile(null); setIsServiceModalOpen(true);
  };

  const handleDeleteService = async (id, name) => {
    const agreed = await confirmAction({
      title: 'Xóa dịch vụ',
      message: `Dịch vụ "${name}" sẽ bị gỡ khỏi danh mục. Bạn chắc chắn chứ?`,
      confirmText: 'Xóa dịch vụ',
      icon: '✂️',
    });
    if (!agreed) return;

    try {
      const response = await fetch(`http://localhost:5000/api/services/${id}`, { method: 'DELETE' });
      if (response.ok) { notify.success(`Đã xóa dịch vụ "${name}".`); fetchServices(); }
      else { notify.error('Không thể xóa dịch vụ này!'); }
    } catch (error) { notify.error('Lỗi kết nối Backend!'); }
  };

  const openCreateServiceModal = () => {
    setServiceMode('create'); setSvName(''); setSvPrice(''); setSvCode(''); setSvImagePreview(''); setSvImageFile(null);
    setIsServiceModalOpen(true);
  };

  // ==========================================
  // 7. CÁC HÀM XỬ LÝ VOUCHER
  // ==========================================
  const handleRandomVoucherCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
    setVoucherCode(result);
    notify.info(`Đã tạo mã ngẫu nhiên: ${result}`, 2200);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const cleanDate = dateString.split('T')[0]; 
    const [year, month, day] = cleanDate.split('-');
    return `${day}/${month}/${year}`;
  };

  const openCreateVoucherModal = () => {
    setVoucherMode('create'); setVoucherName(''); setVoucherCode(''); setVoucherStartDate(''); setVoucherEndDate(''); setVoucherType('discount'); setVoucherValue(''); setVoucherQuantity('');
    setIsVoucherModalOpen(true);
  };

  const openEditVoucherModal = (vc) => {
    setVoucherMode('edit'); setEditingVoucherId(vc.id); setVoucherName(vc.ten_chuong_trinh || ''); setVoucherCode(vc.ma_voucher); 
    setVoucherStartDate(vc.ngay_bat_dau.split('T')[0]); setVoucherEndDate(vc.ngay_het_han.split('T')[0]); setVoucherType(vc.loai_thuong); setVoucherValue(vc.gia_tri_thuong); setVoucherQuantity(vc.so_luong || '');
    setIsVoucherModalOpen(true);
  };

  const handleDeleteVoucher = async (id, code) => {
    const agreed = await confirmAction({
      title: 'Xóa mã khuyến mãi',
      message: `Voucher "${code}" sẽ không còn dùng được tại quầy thu ngân nữa. Bạn chắc chắn chứ?`,
      confirmText: 'Xóa Voucher',
      icon: '🎟️',
    });
    if (!agreed) return;

    try {
      const response = await fetch(`http://localhost:5000/api/vouchers/${id}`, { method: 'DELETE' });
      if (response.ok) { notify.success(`Đã xóa Voucher "${code}".`); fetchVouchers(); }
      else { notify.error('Không thể xóa Voucher này!'); }
    } catch (error) { notify.error('Lỗi kết nối Backend!'); }
  };

  const handleSubmitVoucher = async (e) => {
    e.preventDefault();
    try {
      const url = voucherMode === 'create' ? 'http://localhost:5000/api/vouchers' : `http://localhost:5000/api/vouchers/${editingVoucherId}`;
      const method = voucherMode === 'create' ? 'POST' : 'PUT';
      
      const payload = { ten_chuong_trinh: voucherName, ma_voucher: voucherCode, ngay_bat_dau: voucherStartDate, ngay_het_han: voucherEndDate, loai_thuong: voucherType, gia_tri_thuong: voucherValue, so_luong: Number(voucherQuantity) };
      const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (response.ok) {
        notify.success(voucherMode === 'create' ? 'Đã tạo Voucher mới!' : 'Cập nhật Voucher thành công!');
        setIsVoucherModalOpen(false);
        fetchVouchers();
      } else {
        const data = await response.json().catch(() => ({}));
        notify.error(`Lỗi: ${data.error || 'Không lưu được Voucher.'}`);
      }
    } catch (error) { notify.error('Lỗi kết nối Backend!'); }
  };

  // ==========================================
  // 7.5. CÁC HÀM XỬ LÝ ĐƠN HÀNG (LỊCH SỬ BÁN HÀNG)
  // ==========================================
  const handleOpenViewOrder = (order) => {
    setSelectedOrder(order);
    setIsViewOrderOpen(true);
  };

  const handleDeleteOrder = async (id, code) => {
    const agreed = await confirmAction({
      title: 'Hủy hóa đơn',
      message: `Hóa đơn "${code}" sẽ bị xóa khỏi hệ thống và số lượng hàng đã bán sẽ được hoàn ngược lại kho. Bạn chắc chắn chứ?`,
      confirmText: 'Xóa hóa đơn',
      icon: '🧾',
    });
    if (!agreed) return;

    try {
      const response = await fetch(`http://localhost:5000/api/orders/${id}`, { method: 'DELETE' });
      if (response.ok) { notify.success(`Đã xóa hóa đơn "${code}" và hoàn kho.`); fetchOrders(); }
      else { notify.error('Không thể xóa hóa đơn này!'); }
    } catch (error) { notify.error('Lỗi kết nối Backend!'); }
  };

  // ==========================================
  // 7.8. DỮ LIỆU DẪN XUẤT (tính sẵn, tránh tính lại mỗi lần gõ phím)
  // ==========================================

  // Gom số liệu bán ra theo từng mã sản phẩm. Trước đây hàm này chạy lại
  // ở mỗi lần render (kể cả khi chỉ gõ 1 ký tự trong ô tìm kiếm) — nay chỉ
  // tính lại khi danh sách đơn hàng hoặc kho hàng thực sự thay đổi.
  const productSalesList = useMemo(() => {
    const stockByCode = new Map(products.map((p) => [p.ma_sp, p.so_luong]));
    const productMap = new Map();

    orders.forEach((order) => {
      if (!order.danh_sach_sp) return;
      order.danh_sach_sp.forEach((item) => {
        if (!item.ma_sp) return;

        if (!productMap.has(item.ma_sp)) {
          productMap.set(item.ma_sp, {
            ten_san_pham: item.ten_san_pham,
            ma_sp: item.ma_sp,
            so_luong_ban: 0,
            so_luong_ton: stockByCode.get(item.ma_sp) || 0,
            orders_linked: [],
          });
        }

        const entry = productMap.get(item.ma_sp);
        entry.so_luong_ban += Number(item.so_luong_ban);
        if (!entry.orders_linked.includes(order)) entry.orders_linked.push(order);
      });
    });

    return Array.from(productMap.values());
  }, [orders, products]);

  const historyKeyword = historySearchQuery.trim().toLowerCase();

  const filteredOrders = useMemo(() => {
    if (!historyKeyword) return orders;
    return orders.filter((order) =>
      order.ten_nhan_vien?.toLowerCase().includes(historyKeyword) ||
      order.ma_don?.toLowerCase().includes(historyKeyword)
    );
  }, [orders, historyKeyword]);

  const filteredProductSales = useMemo(() => {
    if (!historyKeyword) return productSalesList;
    return productSalesList.filter((item) =>
      item.ten_san_pham?.toLowerCase().includes(historyKeyword) ||
      item.ma_sp?.toLowerCase().includes(historyKeyword)
    );
  }, [productSalesList, historyKeyword]);

  const pageMeta = PAGE_META[activeMenu] || PAGE_META.dashboard;


  return (
    <div className="admin-layout">
      {/* 🧭 THANH ĐIỀU HƯỚNG BÊN TRÁI (SIDEBAR) */}
      <div className="admin-sidebar">
        <div className="admin-logo-zone">
          <img src={logoPetShop} alt="ThiThiPet Logo" className="admin-logo-img" />
        </div>

        <ul className="admin-nav-menu">
          <li className={activeMenu === 'dashboard' ? 'active-nav' : ''} onClick={() => setActiveMenu('dashboard')}>
            <span className="nav-icon">📊</span> Dashboard Tổng
          </li>
          <li className={activeMenu === 'employee' ? 'active-nav' : ''} onClick={() => setActiveMenu('employee')}>
            <span className="nav-icon">👥</span> Quản lý nhân viên
          </li>
          <li className={activeMenu === 'product' ? 'active-nav' : ''} onClick={() => setActiveMenu('product')}>
            <span className="nav-icon">📦</span> Quản lý sản phẩm
          </li>
          <li className={activeMenu === 'voucher' ? 'active-nav' : ''} onClick={() => setActiveMenu('voucher')}>
            <span className="nav-icon">🎟️</span> Quản lý Voucher
          </li>
          <li className={activeMenu === 'history' ? 'active-nav' : ''} onClick={() => setActiveMenu('history')}>
            <span className="nav-icon">🕒</span> Lịch sử giao dịch
          </li>
          <li className={activeMenu === 'settings' ? 'active-nav' : ''} onClick={() => setActiveMenu('settings')}>
            <span className="nav-icon">⚙️</span> Cài đặt
          </li>
        </ul>

        <div className="admin-sidebar__foot">
          <img src={petSleep} alt="" aria-hidden="true" className="admin-sidebar__pet" />
          ThiThiPet POS · Phiên bản 1.0
        </div>
      </div>

      {/* 💻 KHU VỰC HIỂN THỊ CHÍNH BÊN PHẢI */}
      <div className="admin-main-area">
        
        {/* HEADER TOPBAR */}
        <div className="admin-header">
          <div className="admin-page-title">
            <h1>{pageMeta.title}</h1>
            <span>{pageMeta.desc}</span>
          </div>

          <div className="header-profile">
            <div className="profile-info">
              <div className="avatar" aria-hidden="true">👩‍💻</div>
              <div className="user-details">
                <span className="user-name">{currentUser?.ho_ten || 'Admin Anna'}</span>
                <span className="user-role">Quản Trị Viên</span>
              </div>
            </div>
            <button type="button" onClick={onLogout} className="btn-logout-header">🚪 Thoát</button>
          </div>
        </div>

        {/* NỘI DUNG THAY ĐỔI THEO MENU */}
        <div className="admin-content-wrapper">
          
          {/* MÀN HÌNH 1: DASHBOARD TỔNG QUAN */}
          {activeMenu === 'dashboard' && (
            <div className="dashboard-grid fade-in">
              <div className="dashboard-left-col">
                <div className="welcome-banner">
                  <div className="welcome-banner__text">
                    <p className="welcome-banner__hello">Chào mừng trở lại 🐾</p>
                    <h2 className="welcome-banner__name">{currentUser?.ho_ten || 'Quản trị viên'}</h2>
                    <p className="welcome-banner__sub">
                      Hôm nay cửa hàng đã có <strong>{dashboardSummary.tong_don || 0}</strong> đơn hàng.
                      Chúc bạn một ngày buôn may bán đắt!
                    </p>
                  </div>
                  <img src={petDuo} alt="" aria-hidden="true" className="welcome-banner__pet" />
                </div>

                <div className="kpi-banner-row">
                  <div className="kpi-card highlight-cam">
                    <div className="kpi-text">
                      <h4>Tổng doanh thu</h4>
                      <h2>{formatMoney(dashboardSummary.tong_doanh_thu)} đ</h2>
                    </div>
                    <div className="kpi-icon-large">💰</div>
                  </div>
                  <div className="kpi-card highlight-teal">
                    <div className="kpi-text">
                      <h4>Đơn hàng hoàn tất</h4>
                      <h2>{dashboardSummary.tong_don || 0} Đơn</h2>
                    </div>
                    <div className="kpi-icon-large">🧾</div>
                  </div>
                </div>
                <div className="chart-container">
                  <div className="chart-header">
                    <h3>📈 Biểu Đồ Doanh Thu Tổng Quan</h3>
                  </div>
                  <div className="mock-chart-area">
                    {revenueChartData.length === 0 && (
                      <div className="chart-empty">Chưa có dữ liệu doanh thu để vẽ biểu đồ.</div>
                    )}
                    {revenueChartData.length > 0 && (() => {
                      const maxRevenue = Math.max(...revenueChartData.map(d => Number(d.doanh_thu) || 0), 1);
                      return revenueChartData.map((item, index) => {
                        const isToday = index === revenueChartData.length - 1;
                        const heightPercent = ((Number(item.doanh_thu) || 0) / maxRevenue) * 100;
                        return (
                          <div
                            className="bar-group"
                            key={item.ngay}
                            title={`${item.label}: ${formatMoney(item.doanh_thu)} đ`}
                          >
                            <div
                              className={`bar ${isToday ? 'fill-cam' : 'fill-teal'}`}
                              style={{ height: `${heightPercent}%` }}
                            ></div>
                            <span>{item.label}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              <div className="dashboard-right-col">
                <div className="ranking-table-box mb-20">
                  <h3 className="ranking-title">🏆 Top Sản Phẩm Bán Chạy</h3>
                  <div className="table-scroll-wrap">
                    <table className="ranking-table">
                      <thead>
                        <tr><th width="15%">STT</th><th width="50%">Tên SP</th><th width="35%" className="text-right">Doanh thu</th></tr>
                      </thead>
                      <tbody>
                        {topProductsList.map((item, index) => (
                          <tr key={index}>
                            <td className="rank-num">#{index + 1}</td>
                            <td className="rank-name">{item.name}</td>
                            <td className="rank-money text-right">{formatMoney(item.revenue)} đ</td>
                          </tr>
                        ))}
                        {topProductsList.length === 0 && (
                          <tr className="table-empty"><td colSpan="3">Chưa có dữ liệu bán hàng.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="ranking-table-box">
                  <h3 className="ranking-title">🎖️ Top Nhân Viên Xuất Sắc</h3>
                  <div className="table-scroll-wrap">
                    <table className="ranking-table">
                      <thead>
                        <tr><th width="15%">STT</th><th width="50%">Tên NV</th><th width="35%" className="text-right">Doanh thu</th></tr>
                      </thead>
                      <tbody>
                        {topEmployeesList.map((item, index) => (
                          <tr key={index}>
                            <td className="rank-num">#{index + 1}</td>
                            <td className="rank-name">👤 {item.name}</td>
                            <td className="rank-money text-right color-cam">{formatMoney(item.revenue)} đ</td>
                          </tr>
                        ))}
                        {topEmployeesList.length === 0 && (
                          <tr className="table-empty"><td colSpan="3">Chưa có dữ liệu bán hàng.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MÀN HÌNH 2: QUẢN LÝ NHÂN VIÊN */}
          {activeMenu === 'employee' && (
            <div className="fade-in">
              <div className="emp-header">
                <h2>Danh Sách Tài Khoản Nhân Sự</h2>
                <button type="button" className="btn-add-account" onClick={openCreateModal}>
                  <span className="btn-add-account__plus">+</span> Thêm Tài Khoản
                </button>
              </div>

              <div className="ranking-table-box ranking-table-box--auto">
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Họ và Tên</th>
                      <th>Tên Đăng Nhập</th>
                      <th>Mật Khẩu</th>
                      <th>Quyền Hệ Thống</th>
                      <th>Ngày Tạo</th>
                      <th className="text-center">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 && (
                      <EmptyRow
                        colSpan="7"
                        art={petCat}
                        title="Chưa có tài khoản nào"
                        desc='Bấm nút "Thêm Tài Khoản" ở góc trên để tạo tài khoản đầu tiên.'
                      />
                    )}
                    {employees.map((emp, index) => {
                      const rowKey = emp.stt ?? index;
                      const isPasswordVisible = Boolean(showTablePasswords[rowKey]);

                      return (
                        <tr key={rowKey}>
                          <td className="rank-num">{index + 1}</td>
                          <td className="rank-name">{emp.ho_ten}</td>
                          <td><code>{emp.username}</code></td>
                          <td>
                            <div className="pass-cell">
                              <span className={isPasswordVisible ? 'pass-plain' : 'pass-dots'}>
                                {isPasswordVisible ? (emp.pass || emp.password || 'Trống') : '••••••'}
                              </span>
                              <button
                                type="button"
                                className="btn-eye-inline"
                                onClick={() => toggleRowPassword(rowKey)}
                                title={isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                aria-label={isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                              >
                                {isPasswordVisible ? '🙈' : '👁️'}
                              </button>
                            </div>
                          </td>
                          <td>
                            <span className={`emp-role ${emp.phan_quyen === 'QuanTriVien' ? 'role-admin' : 'role-staff'}`}>
                              {emp.phan_quyen === 'QuanTriVien' ? 'Quản Trị' : 'Nhân Viên'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--ink-300)' }}>
                            {emp.ngay_them ? new Date(emp.ngay_them).toLocaleDateString('vi-VN') : '---'}
                          </td>
                          <td className="text-center">
                            <div className="action-buttons">
                              <button type="button" className="btn-edit" onClick={() => openEditModal(emp)}>✏️ Sửa</button>
                              <button type="button" className="btn-delete" onClick={() => handleDelete(emp.stt, emp.ho_ten)}>🗑️ Xóa</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MÀN HÌNH 3: QUẢN LÝ SẢN PHẨM & DỊCH VỤ */}
          {activeMenu === 'product' && (
            <div className="fade-in">
              <div className="emp-header">
                <h2>{productSubMenu === 'goods' ? 'Quản Lý Danh Mục Kho Hàng' : 'Quản Lý Danh Mục Dịch Vụ'}</h2>
                <div className="role-toggle role-toggle--inline">
                  <button type="button" className={`toggle-btn ${productSubMenu === 'goods' ? 'active-teal' : ''}`} onClick={() => setProductSubMenu('goods')}>
                    📦 Kho Hàng
                  </button>
                  <button type="button" className={`toggle-btn ${productSubMenu === 'services' ? 'active-cam' : ''}`} onClick={() => setProductSubMenu('services')}>
                    ✂️ Dịch Vụ
                  </button>
                </div>
              </div>

              {/* VIEW 1: KHO HÀNG (SẢN PHẨM) */}
              {productSubMenu === 'goods' ? (
                <>
                  <div className="product-grid-container mb-20">
                    {products.map((prod) => (
                      <div className="product-card" key={prod.id}>
                        <div className="product-img-box">
                          <img
                            src={prod.hinh_anh || logoPetShop}
                            alt={prod.ten_sp}
                            loading="lazy"
                            decoding="async"
                            style={{ objectFit: prod.hinh_anh ? 'cover' : 'contain' }}
                          />
                          <div className="product-card-actions">
                            <button type="button" className="btn-icon edit" onClick={() => openEditProductModal(prod)} title="Sửa sản phẩm" aria-label="Sửa sản phẩm">✏️</button>
                            <button type="button" className="btn-icon delete" onClick={() => handleDeleteProduct(prod.id, prod.ten_sp)} title="Xóa sản phẩm" aria-label="Xóa sản phẩm">🗑️</button>
                          </div>
                        </div>
                        <div className="product-info">
                          <p className="p-name" title={prod.ten_sp}>{prod.ten_sp}</p>
                          <p className="p-price">{formatMoney(prod.gia_ban)} đ</p>
                          <p className="p-stock">
                            {prod.so_luong > 0
                              ? <>Tồn kho: <strong>{prod.so_luong}</strong></>
                              : <span style={{ color: 'var(--danger-500)', fontWeight: 700 }}>Đã hết hàng</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="product-card add-new-card" onClick={openCreateProductModal}>
                      <div className="add-icon-circle">+</div>
                      <p>Thêm SP</p>
                    </div>
                  </div>

                  <div className="ranking-table-box ranking-table-box--auto">
                    <h3 className="ranking-title">List danh sách Sản phẩm</h3>
                    <table className="ranking-table">
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Tên SP</th>
                          <th>Giá bán</th>
                          <th>Số lượng</th>
                          <th>Mã SP</th>
                          <th className="text-center">Hành Động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.length === 0 && (
                          <EmptyRow
                            colSpan="6"
                            art={petSleep}
                            title="Kho hàng đang trống"
                            desc='Bấm thẻ "Thêm SP" phía trên để nhập lô hàng đầu tiên nhé!'
                          />
                        )}
                        {products.map((prod, index) => (
                          <tr key={prod.id}>
                            <td className="rank-num text-bold">{index + 1}</td>
                            <td className="rank-name">{prod.ten_sp}</td>
                            <td className="color-cam text-bold">{formatMoney(prod.gia_ban)} đ</td>
                            <td>
                              <span className={`ui-badge ${prod.so_luong > 5 ? 'ui-badge--success' : (prod.so_luong > 0 ? 'ui-badge--accent' : 'ui-badge--danger')}`}>
                                {prod.so_luong > 0 ? `${prod.so_luong} cái` : 'Hết hàng'}
                              </span>
                            </td>
                            <td><code>{prod.ma_sp}</code></td>
                            <td className="text-center">
                               <div className="action-buttons">
                                 <button type="button" className="btn-edit" onClick={() => openEditProductModal(prod)}>✏️ Sửa</button>
                                 <button type="button" className="btn-delete" onClick={() => handleDeleteProduct(prod.id, prod.ten_sp)}>🗑️ Xóa</button>
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                /* VIEW 2: DỊCH VỤ CHĂM SÓC */
                <>
                  <div className="product-grid-container mb-20">
                    {services.map((sv) => (
                      <div className="product-card" key={sv.id}>
                        <div className="product-img-box">
                          <img
                            src={sv.hinh_anh || logoPetShop}
                            alt={sv.ten_dv}
                            loading="lazy"
                            decoding="async"
                            style={{ objectFit: sv.hinh_anh ? 'cover' : 'contain' }}
                          />
                          <div className="product-card-actions">
                            <button type="button" className="btn-icon edit" onClick={() => openEditServiceModal(sv)} title="Sửa dịch vụ" aria-label="Sửa dịch vụ">✏️</button>
                            <button type="button" className="btn-icon delete" onClick={() => handleDeleteService(sv.id, sv.ten_dv)} title="Xóa dịch vụ" aria-label="Xóa dịch vụ">🗑️</button>
                          </div>
                        </div>
                        <div className="product-info">
                          <p className="p-name" title={sv.ten_dv}>{sv.ten_dv}</p>
                          <p className="p-price">{formatMoney(sv.gia_dv)} đ</p>
                          <p className="p-stock" style={{ color: 'var(--success-600)', fontWeight: 700 }}>✨ Gói Dịch Vụ</p>
                        </div>
                      </div>
                    ))}
                    <div className="product-card add-new-card" onClick={openCreateServiceModal}>
                      <div className="add-icon-circle">+</div>
                      <p>Thêm Dịch Vụ</p>
                    </div>
                  </div>

                  <div className="ranking-table-box ranking-table-box--auto">
                    <h3 className="ranking-title">List danh sách Dịch vụ</h3>
                    <table className="ranking-table">
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Tên Dịch Vụ</th>
                          <th>Phí Dịch Vụ</th>
                          <th>Mã DV</th>
                          <th className="text-center">Hành Động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.length === 0 && (
                          <EmptyRow
                            colSpan="5"
                            art={petVet}
                            title="Chưa có dịch vụ nào"
                            desc='Bấm thẻ "Thêm Dịch Vụ" phía trên để tạo gói chăm sóc đầu tiên.'
                          />
                        )}
                        {services.map((sv, index) => (
                          <tr key={sv.id}>
                            <td className="rank-num text-bold">{index + 1}</td>
                            <td className="rank-name">{sv.ten_dv}</td>
                            <td className="color-cam text-bold">{formatMoney(sv.gia_dv)} đ</td>
                            <td><code>{sv.ma_dv}</code></td>
                            <td className="text-center">
                               <div className="action-buttons">
                                 <button type="button" className="btn-edit" onClick={() => openEditServiceModal(sv)}>✏️ Sửa</button>
                                 <button type="button" className="btn-delete" onClick={() => handleDeleteService(sv.id, sv.ten_dv)}>🗑️ Xóa</button>
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* MÀN HÌNH 4: QUẢN LÝ VOUCHER */}
          {activeMenu === 'voucher' && (
            <div className="fade-in">
              <div className="emp-header">
                <h2>Danh Sách Mã Khuyến Mãi (Voucher)</h2>
                <button type="button" className="btn-add-account" onClick={openCreateVoucherModal}>
                  <span className="btn-add-account__plus">+</span> Thêm Voucher
                </button>
              </div>

              <div className="ranking-table-box ranking-table-box--auto">
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên Chương Trình</th>
                      <th>Mã Voucher</th>
                      <th>Thời gian áp dụng</th>
                      <th>Thưởng</th>
                      <th>Số lượng</th>
                      <th className="text-center">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.length === 0 && (
                      <EmptyRow
                        colSpan="7"
                        art={petCat}
                        title="Chưa có Voucher nào"
                        desc="Tạo mã khuyến mãi để nhân viên áp dụng ngay tại quầy thu ngân."
                      />
                    )}
                    {vouchers.map((vc, index) => {
                      const isExpired = vc.ngay_het_han && new Date(vc.ngay_het_han) < new Date();
                      const isSoldOut = Number(vc.so_luong) <= 0;

                      return (
                        <tr key={vc.id}>
                          <td className="rank-num">{index + 1}</td>
                          <td className="rank-name">{vc.ten_chuong_trinh || '---'}</td>
                          <td><code style={{ fontSize: '14px', color: 'var(--accent-700)', fontWeight: 700 }}>{vc.ma_voucher}</code></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {formatDate(vc.ngay_bat_dau)} → {formatDate(vc.ngay_het_han)}
                            {isExpired && <div><span className="ui-badge ui-badge--danger" style={{ marginTop: '4px' }}>Đã hết hạn</span></div>}
                          </td>
                          <td>
                            {vc.loai_thuong === 'discount'
                              ? <span className="ui-badge ui-badge--danger">Giảm {formatMoney(vc.gia_tri_thuong)} đ</span>
                              : <span className="ui-badge ui-badge--success">🎁 {vc.gia_tri_thuong}</span>}
                          </td>
                          <td>
                            <span className={`ui-badge ${isSoldOut ? 'ui-badge--muted' : 'ui-badge--brand'}`}>
                              {vc.so_luong !== undefined ? (isSoldOut ? 'Hết lượt' : `Còn ${vc.so_luong}`) : '---'}
                            </span>
                          </td>
                          <td className="text-center">
                             <div className="action-buttons">
                               <button type="button" className="btn-edit" onClick={() => openEditVoucherModal(vc)}>✏️ Sửa</button>
                               <button type="button" className="btn-delete" onClick={() => handleDeleteVoucher(vc.id, vc.ma_voucher)}>🗑️ Xóa</button>
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================
              MÀN HÌNH 5: LỊCH SỬ GIAO DỊCH BÁN HÀNG
          ======================================================== */}
          {activeMenu === 'history' && (
            <div className="fade-in">
              <div className="emp-header">
                <h2>Nhật Ký Giao Dịch & Hóa Đơn Bán Hàng</h2>
              </div>

              <div className="history-control-panel">
                <div className="history-filter-row">
                  <span className="history-filter-label">Chế độ xem lịch sử:</span>
                  <div className="role-toggle role-toggle--inline">
                    <button type="button" className={`toggle-btn ${searchHistoryType === 'employee' ? 'active-teal' : ''}`} onClick={() => setSearchHistoryType('employee')}>
                      👤 Tìm theo nhân viên
                    </button>
                    <button type="button" className={`toggle-btn ${searchHistoryType === 'product' ? 'active-cam' : ''}`} onClick={() => setSearchHistoryType('product')}>
                      📦 Tìm theo sản phẩm
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  className="history-search-input ui-search"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder={searchHistoryType === 'employee' ? 'Gõ tên nhân viên hoặc mã hóa đơn để tìm...' : 'Gõ tên sản phẩm hoặc mã SP cần lọc...'}
                  aria-label="Tìm kiếm trong lịch sử giao dịch"
                />
              </div>

              {searchHistoryType === 'employee' && (
                <div className="ranking-table-box ranking-table-box--auto">
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Tên Nhân Viên</th>
                        <th>Thông tin sản phẩm</th>
                        <th>Mã Đơn</th>
                        <th className="text-center">Xem đơn</th>
                        <th className="text-center">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length === 0 && (
                        <EmptyRow
                          colSpan="6"
                          art={petSleep}
                          title={historyKeyword ? 'Không tìm thấy hóa đơn nào' : 'Chưa có giao dịch nào'}
                          desc={historyKeyword ? `Không có hóa đơn nào khớp với "${historySearchQuery}".` : 'Các đơn hàng nhân viên chốt tại quầy sẽ hiện ở đây.'}
                        />
                      )}
                      {filteredOrders.map((order, index) => (
                        <tr key={order.id}>
                          <td className="rank-num">{index + 1}</td>
                          <td className="rank-name">👤 {order.ten_nhan_vien}</td>
                          <td className="product-list-mini">
                            {order.danh_sach_sp?.map((sp, i) => (
                              <span key={i}>• {sp.ten_san_pham} (x{sp.so_luong_ban})</span>
                            ))}
                          </td>
                          <td><code style={{ color: 'var(--accent-600)', fontWeight: 700 }}>{order.ma_don}</code></td>
                          <td className="text-center">
                            <button type="button" className="btn-eye-view" onClick={() => handleOpenViewOrder(order)} title="Xem hóa đơn" aria-label="Xem hóa đơn">👁️</button>
                          </td>
                          <td className="text-center">
                            <div className="action-buttons">
                              <button type="button" className="btn-edit" onClick={() => handleOpenViewOrder(order)}>✏️ Chi tiết</button>
                              <button type="button" className="btn-delete" onClick={() => handleDeleteOrder(order.id, order.ma_don)}>🗑️ Xóa</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {searchHistoryType === 'product' && (
                <div className="ranking-table-box ranking-table-box--auto">
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Tên sản phẩm</th>
                        <th>Mã SP</th>
                        <th>Số lượng bán</th>
                        <th>Số lượng tồn</th>
                        <th className="text-center">Hóa đơn chứa SP</th>
                        <th className="text-center">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProductSales.length === 0 && (
                        <EmptyRow
                          colSpan="7"
                          art={petCat}
                          title={historyKeyword ? 'Không tìm thấy sản phẩm nào' : 'Chưa có sản phẩm nào bán ra'}
                          desc={historyKeyword ? `Không có mặt hàng nào khớp với "${historySearchQuery}".` : 'Thống kê bán chạy sẽ xuất hiện sau đơn hàng đầu tiên.'}
                        />
                      )}
                      {filteredProductSales.map((item, index) => (
                        <tr key={item.ma_sp}>
                          <td className="rank-num">{index + 1}</td>
                          <td className="rank-name color-teal">{item.ten_san_pham}</td>
                          <td><code>{item.ma_sp}</code></td>
                          <td className="color-cam">{item.so_luong_ban} cái</td>
                          <td>
                            <span className={`ui-badge ${item.so_luong_ton > 5 ? 'ui-badge--success' : (item.so_luong_ton > 0 ? 'ui-badge--accent' : 'ui-badge--danger')}`}>
                              {item.so_luong_ton > 0 ? `Còn ${item.so_luong_ton} trong kho` : 'Hết hàng'}
                            </span>
                          </td>
                          <td className="text-center" style={{ maxWidth: '260px' }}>
                            {item.orders_linked.map((order, idx) => (
                              <button type="button" key={idx} className="btn-eye-tag" onClick={() => handleOpenViewOrder(order)}>
                                👁️ {order.ma_don}
                              </button>
                            ))}
                          </td>
                          <td className="text-center">
                            <span style={{ fontSize: '12px', color: 'var(--ink-300)' }}>Chuyển tab Nhân viên để xóa đơn</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              MÀN HÌNH: CÀI ĐẶT CỬA HÀNG (ĐÃ BỎ ẢNH QR TĨNH)
          ======================================================== */}
          {activeMenu === 'settings' && (
            <div className="fade-in">
              <div className="emp-header">
                <h2>⚙️ Cài Đặt Cửa Hàng</h2>
              </div>

              <div className="settings-grid">
                {/* KHỐI THÔNG TIN CỬA HÀNG & THANH TOÁN */}
                <div className="ranking-table-box settings-panel">
                  <h3 className="ranking-title">🏬 Thông tin cửa hàng</h3>
                  <form onSubmit={handleSaveSettings}>
                    <div className="input-group">
                      <label>Tên cửa hàng</label>
                      <input type="text" value={storeSettings.ten_cua_hang} onChange={(e) => handleSettingsChange('ten_cua_hang', e.target.value)} placeholder="ThiThiPet Shop" />
                    </div>
                    <div className="input-group">
                      <label>Địa chỉ</label>
                      <input type="text" value={storeSettings.dia_chi} onChange={(e) => handleSettingsChange('dia_chi', e.target.value)} placeholder="Số nhà, đường, phường/xã, quận/huyện..." />
                    </div>
                    <div className="input-group">
                      <label>Số điện thoại</label>
                      <input type="text" value={storeSettings.so_dien_thoai} onChange={(e) => handleSettingsChange('so_dien_thoai', e.target.value)} placeholder="0909 xxx xxx" />
                    </div>

                    <h3 className="ranking-title" style={{ marginTop: '25px' }}>💳 Thông tin thanh toán (Tạo mã VietQR)</h3>
                    <div className="input-group">
                      <label>Ngân hàng (Nhập Tên viết tắt. VD: MB, VCB, ACB, TPB...)</label>
                      <input type="text" value={storeSettings.ten_ngan_hang} onChange={(e) => handleSettingsChange('ten_ngan_hang', e.target.value.toUpperCase())} placeholder="MB" />
                    </div>
                    <div className="input-group">
                      <label>Số tài khoản</label>
                      <input type="text" value={storeSettings.so_tai_khoan} onChange={(e) => handleSettingsChange('so_tai_khoan', e.target.value)} placeholder="0123456789" />
                    </div>
                    <div className="input-group">
                      <label>Chủ tài khoản (Không dấu)</label>
                      <input type="text" value={storeSettings.chu_tai_khoan} onChange={(e) => handleSettingsChange('chu_tai_khoan', e.target.value.toUpperCase())} placeholder="NGUYEN VAN A" />
                    </div>

                    {/* KHUNG XEM TRƯỚC MÃ QR ĐỘNG TỪ VIETQR.IO */}
                    <div className="input-group">
                      <label>Xem trước Mã QR Thanh Toán (Tự động sinh)</label>
                      <div className="qr-upload-box">
                        <img
                          className="qr-preview-img"
                          src={`https://img.vietqr.io/image/${storeSettings.ten_ngan_hang || 'MB'}-${storeSettings.so_tai_khoan || '0123456789'}-compact2.png?accountName=${encodeURIComponent(storeSettings.chu_tai_khoan || '')}`}
                          alt="Mã QR thanh toán"
                          loading="lazy"
                        />
                      </div>
                    </div>

                    <div className="modal-actions" style={{ marginTop: '10px' }}>
                      <button type="submit" className="btn-submit btn-submit--brand" disabled={isSavingSettings}>
                        {isSavingSettings ? '⏳ Đang lưu...' : '💾 Lưu cài đặt'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* KHỐI XUẤT BÁO CÁO EXCEL */}
                <div className="ranking-table-box settings-panel">
                  <h3 className="ranking-title">📊 Xuất báo cáo doanh thu</h3>
                  <p className="settings-hint">
                    Tải file Excel (.xlsx) liệt kê chi tiết từng đơn hàng kèm tổng doanh thu.
                  </p>
                  <div className="export-btn-row">
                    <button type="button" className="btn-export-excel" onClick={handleExportDailyRevenue} disabled={isExporting}>
                      <span className="export-icon">📅</span>
                      <span>Xuất doanh thu<br /><strong>Hôm nay</strong></span>
                    </button>
                    <button type="button" className="btn-export-excel" onClick={handleExportWeeklyRevenue} disabled={isExporting}>
                      <span className="export-icon">🗓️</span>
                      <span>Xuất doanh thu<br /><strong>Tuần này</strong></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ========================================================
          MODAL: THÊM / SỬA TÀI KHOẢN NHÂN VIÊN
      ======================================================== */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title">{modalMode === 'create' ? 'Tạo Tài Khoản Mới' : 'Cập Nhật Tài Khoản'}</h3>
            <div className="role-toggle">
              <button type="button" className={`toggle-btn ${role === 'NhanVien' ? 'active-teal' : ''}`} onClick={() => setRole('NhanVien')}>Nhân Viên</button>
              <button type="button" className={`toggle-btn ${role === 'Admin' ? 'active-cam' : ''}`} onClick={() => setRole('Admin')}>Quản Trị Viên</button>
            </div>
            <form onSubmit={handleSubmitAccount}>
              <div className="input-group">
                <label>Họ và Tên</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Tên đăng nhập (Username)</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required={modalMode === 'create'} disabled={modalMode === 'edit'} />
              </div>
              
              <div className="input-group">
                <label>{modalMode === 'create' ? 'Mật khẩu' : 'Mật khẩu mới (Bỏ trống nếu không đổi)'}</label>
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={modalMode === 'create'}
                    placeholder={modalMode === 'edit' ? 'Nhập pass mới để đổi...' : ''}
                  />
                  <button
                    type="button"
                    className="password-field__toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Hủy Bỏ</button>
                <button type="submit" className="btn-submit">{modalMode === 'create' ? 'Xác Nhận Tạo' : 'Lưu Thay Đổi'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          CÁC MODAL KHÁC
      ======================================================== */}
      {isProductModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box modal-box--wide">
            <h3 className="modal-title">{productMode === 'create' ? 'Thêm Sản Phẩm Mới' : 'Cập Nhật Sản Phẩm'}</h3>
            <form onSubmit={handleSubmitProduct}>
              <div className="input-group">
                <label>Tên Sản Phẩm</label>
                <input type="text" value={prodName} onChange={(e) => setProdName(e.target.value)} required />
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Giá Bán (VNĐ)</label>
                  <input type="number" min="0" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Tồn Kho (Cái)</label>
                  <input type="number" min="0" value={prodStock} onChange={(e) => setProdStock(e.target.value)} required />
                </div>
              </div>
              <div className="input-group">
                <label>Mã Sản Phẩm</label>
                <input type="text" value={prodCode} onChange={(e) => setProdCode(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Tải Ảnh Lên</label>
                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} />
                {prodImagePreview && (
                  <div className="img-preview">
                    <img src={prodImagePreview} alt="Xem trước ảnh sản phẩm" />
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsProductModalOpen(false)}>Hủy Bỏ</button>
                <button type="submit" className="btn-submit">{productMode === 'create' ? 'Xác Nhận Lưu' : 'Lưu Thay Đổi'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isServiceModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box modal-box--wide">
            <h3 className="modal-title">{serviceMode === 'create' ? 'Thêm Dịch Vụ Mới' : 'Cập Nhật Dịch Vụ'}</h3>
            <form onSubmit={handleSubmitService}>
              <div className="input-group">
                <label>Tên Dịch Vụ</label>
                <input type="text" value={svName} onChange={(e) => setSvName(e.target.value)} required placeholder="VD: Tắm và cắt tỉa lông" />
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Phí Dịch Vụ (VNĐ)</label>
                  <input type="number" value={svPrice} onChange={(e) => setSvPrice(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Mã Dịch Vụ</label>
                  <input type="text" value={svCode} onChange={(e) => setSvCode(e.target.value)} required placeholder="VD: DV01" />
                </div>
              </div>
              <div className="input-group">
                <label>Tải Ảnh Đại Diện</label>
                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageUploadService} />
                {svImagePreview && (
                  <div className="img-preview">
                    <img src={svImagePreview} alt="Xem trước ảnh dịch vụ" />
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsServiceModalOpen(false)}>Hủy Bỏ</button>
                <button type="submit" className="btn-submit">{serviceMode === 'create' ? 'Xác Nhận Lưu' : 'Lưu Thay Đổi'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isVoucherModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box modal-box--wide">
            <h3 className="modal-title">{voucherMode === 'create' ? 'Voucher mới' : 'Cập nhật Voucher'}</h3>
            <form onSubmit={handleSubmitVoucher}>
              <div className="input-group">
                <label>Tên Chương Trình (Chiến dịch)</label>
                <input type="text" value={voucherName} onChange={(e) => setVoucherName(e.target.value)} required placeholder="VD: Tri ân khách hàng tháng 7" />
              </div>
              <div className="input-group">
                <label>Mã VC (Mã Voucher)</label>
                <div className="code-input-row">
                  <input type="text" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} required placeholder="VD: KHUYENMAI2026" />
                  <button type="button" className="btn-random-code" onClick={handleRandomVoucherCode} title="Tạo mã ngẫu nhiên">🎲 Tạo mã</button>
                </div>
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Từ ngày</label>
                  <input type="date" value={voucherStartDate} onChange={(e) => setVoucherStartDate(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Đến ngày</label>
                  <input type="date" value={voucherEndDate} onChange={(e) => setVoucherEndDate(e.target.value)} required />
                </div>
              </div>
              <div className="input-group">
                <label>Số Lượng Voucher Phát Hành</label>
                <input type="number" value={voucherQuantity} onChange={(e) => setVoucherQuantity(e.target.value)} required placeholder="VD: 100" />
              </div>
              <div className="input-group">
                <label>Loại Thưởng</label>
                <div className="role-toggle" style={{marginBottom: '10px'}}>
                  <button type="button" className={`toggle-btn ${voucherType === 'discount' ? 'active-teal' : ''}`} onClick={() => setVoucherType('discount')}>Giảm giá (Tiền)</button>
                  <button type="button" className={`toggle-btn ${voucherType === 'gift' ? 'active-cam' : ''}`} onClick={() => setVoucherType('gift')}>Quà tặng (Hiện vật)</button>
                </div>
                {voucherType === 'discount' ? (
                  <input type="number" value={voucherValue} onChange={(e) => setVoucherValue(e.target.value)} required placeholder="Nhập số tiền giảm (VD: 50000)" />
                ) : (
                  <input type="text" value={voucherValue} onChange={(e) => setVoucherValue(e.target.value)} required placeholder="Nhập tên quà tặng (VD: Tặng 1 bát ăn)" />
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsVoucherModalOpen(false)}>Hủy</button>
                <button type="submit" className="btn-submit">{voucherMode === 'create' ? 'Thêm Voucher' : 'Lưu Thay Đổi'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isViewOrderOpen && selectedOrder && (
        <div className="modal-overlay receipt-wrapper">
          <div className="thermal-receipt">
            <div className="receipt-header">
              <h2>{storeSettings.ten_cua_hang || 'THITHIPET SHOP'}</h2>
              <p className="receipt-header__addr">Đ/C: {storeSettings.dia_chi || 'An Ngãi Trung, Vũng Liêm, Vĩnh Long'}</p>
              <p className="receipt-header__kind">HÓA ĐƠN BÁN HÀNG</p>
            </div>
            
            <div className="receipt-info">
              <div><strong>Mã đơn:</strong> {selectedOrder.ma_don}</div>
              <div><strong>Thu ngân:</strong> {selectedOrder.ten_nhan_vien}</div>
              <div><strong>Thời gian:</strong> {new Date(selectedOrder.ngay_ban).toLocaleString('vi-VN')}</div>
            </div>

            <table className="receipt-table">
              <thead>
                <tr>
                  <th>Tên Sản Phẩm</th>
                  <th style={{ textAlign: 'center' }}>SL</th>
                  <th style={{ textAlign: 'right' }}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.danh_sach_sp?.map((item, i) => (
                  <tr key={i}>
                    <td>{item.ten_san_pham}</td>
                    <td style={{ textAlign: 'center' }}>{item.so_luong_ban}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(item.so_luong_ban * item.gia_ban)} đ</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="receipt-total">
              <span>TỔNG CỘNG:</span>
              <span className="amount">{formatMoney(selectedOrder.tong_tien)} đ</span>
            </div>

            <div className="receipt-footer">
              <p>Cảm ơn quý khách đã ủng hộ ThiThiPet! ❤️</p>
              <p>Hẹn gặp lại quý khách lần sau.</p>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setIsViewOrderOpen(false)}>Đóng hóa đơn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;