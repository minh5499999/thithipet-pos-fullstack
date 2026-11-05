import React, { useCallback, useEffect, useRef, useState } from 'react';

/* =========================================================================
   HỆ THỐNG THÔNG BÁO NỔI (TOAST) & HỘP THOẠI XÁC NHẬN
   Thay cho alert() / window.confirm() mặc định của trình duyệt vốn rất xấu
   và chặn đứng thao tác người dùng.

   Cách dùng ở bất kỳ file nào:
     import { notify, confirmAction } from './notify';
     notify.success('Đã lưu!');
     if (await confirmAction({ message: 'Xóa nhé?' })) { ... }

   Chỉ cần đặt <NotifyHost /> một lần duy nhất ở App.js là chạy.
   ========================================================================= */

/* ----------------------- Kho lưu trữ toast ----------------------- */
let toastListeners = new Set();
let toastItems = [];
let toastSeq = 0;

const MAX_TOASTS = 4;

const emitToasts = () => {
  const snapshot = toastItems.slice();
  toastListeners.forEach((fn) => fn(snapshot));
};

const pushToast = (type, message, duration) => {
  if (message === undefined || message === null || message === '') return undefined;
  const id = ++toastSeq;
  toastItems = toastItems.concat({ id, type, message: String(message), duration });
  if (toastItems.length > MAX_TOASTS) toastItems = toastItems.slice(-MAX_TOASTS);
  emitToasts();
  return id;
};

export const dismissToast = (id) => {
  toastItems = toastItems.filter((t) => t.id !== id);
  emitToasts();
};

export const notify = {
  success: (message, duration = 3200) => pushToast('success', message, duration),
  error: (message, duration = 4500) => pushToast('error', message, duration),
  warning: (message, duration = 3800) => pushToast('warning', message, duration),
  info: (message, duration = 3200) => pushToast('info', message, duration),
};

/* ------------------- Kho lưu trữ hộp xác nhận -------------------- */
let confirmSubscriber = null;
let pendingResolve = null;

const CONFIRM_DEFAULTS = {
  title: 'Xác nhận thao tác',
  message: '',
  confirmText: 'Xác nhận',
  cancelText: 'Hủy bỏ',
  tone: 'danger',
  icon: '⚠️',
};

/**
 * Mở hộp thoại xác nhận, trả về Promise<boolean>.
 * Nếu vì lý do nào đó chưa gắn <NotifyHost /> thì tự lùi về window.confirm
 * để luồng nghiệp vụ không bao giờ bị treo.
 */
export const confirmAction = (options = {}) =>
  new Promise((resolve) => {
    const config = { ...CONFIRM_DEFAULTS, ...options };
    if (!confirmSubscriber) {
      resolve(window.confirm(`${config.title}\n\n${config.message}`));
      return;
    }
    pendingResolve = resolve;
    confirmSubscriber(config);
  });

const closeConfirm = (result) => {
  const resolve = pendingResolve;
  pendingResolve = null;
  if (confirmSubscriber) confirmSubscriber(null);
  if (resolve) resolve(result);
};

/* ---------------------- Giao diện một toast ---------------------- */
const TOAST_ICON = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

function ToastItem({ toast }) {
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef(null);

  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => dismissToast(toast.id), 160);
  }, [toast.id]);

  useEffect(() => {
    timerRef.current = window.setTimeout(close, toast.duration);
    return () => window.clearTimeout(timerRef.current);
  }, [close, toast.duration]);

  return (
    <div
      className={`toast toast--${toast.type}${leaving ? ' toast--leaving' : ''}`}
      role="status"
      aria-live="polite"
      onMouseEnter={() => window.clearTimeout(timerRef.current)}
      onMouseLeave={() => { timerRef.current = window.setTimeout(close, 1500); }}
    >
      <span className="toast__icon" aria-hidden="true">{TOAST_ICON[toast.type] || 'i'}</span>
      <span className="toast__msg">{toast.message}</span>
      <button type="button" className="toast__close" onClick={close} aria-label="Đóng thông báo">✕</button>
      <span className="toast__timer" style={{ animationDuration: `${toast.duration}ms` }} />
    </div>
  );
}

/* ------------ Nơi hiển thị: toast + hộp thoại xác nhận ----------- */
export function NotifyHost() {
  const [items, setItems] = useState(toastItems);
  const [confirmState, setConfirmState] = useState(null);

  useEffect(() => {
    toastListeners.add(setItems);
    setItems(toastItems.slice());
    return () => { toastListeners.delete(setItems); };
  }, []);

  useEffect(() => {
    confirmSubscriber = setConfirmState;
    return () => {
      if (confirmSubscriber === setConfirmState) confirmSubscriber = null;
    };
  }, []);

  useEffect(() => {
    if (!confirmState) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') closeConfirm(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmState]);

  return (
    <>
      <div className="toast-host">
        {items.map((toast) => <ToastItem key={toast.id} toast={toast} />)}
      </div>

      {confirmState && (
        <div
          className="confirm-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeConfirm(false); }}
        >
          <div
            className={`confirm-box${confirmState.tone === 'brand' ? ' confirm-box--brand' : ''}`}
            role="alertdialog"
            aria-modal="true"
            aria-label={confirmState.title}
          >
            <div className="confirm-box__icon" aria-hidden="true">{confirmState.icon}</div>
            <h3 className="confirm-box__title">{confirmState.title}</h3>
            <p className="confirm-box__msg">{confirmState.message}</p>
            <div className="confirm-box__actions">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => closeConfirm(false)}>
                {confirmState.cancelText}
              </button>
              <button
                type="button"
                className={`ui-btn ${confirmState.tone === 'brand' ? 'ui-btn--brand' : 'ui-btn--danger-solid'}`}
                onClick={() => closeConfirm(true)}
                autoFocus
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default NotifyHost;
