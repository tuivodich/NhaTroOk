import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Lang = "vi" | "en";
type Dict = Record<string, string>;

const VI: Dict = {
  login: "Đăng nhập", register: "Đăng ký", logout: "Đăng xuất",
  email: "Email", password: "Mật khẩu", displayName: "Tên hiển thị",
  loginGoogle: "Đăng nhập bằng Google",
  signInTitle: "Đăng nhập vào hệ thống", signUpTitle: "Tạo tài khoản mới",
  noAccount: "Chưa có tài khoản? Đăng ký", haveAccount: "Đã có tài khoản? Đăng nhập",
  firstUserHint: "Người dùng đầu tiên sẽ trở thành quản trị viên.",
  goToAdmin: "Vào quản trị", comingSoonDesc: "Hệ thống quản lý nhà trọ.",

  dashboard: "Tổng quan", properties: "Nhà trọ", rooms: "Phòng", tenants: "Khách thuê",
  contracts: "Hợp đồng", invoices: "Hóa đơn", users: "Người dùng", auditLog: "Nhật ký",
  settings: "Cài đặt", loading: "Đang tải...", error: "Có lỗi xảy ra", save: "Lưu",
  cancel: "Hủy", edit: "Sửa", delete: "Xóa", none: "—", all: "Tất cả", status: "Trạng thái",
  notes: "Ghi chú", month: "tháng", floor: "Tầng", saved: "Đã lưu", reset: "Đặt lại",
  profile: "Thông tin cá nhân", language: "Ngôn ngữ",

  totalProperties: "Tổng nhà trọ", totalRooms: "Tổng phòng",
  vacantRooms: "Phòng trống", occupiedRooms: "Phòng đang thuê",
  quickActions: "Thao tác nhanh", addProperty: "Thêm nhà trọ", addRoom: "Thêm phòng",

  propertyName: "Tên nhà trọ", propertyAddress: "Địa chỉ", propertyNotes: "Ghi chú",
  editProperty: "Sửa nhà trọ", deletePropertySure: "Xóa nhà trọ này?",
  propertyHasRooms: "Không thể xóa: nhà trọ còn phòng.", propertyRooms: "Số phòng",
  noProperties: "Chưa có nhà trọ nào.",

  roomProperty: "Nhà trọ", roomCode: "Mã phòng", roomFloor: "Tầng", roomArea: "Diện tích (m²)",
  roomRent: "Giá thuê", roomDeposit: "Tiền cọc", roomStatus: "Trạng thái phòng",
  roomAmenities: "Tiện ích (mỗi dòng một mục)", roomAmenitiesHint: "WiFi, Điều hòa, Nóng lạnh...",
  roomDesc: "Mô tả (VI)", roomDescEn: "Mô tả (EN)",
  statusVacant: "Trống", statusOccupied: "Đang thuê", statusMaintenance: "Đang sửa",
  editRoom: "Sửa phòng", deleteRoomSure: "Xóa phòng này?",
  electricStart: "Số điện đầu kỳ", waterStart: "Số nước đầu kỳ",
  filterProperty: "Lọc theo nhà trọ", noRooms: "Chưa có phòng nào.",

  tenantName: "Họ tên", tenantPhone: "Số điện thoại", tenantEmail: "Email",
  tenantIdNumber: "CMND/CCCD", tenantRoom: "Phòng", addTenant: "Thêm khách",
  editTenant: "Sửa khách", deleteTenantSure: "Xóa khách này?", noTenants: "Chưa có khách thuê.",

  contractTenant: "Khách thuê", contractRoom: "Phòng", contractStart: "Ngày bắt đầu",
  contractEnd: "Ngày kết thúc", contractRent: "Tiền thuê/tháng", contractDeposit: "Tiền cọc",
  contractActive: "Hiệu lực", contractExpired: "Hết hạn", contractCancelled: "Đã hủy",
  addContract: "Thêm hợp đồng", editContract: "Sửa hợp đồng",
  deleteContractSure: "Xóa hợp đồng này?", noContracts: "Chưa có hợp đồng.",

  invoiceRoom: "Phòng", invoiceTenant: "Khách thuê", invoiceMonth: "Kỳ hóa đơn",
  invoiceDue: "Hạn thanh toán", invoiceTotal: "Tổng tiền", invoiceUnpaid: "Chưa trả",
  invoicePaid: "Đã trả", invoiceOverdue: "Quá hạn", markPaid: "Đánh dấu đã trả",
  addInvoice: "Thêm hóa đơn", editInvoice: "Sửa hóa đơn",
  deleteInvoiceSure: "Xóa hóa đơn này?", noInvoices: "Chưa có hóa đơn.",

  noUsers: "Chưa có người dùng.", noAudit: "Chưa có bản ghi nào.",
  brandTitle: "Thương hiệu", brandName: "Tên hiển thị", brandTagline: "Khẩu hiệu", brandColor: "Màu chủ đạo",
};

const EN: Dict = {
  login: "Sign in", register: "Sign up", logout: "Sign out",
  email: "Email", password: "Password", displayName: "Display name",
  loginGoogle: "Continue with Google",
  signInTitle: "Sign in to the system", signUpTitle: "Create a new account",
  noAccount: "No account? Sign up", haveAccount: "Already have an account? Sign in",
  firstUserHint: "The first user becomes the administrator.",
  goToAdmin: "Open admin", comingSoonDesc: "Rental management system.",

  dashboard: "Dashboard", properties: "Properties", rooms: "Rooms", tenants: "Tenants",
  contracts: "Contracts", invoices: "Invoices", users: "Users", auditLog: "Audit log",
  settings: "Settings", loading: "Loading...", error: "Something went wrong", save: "Save",
  cancel: "Cancel", edit: "Edit", delete: "Delete", none: "—", all: "All", status: "Status",
  notes: "Notes", month: "month", floor: "Floor", saved: "Saved", reset: "Reset",
  profile: "Profile", language: "Language",

  totalProperties: "Properties", totalRooms: "Rooms", vacantRooms: "Vacant", occupiedRooms: "Occupied",
  quickActions: "Quick actions", addProperty: "Add property", addRoom: "Add room",

  propertyName: "Property name", propertyAddress: "Address", propertyNotes: "Notes",
  editProperty: "Edit property", deletePropertySure: "Delete this property?",
  propertyHasRooms: "Cannot delete: property still has rooms.", propertyRooms: "Rooms",
  noProperties: "No properties yet.",

  roomProperty: "Property", roomCode: "Room code", roomFloor: "Floor", roomArea: "Area (m²)",
  roomRent: "Rent", roomDeposit: "Deposit", roomStatus: "Room status",
  roomAmenities: "Amenities (one per line)", roomAmenitiesHint: "WiFi, AC, Water heater...",
  roomDesc: "Description (VI)", roomDescEn: "Description (EN)",
  statusVacant: "Vacant", statusOccupied: "Occupied", statusMaintenance: "Maintenance",
  editRoom: "Edit room", deleteRoomSure: "Delete this room?",
  electricStart: "Electric meter start", waterStart: "Water meter start",
  filterProperty: "Filter by property", noRooms: "No rooms yet.",

  tenantName: "Full name", tenantPhone: "Phone", tenantEmail: "Email",
  tenantIdNumber: "ID number", tenantRoom: "Room", addTenant: "Add tenant",
  editTenant: "Edit tenant", deleteTenantSure: "Delete this tenant?", noTenants: "No tenants yet.",

  contractTenant: "Tenant", contractRoom: "Room", contractStart: "Start date",
  contractEnd: "End date", contractRent: "Monthly rent", contractDeposit: "Deposit",
  contractActive: "Active", contractExpired: "Expired", contractCancelled: "Cancelled",
  addContract: "Add contract", editContract: "Edit contract",
  deleteContractSure: "Delete this contract?", noContracts: "No contracts yet.",

  invoiceRoom: "Room", invoiceTenant: "Tenant", invoiceMonth: "Billing month",
  invoiceDue: "Due date", invoiceTotal: "Total", invoiceUnpaid: "Unpaid",
  invoicePaid: "Paid", invoiceOverdue: "Overdue", markPaid: "Mark as paid",
  addInvoice: "Add invoice", editInvoice: "Edit invoice",
  deleteInvoiceSure: "Delete this invoice?", noInvoices: "No invoices yet.",

  noUsers: "No users yet.", noAudit: "No records yet.",
  brandTitle: "Branding", brandName: "Brand name", brandTagline: "Tagline", brandColor: "Brand color",
};

const DICTS: Record<Lang, Dict> = { vi: VI, en: EN };

interface I18nCtxValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtxValue | null>(null);
const STORE = "i18n-lang-v1";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORE);
    return saved === "en" ? "en" : "vi";
  });

  const setLang = (l: Lang) => {
    localStorage.setItem(STORE, l);
    setLangState(l);
  };

  const t = useMemo(() => (key: string) => DICTS[lang][key] ?? key, [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be inside I18nProvider");
  return v;
}
