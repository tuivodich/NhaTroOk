export type Role = "admin" | "staff" | "tenant";
export type RoomStatus = "vacant" | "occupied" | "maintenance";
export type ContractStatus = "draft" | "active" | "expired" | "cancelled"; // [PHASE4A] thêm draft
export type InvoiceStatus = "unpaid" | "paid" | "overdue";

export interface UserProfile {
  id: string;
  uid?: string;
  email?: string;
  displayName?: string;
  role: Role;
  createdAt?: unknown;
}

export interface PropertyDoc {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  roomCount?: number;
}

export interface RoomDoc {
  id: string;
  propertyId: string;
  code: string;
  floor?: number;
  area?: number;
  baseRent: number;
  deposit?: number;
  status: RoomStatus;
  amenities?: string[];
  desc?: string;
  descEn?: string;
  meter?: { electricStart?: number; waterStart?: number };
  // Phase 2:
  photos?: string[];
  published?: boolean;
  featured?: boolean;
  residentUids?: string[]; // [PHASE4E] uid khách được xem phòng này (rules); staff/admin duy trì
}

export interface TenantDoc {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  roomId?: string;
  notes?: string;
  // [PHASE4A]
  code?: string;
  inquiryId?: string;
  contractIds?: string[];
  userId?: string;
  address?: string;
  status?: "active" | "inactive";
  createdBy?: string;
}

// [PHASE4A]
export interface ContractEvent {
  at: number;
  by: string;
  action: "created_from_inquiry" | "created_manual" | "activated" | "expired" | "cancelled" | "updated";
  note?: string;
}

export interface ContractDoc {
  id: string;
  tenantId: string;
  roomId: string;
  startDate: string;
  endDate: string;
  rent: number;
  deposit?: number;
  status: ContractStatus;
  notes?: string;
  userId?: string; // [PHASE4C] uid tài khoản của khách (denormalize từ tenant.userId)
  // [PHASE4A]
  code?: string;
  inquiryId?: string;
  paymentCycle?: "monthly" | "quarterly" | "yearly";
  dueDay?: number;
  timeline?: ContractEvent[];
}

export interface InvoiceItem { label: string; amount: number; }
export interface InvoiceDoc {
  id: string;
  roomId: string;
  tenantId?: string;
  // [PHASE4B]
  userId?: string; // [PHASE4C]
  contractId?: string;
  meter?: { electricPrev: number; electricCurr: number; waterPrev: number; waterCurr: number };
  createdAt?: unknown;
  month: string;
  items?: InvoiceItem[];
  total: number;
  status: InvoiceStatus;
  dueDate?: string;
  paidAt?: number;
  notes?: string;
}

export interface AuditDoc {
  id: string;
  action: string;
  message: string;
  target?: { type: string; id: string } | null;
  uid?: string | null;
  email?: string | null;
  role?: Role | null;
  at?: unknown;
}

export function isAdminRole(role?: Role | null): boolean {
  return role === "admin";
}

// ===== Phase 3: Inquiries =====
export type InquiryStatus = "new" | "contacted" | "scheduled" | "converted" | "rejected";

export type InquiryDoc = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  roomId?: string | null;
  roomCode?: string | null;
  message?: string | null;
  preferredDate?: string | null;
  status: InquiryStatus;
  notes?: string | null;
  handledBy?: string | null;
  contractId?: string | null; // [PHASE4A]
  createdAt?: any;
  updatedAt?: any;
};


// ===== [PHASE4B] Đơn giá + chỉ số đồng hồ =====
export interface FixedFee { label: string; amount: number; }
export interface BillingSettings {
  electricRate: number; // đ / kWh
  waterRate: number;    // đ / m³
  fixedFees: FixedFee[]; // phí cố định hàng tháng mỗi phòng (rác, internet…)
}
export interface MeterReadingDoc {
  id: string;          // `${roomId}_${YYYY-MM}`
  roomId: string;
  month: string;       // YYYY-MM
  electric: number;
  water: number;
  createdAt?: unknown;
}


// ===== [PHASE4C] Yêu cầu sửa chữa =====
export type MaintenanceStatus = "new" | "in_progress" | "done";
export interface MaintenanceRequest {
  id: string;
  userId: string;
  tenantId?: string;
  roomId?: string;
  title: string;
  description?: string;
  status: MaintenanceStatus;
  staffNote?: string;
  createdAt?: any;
  updatedAt?: any;
}


// ===== [PHASE4D] Khách báo đã chuyển khoản =====
export type PaymentReportStatus = "pending" | "confirmed" | "rejected";
export interface PaymentReport {
  id: string;            // `pr_${invoiceId}` (mỗi hóa đơn tối đa một báo cáo)
  invoiceId: string;
  userId: string;
  tenantId?: string;
  roomId?: string;
  amount: number;
  note?: string;
  status: PaymentReportStatus;
  staffNote?: string;
  reviewedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}
