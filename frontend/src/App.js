import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import './App.css';
import html2canvas from 'html2canvas';
import Login from './Login';
import AdminDashboard from './Admin';
import { NotifyHost, notify } from './notify';
import logoPetShop from './decorapp/logopetshop-opt.png';
import petSleep from './decorapp/pet-sleep.png';
import petCat from './decorapp/pet-cat.png';

const API = 'http://localhost:5000';

const formatMoney = (value) => Number(value || 0).toLocaleString('vi-VN');

// ========================================================
// 🧩 THẺ HÀNG HÓA
// Tách riêng + memo hóa: khi gõ ô tìm kiếm hoặc bấm thêm vào giỏ,
// React chỉ vẽ lại đúng những thẻ có dữ liệu thay đổi thay vì cả lưới.
// (Muốn memo có tác dụng thì props phải ổn định -> handler truyền vào
//  là hàm useCallback, không phải arrow function tạo mới mỗi lần render.)
// ========================================================
function CardShell({ name, price, image, tagText, tagVariant, isService, isOut, onClick }) {
  return (
    <button
      type="button"
      className={`pos-card${isService ? ' pos-card--service' : ''}${isOut ? ' pos-card--out' : ''}`}
      onClick={onClick}
      title={isOut ? `${name} — đã hết hàng` : `Thêm "${name}" vào hóa đơn`}
    >
      <div className="pos-card__img-box">
        <img
          src={image || logoPetShop}
          alt={name}
          loading="lazy"
          decoding="async"
          style={{ objectFit: image ? 'cover' : 'contain' }}
        />
        <span className={`pos-card__tag${tagVariant ? ` pos-card__tag--${tagVariant}` : ''}`}>{tagText}</span>
        <span className="pos-card__add" aria-hidden="true">+</span>
      </div>
      <div className="pos-card__body">
        <p className="pos-card__name">{name}</p>
        <p className="pos-card__price">{formatMoney(price)} đ</p>
      </div>
    </button>
  );
}

const ProductCard = memo(function ProductCard({ product, onAdd }) {
  const isOut = product.so_luong <= 0;
  return (
    <CardShell
      name={product.ten_sp}
      price={product.gia_ban}
      image={product.hinh_anh}
      tagText={isOut ? 'Hết hàng' : `Tồn: ${product.so_luong}`}
      tagVariant={isOut ? 'out' : (product.so_luong <= 5 ? 'low' : null)}
      isOut={isOut}
      onClick={() => onAdd(product)}
    />
  );
});

const ServiceCard = memo(function ServiceCard({ service, onAdd }) {
  return (
    <CardShell
      name={service.ten_dv}
      price={service.gia_dv}
      image={service.hinh_anh}
      tagText="Dịch Vụ"
      tagVariant="orange"
      isService
      onClick={() => onAdd(service)}
    />
  );
});

// ========================================================
// 🚀 COMPONENT PHÂN HỆ: MÁY BÁN HÀNG POS CỦA NHÂN VIÊN
// ========================================================
function POSDashboard({ onLogout, currentUser }) {
  const [posMenu, setPosMenu] = useState('create_order');

  // --- STATE KHO HÀNG & DỊCH VỤ ---
  const [posTab, setPosTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);

  const [cart, setCart] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // --- STATE CHO VOUCHER ---
  const [vouchers, setVouchers] = useState([]);
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);

  // --- STATE CHO THANH TOÁN ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('chuyen_khoan'); // 🌟 Mặc định mở luôn QR Code
  const [tempOrderId, setTempOrderId] = useState('');
  const printBillRef = useRef(null);
  const [orderNote, setOrderNote] = useState('');

  // 🔗 STATE CÀI ĐẶT CỬA HÀNG ĐỂ LẤY MÃ QR TỪ ADMIN
  const [storeSettings, setStoreSettings] = useState(null);

  // Giữ bản giỏ hàng mới nhất trong ref để các hàm xử lý sự kiện
  // không cần tạo lại sau mỗi lần giỏ đổi (giúp memo hóa thẻ hàng có tác dụng)
  const cartRef = useRef(cart);
  cartRef.current = cart;

  const fetchPOSProducts = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/products`);
      if (response.ok) setProducts(await response.json());
    } catch (error) { console.error('Lỗi lấy sản phẩm POS:', error); }
  }, []);

  const fetchPOSServices = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/services`);
      if (response.ok) setServices(await response.json());
    } catch (error) { console.error('Lỗi lấy dịch vụ POS:', error); }
  }, []);

  const fetchPOSHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/orders`);
      if (response.ok) setHistoryOrders(await response.json());
    } catch (error) { console.error('Lỗi lấy lịch sử POS:', error); }
  }, []);

  const fetchVouchers = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/vouchers`);
      if (response.ok) setVouchers(await response.json());
    } catch (error) { console.error('Lỗi lấy voucher POS:', error); }
  }, []);

  const fetchStoreSettings = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/settings`);
      if (response.ok) setStoreSettings(await response.json());
    } catch (error) { console.error('Lỗi lấy cài đặt cửa hàng:', error); }
  }, []);

  // Voucher + cài đặt cửa hàng ít khi đổi -> chỉ tải 1 lần lúc mở máy,
  // thay vì gọi lại toàn bộ 5 API mỗi lần bấm chuyển tab như trước
  useEffect(() => {
    fetchVouchers();
    fetchStoreSettings();
  }, [fetchVouchers, fetchStoreSettings]);

  // Dữ liệu của tab nào thì tải đúng lúc mở tab đó
  useEffect(() => {
    if (posMenu === 'create_order') {
      fetchPOSProducts();
      fetchPOSServices();
    } else if (posMenu === 'history') {
      fetchPOSHistory();
    }
  }, [posMenu, fetchPOSProducts, fetchPOSServices, fetchPOSHistory]);

  // --- LUỒNG GIỎ HÀNG ---
  const addToCart = useCallback((itemData) => {
    if (!itemData.is_service && itemData.so_luong <= 0) {
      notify.warning('Sản phẩm này đã hết hàng trong kho!');
      return;
    }
    const existingItem = cartRef.current.find((item) => item.id === itemData.id);
    if (existingItem) {
      if (!itemData.is_service && existingItem.quantity >= itemData.so_luong) {
        notify.warning(`Kho chỉ còn tồn ${itemData.so_luong} sản phẩm.`);
        return;
      }
      setCart((prev) => prev.map((item) => (item.id === itemData.id ? { ...item, quantity: item.quantity + 1 } : item)));
    } else {
      setCart((prev) => [...prev, { ...itemData, quantity: 1 }]);
    }
  }, []);

  const updateQuantity = useCallback((id, amount) => {
    const target = cartRef.current.find((item) => item.id === id);
    if (!target) return;

    const newQty = target.quantity + amount;
    if (!target.is_service && target.so_luong !== undefined && newQty > target.so_luong) {
      notify.warning(`Kho chỉ còn tồn ${target.so_luong} cái!`);
      return;
    }
    if (newQty <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: newQty } : item)));
  }, []);

  const removeFromCart = useCallback((id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleAddProduct = useCallback((prod) => addToCart({ ...prod, is_service: false }), [addToCart]);

  const handleAddService = useCallback((sv) => addToCart({
    id: `sv_${sv.id}`,
    ten_sp: sv.ten_dv,
    gia_ban: sv.gia_dv,
    ma_sp: sv.ma_dv,
    hinh_anh: sv.hinh_anh,
    is_service: true,
  }), [addToCart]);

  // --- TÍNH TOÁN TIỀN ---
  const totalQuantity = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const subTotalMoney = useMemo(() => cart.reduce((sum, item) => sum + (item.quantity * item.gia_ban), 0), [cart]);

  const handleApplyVoucher = () => {
    if (!voucherInput.trim()) return notify.warning('Vui lòng nhập mã Voucher!');
    const foundVoucher = vouchers.find((v) => v.ma_voucher.toLowerCase() === voucherInput.trim().toLowerCase());
    if (!foundVoucher) return notify.error('Mã Voucher không hợp lệ hoặc không tồn tại!');
    if (foundVoucher.so_luong <= 0) return notify.error('Mã Voucher này đã hết lượt sử dụng!');
    if (new Date(foundVoucher.ngay_het_han) < new Date()) return notify.error('Mã Voucher này đã quá hạn sử dụng!');
    setAppliedVoucher(foundVoucher);
    return notify.success(`Áp dụng thành công Voucher: ${foundVoucher.ten_chuong_trinh}`);
  };

  const handleRemoveVoucher = () => { setAppliedVoucher(null); setVoucherInput(''); };

  const discountAmount = useMemo(() => {
    if (!appliedVoucher || subTotalMoney === 0) return 0;
    if (appliedVoucher.loai_thuong.includes('%') || appliedVoucher.loai_thuong.toLowerCase().includes('phần trăm')) {
      return (subTotalMoney * appliedVoucher.gia_tri_thuong) / 100;
    }
    return appliedVoucher.gia_tri_thuong;
  }, [appliedVoucher, subTotalMoney]);

  const finalTotalMoney = Math.max(0, subTotalMoney - discountAmount);

  // --- XỬ LÝ MỞ BẢNG CHỌN PHƯƠNG THỨC THANH TOÁN ---
  const handleOpenPaymentModal = () => {
    if (cart.length === 0) return notify.warning('Vui lòng chọn sản phẩm vào hóa đơn!');
    const now = new Date();
    setTempOrderId('HD' + now.getTime().toString().slice(-8));
    setPaymentMethod('chuyen_khoan'); // 🌟 Mặc định hiển thị QR động khi mở Modal
    fetchStoreSettings();
    return setIsPaymentModalOpen(true);
  };

  // --- LUỒNG CHỐT ĐƠN IN BILL CUỐI CÙNG ---
  const handleInBill = async () => {
    setIsProcessing(true);

    // Chờ 1 nhịp cho React vẽ xong vùng hóa đơn ẩn rồi mới chụp ảnh
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(printBillRef.current, { scale: 2 });
        const base64Image = canvas.toDataURL('image/png');

        const payload = {
          ma_don: tempOrderId,
          ten_nhan_vien: currentUser?.ho_ten || 'Nhân viên',
          tong_tien: finalTotalMoney,
          items: cart,
          bill_image_base64: base64Image,
          ma_voucher_da_dung: appliedVoucher ? appliedVoucher.ma_voucher : null,
          phuong_thuc_tt: paymentMethod === 'tien_mat' ? 'Tiền mặt' : 'Chuyển khoản',
          ghi_chu: orderNote,
        };

        const response = await fetch(`${API}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          notify.success(`Chốt đơn thành công! Khách thanh toán: ${formatMoney(finalTotalMoney)} đ`);
          setIsPaymentModalOpen(false);
          setCart([]);
          setOrderNote('');
          handleRemoveVoucher();
          fetchPOSProducts();
          fetchVouchers();
        } else {
          const errorData = await response.json();
          notify.error(`Lỗi chốt hóa đơn: ${errorData.error}`);
        }
      } catch (error) {
        // Bắt lỗi ngay trong callback, nếu không nút bấm sẽ kẹt mãi ở trạng thái "Đang xử lý"
        notify.error('Lỗi kết nối Backend hoặc lỗi tạo ảnh Bill.');
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const filteredProducts = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter((p) => p.ten_sp?.toLowerCase().includes(keyword) || p.ma_sp?.toLowerCase().includes(keyword));
  }, [products, searchQuery]);

  const filteredServices = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return services;
    return services.filter((s) => s.ten_dv?.toLowerCase().includes(keyword) || s.ma_dv?.toLowerCase().includes(keyword));
  }, [services, searchQuery]);

  const visibleCount = posTab === 'products' ? filteredProducts.length : filteredServices.length;

  return (
    <div className="pos-shell">

      {/* VÙNG HÓA ĐƠN ẢO TÀNG HÌNH (dùng để html2canvas chụp thành ảnh Bill) */}
      <div style={{ position: 'fixed', left: '-10000px', top: 0 }} aria-hidden="true">
        <div ref={printBillRef} style={{ width: '380px', padding: '25px', backgroundColor: '#fff', fontFamily: 'Courier New, Courier, monospace', color: '#000' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '15px' }}>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '24px' }}>{storeSettings?.ten_cua_hang || 'THITHIPET SHOP'}</h2>
            <p style={{ margin: '0', fontSize: '13px' }}>Đ/C: {storeSettings?.dia_chi || 'An Ngãi Trung, Vũng Liêm, Vĩnh Long'}</p>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px' }}>SĐT: {storeSettings?.so_dien_thoai || '0901234567'}</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '15px', fontWeight: 'bold' }}>HÓA ĐƠN THANH TOÁN</p>
          </div>

          <div style={{ fontSize: '14px', marginBottom: '15px', lineHeight: '1.6' }}>
            <div><strong>Mã đơn:</strong> {tempOrderId}</div>
            <div><strong>Thu ngân:</strong> {currentUser?.ho_ten}</div>
            <div><strong>Thời gian:</strong> {new Date().toLocaleString('vi-VN')}</div>
            <div><strong>Phương thức:</strong> {paymentMethod === 'tien_mat' ? 'Tiền mặt' : 'Chuyển khoản'}</div>
            {orderNote && (
              <div style={{ marginTop: '5px', padding: '5px', border: '1px dashed #7f8c8d', fontSize: '13px' }}>
                <strong>Ghi chú:</strong> {orderNote}
              </div>
            )}
          </div>

          <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <thead>
              <tr style={{ borderBottom: '1px dashed #000' }}>
                <th style={{ textAlign: 'left', paddingBottom: '5px' }}>Tên Hàng / Dịch Vụ</th>
                <th style={{ textAlign: 'center', paddingBottom: '5px' }}>SL</th>
                <th style={{ textAlign: 'right', paddingBottom: '5px' }}>Thành Tiền</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 0' }}>{item.ten_sp}</td>
                  <td style={{ textAlign: 'center', padding: '8px 0' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '8px 0' }}>{formatMoney(item.quantity * item.gia_ban)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '2px dashed #000', paddingTop: '10px', fontSize: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Tổng cộng:</span>
              <span>{formatMoney(subTotalMoney)} đ</span>
            </div>
            {appliedVoucher && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#e74c3c' }}>
                <span>Voucher giảm ({appliedVoucher.ma_voucher}):</span>
                <span>- {formatMoney(discountAmount)} đ</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '19px', marginTop: '10px' }}>
              <span>CẦN THANH TOÁN:</span>
              <span>{formatMoney(finalTotalMoney)} đ</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '13px', fontStyle: 'italic' }}>
            Cảm ơn quý khách đã ủng hộ ThiThiPet! ❤️
          </div>
        </div>
      </div>

      {/* ==================== KHU VỰC TRÁI ==================== */}
      <div className="pos-main">

        {/* THANH ĐẦU TRANG */}
        <header className="pos-topbar">
          <img src={logoPetShop} alt="ThiThiPet Logo" className="pos-topbar__logo" />

          <nav className="pos-topbar__nav">
            <button
              type="button"
              className={`pos-nav-btn ${posMenu === 'create_order' ? 'is-active-teal' : ''}`}
              onClick={() => setPosMenu('create_order')}
            >
              🛒 Tạo Đơn Hàng
            </button>
            <button
              type="button"
              className={`pos-nav-btn ${posMenu === 'history' ? 'is-active-orange' : ''}`}
              onClick={() => setPosMenu('history')}
            >
              🕒 Lịch Sử Bán
            </button>
          </nav>

          <div className="pos-topbar__spacer" />

          <div className="pos-user">
            <div className="pos-user__avatar" aria-hidden="true">👤</div>
            <div className="pos-user__text">
              <span className="pos-user__name">{currentUser?.ho_ten}</span>
              <span className="pos-user__role">Thu Ngân</span>
            </div>
            <button type="button" onClick={onLogout} className="btn-logout-header">🚪 Thoát</button>
          </div>
        </header>

        {/* NỘI DUNG */}
        {posMenu === 'create_order' && (
          <div className="pos-body fade-in">
            <div className="pos-toolbar">
              <div className="pos-switch">
                <button
                  type="button"
                  className={`pos-switch__btn ${posTab === 'products' ? 'is-active-goods' : ''}`}
                  onClick={() => setPosTab('products')}
                >
                  📦 Sản Phẩm
                </button>
                <button
                  type="button"
                  className={`pos-switch__btn ${posTab === 'services' ? 'is-active-services' : ''}`}
                  onClick={() => setPosTab('services')}
                >
                  ✂️ Dịch Vụ
                </button>
              </div>

              <input
                type="text"
                className="pos-search ui-search"
                placeholder={posTab === 'products' ? 'Nhập tên sản phẩm hoặc mã vạch cần tìm...' : 'Nhập tên dịch vụ cần tìm...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm hàng hóa"
              />
            </div>

            <div className="pos-grid-wrap">
              {visibleCount === 0 ? (
                <div className="ui-empty">
                  <img src={petCat} alt="" aria-hidden="true" className="ui-empty__art" />
                  <div className="ui-empty__title">
                    {searchQuery ? 'Không tìm thấy bé nào cả...' : 'Danh mục đang trống'}
                  </div>
                  <div className="ui-empty__desc">
                    {searchQuery
                      ? `Không có mục nào khớp với "${searchQuery}". Thử gõ từ khóa ngắn hơn nhé!`
                      : 'Liên hệ quản trị viên để thêm hàng hóa vào danh mục.'}
                  </div>
                </div>
              ) : (
                <div className="pos-grid">
                  {posTab === 'products' && filteredProducts.map((prod) => (
                    <ProductCard key={`prod_${prod.id}`} product={prod} onAdd={handleAddProduct} />
                  ))}

                  {posTab === 'services' && filteredServices.map((sv) => (
                    <ServiceCard key={`sv_${sv.id}`} service={sv} onAdd={handleAddService} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {posMenu === 'history' && (
          <div className="pos-body fade-in">
            <div className="ranking-table-box pos-history">
              <h3 className="ranking-title">🕒 Lịch sử bán hàng gần đây</h3>
              <div className="table-scroll-wrap">
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Mã Đơn</th>
                      <th>Thời Gian</th>
                      <th className="text-center">Bill PNG</th>
                      <th className="text-right">Tổng Tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyOrders.length === 0 && (
                      <tr className="table-empty">
                        <td colSpan="5">
                          <div className="ui-empty">
                            <img src={petSleep} alt="" aria-hidden="true" className="ui-empty__art ui-empty__art--sm" />
                            <div className="ui-empty__title">Chưa có hóa đơn nào</div>
                            <div className="ui-empty__desc">Các đơn bạn chốt trong ca làm sẽ được lưu lại ở đây.</div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {historyOrders.map((order, index) => (
                      <tr key={order.id}>
                        <td className="rank-num">{index + 1}</td>
                        <td><code style={{ color: 'var(--accent-600)', fontWeight: 700 }}>{order.ma_don}</code></td>
                        <td>{new Date(order.ngay_ban).toLocaleString('vi-VN')}</td>
                        <td className="text-center">
                          {order.hinh_anh_bill ? (
                            <a href={order.hinh_anh_bill} target="_blank" rel="noreferrer" className="bill-link">📸 Xem Bill</a>
                          ) : (
                            <span className="ui-badge ui-badge--muted">Trống</span>
                          )}
                        </td>
                        <td className="text-right text-bold color-teal">{formatMoney(order.tong_tien)} đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== CỘT PHẢI: PHIẾU THANH TOÁN ==================== */}
      <aside className="pos-cart">
        <div className="pos-cart__head">
          <h3 className="pos-cart__title">🧾 PHIẾU THANH TOÁN</h3>
          <p className="pos-cart__sub">Thu ngân: {currentUser?.ho_ten}</p>
          {cart.length > 0 && <span className="pos-cart__count">{cart.length} mục · {totalQuantity} món</span>}
        </div>

        <div className="pos-cart__list">
          {cart.length === 0 && (
            <div className="ui-empty">
              <img src={petSleep} alt="" aria-hidden="true" className="ui-empty__art" />
              <div className="ui-empty__title">Đang chờ khách ghé thăm...</div>
              <div className="ui-empty__desc">Bấm vào sản phẩm hoặc dịch vụ bên trái để thêm vào phiếu nhé!</div>
            </div>
          )}

          {cart.map((item) => (
            <div className={`cart-item${item.is_service ? ' cart-item--service' : ''}`} key={item.id}>
              <div className="cart-item__info">
                <div className="cart-item__name">{item.ten_sp}</div>
                <div className="cart-item__price">{formatMoney(item.gia_ban)} đ × {item.quantity} = <strong>{formatMoney(item.gia_ban * item.quantity)} đ</strong></div>
              </div>
              <div className="cart-item__qty">
                <button type="button" className="qty-btn" onClick={() => updateQuantity(item.id, -1)} aria-label="Giảm số lượng">−</button>
                <span className="qty-value">{item.quantity}</span>
                <button type="button" className="qty-btn" onClick={() => updateQuantity(item.id, 1)} aria-label="Tăng số lượng">+</button>
              </div>
              <button type="button" className="cart-item__remove" onClick={() => removeFromCart(item.id)} title="Xóa khỏi hóa đơn" aria-label="Xóa khỏi hóa đơn">✕</button>
            </div>
          ))}
        </div>

        <div className="pos-cart__foot">
          <div className="voucher-container">
            <span className="voucher-label">Mã giảm giá / Voucher</span>

            {!appliedVoucher ? (
              <div className="voucher-input-group">
                <input
                  type="text"
                  className="voucher-input"
                  placeholder="Nhập mã..."
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyVoucher(); } }}
                  aria-label="Mã voucher"
                />
                <button type="button" className="btn-apply-voucher" onClick={handleApplyVoucher}>Áp dụng</button>
              </div>
            ) : (
              <div className="applied-voucher-info">
                <div>
                  <div className="applied-voucher-info__code">🎟️ {appliedVoucher.ma_voucher}</div>
                  <div className="applied-voucher-info__name">{appliedVoucher.ten_chuong_trinh}</div>
                </div>
                <button type="button" className="btn-remove-voucher" onClick={handleRemoveVoucher} title="Gỡ mã" aria-label="Gỡ mã voucher">✕</button>
              </div>
            )}
          </div>

          <div className="sum-row">
            <span>Số lượng món:</span>
            <strong>{totalQuantity}</strong>
          </div>
          <div className="sum-row">
            <span>Tạm tính:</span>
            <strong>{formatMoney(subTotalMoney)} đ</strong>
          </div>

          {discountAmount > 0 && (
            <div className="sum-row sum-row--discount">
              <span>Voucher giảm:</span>
              <strong>− {formatMoney(discountAmount)} đ</strong>
            </div>
          )}

          <div className="sum-row sum-row--total">
            <span>THÀNH TIỀN:</span>
            <span className="sum-total-value">{formatMoney(finalTotalMoney)} đ</span>
          </div>

          <button
            type="button"
            onClick={handleOpenPaymentModal}
            disabled={isProcessing || cart.length === 0}
            className="btn-pay"
          >
            💳 THANH TOÁN
          </button>

          <div className="pos-note">
            <textarea
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="📝 Nhập tên Pet, SĐT khách hàng, ghi chú... (Không bắt buộc)"
              aria-label="Ghi chú đơn hàng"
            />
          </div>
        </div>
      </aside>

      {/* ==================== MODAL THANH TOÁN ==================== */}
      {isPaymentModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box pay-modal">
            <h3 className="modal-title">Xác nhận thanh toán</h3>
            <p className="pay-modal__hint">Khách hàng cần thanh toán số tiền:</p>
            <div className="pay-modal__amount">{formatMoney(finalTotalMoney)} đ</div>

            <div className="payment-methods">
              <button
                type="button"
                className={`payment-btn ${paymentMethod === 'tien_mat' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('tien_mat')}
              >
                <span className="payment-icon">💵</span>
                <span>Tiền Mặt</span>
              </button>
              <button
                type="button"
                className={`payment-btn ${paymentMethod === 'chuyen_khoan' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('chuyen_khoan')}
              >
                <span className="payment-icon">💳</span>
                <span>Chuyển Khoản QR</span>
              </button>
            </div>

            {/* HIỂN THỊ MÃ QR ĐỘNG VIETQR */}
            {paymentMethod === 'chuyen_khoan' && (
              <div className="qr-panel">
                <p className="qr-panel__title">Khách hàng quét mã bên dưới</p>

                {/* 🌟 URL VietQR TỰ ĐỘNG TRUYỀN SỐ TIỀN VÀ MÃ ĐƠN 🌟 */}
                <img
                  className="qr-panel__img"
                  src={`https://img.vietqr.io/image/${storeSettings?.ten_ngan_hang || 'MB'}-${storeSettings?.so_tai_khoan || '0123456789'}-compact2.png?amount=${finalTotalMoney}&addInfo=${tempOrderId}&accountName=${encodeURIComponent(storeSettings?.chu_tai_khoan || '')}`}
                  alt="Mã QR Thanh Toán"
                />

                <div className="qr-info">
                  <div className="qr-info__row"><span>Ngân hàng</span><strong>{storeSettings?.ten_ngan_hang || 'MB Bank'}</strong></div>
                  <div className="qr-info__row"><span>Số tài khoản</span><strong className="color-teal">{storeSettings?.so_tai_khoan || '0123456789'}</strong></div>
                  <div className="qr-info__row"><span>Chủ tài khoản</span><strong>{storeSettings?.chu_tai_khoan || 'THITHIPET SHOP'}</strong></div>
                  <div className="qr-info__row"><span>Nội dung</span><code>{tempOrderId}</code></div>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setIsPaymentModalOpen(false)} disabled={isProcessing}>
                Quay lại
              </button>
              <button
                type="button"
                className="btn-submit btn-submit--brand"
                onClick={handleInBill}
                disabled={isProcessing}
              >
                {isProcessing ? '⏳ Đang xử lý...' : '🖨️ Xác nhận & In Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const handleLoginSuccess = (userData) => { setIsLoggedIn(true); setCurrentUser(userData); };
  const handleLogout = () => { setIsLoggedIn(false); setCurrentUser(null); };

  let screen = null;
  if (!isLoggedIn || !currentUser) {
    screen = <Login onLoginSuccess={handleLoginSuccess} />;
  } else if (currentUser.phan_quyen === 'QuanTriVien') {
    screen = <AdminDashboard onLogout={handleLogout} currentUser={currentUser} />;
  } else if (currentUser.phan_quyen === 'NhanVien') {
    screen = <POSDashboard onLogout={handleLogout} currentUser={currentUser} />;
  }

  return (
    <>
      {screen}
      {/* Nơi hiển thị toast + hộp thoại xác nhận cho toàn bộ ứng dụng */}
      <NotifyHost />
    </>
  );
}

export default App;
export { POSDashboard };
