export type Role = "admin" | "staff" | "tenant";
export type RoomStatus = "vacant" | "occupied" | "maintenance";
export type ContractStatus = "active" | "expired" | "cancelled";
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
}

export interface TenantDoc {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  roomId?: string;
  notes?: string;
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
}

export interface InvoiceItem { label: string; amount: number; }
export interface InvoiceDoc {
  id: string;
  roomId: string;
  tenantId?: string;
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
  createdAt?: any;
  updatedAt?: any;
};
