# NhaTroOk: quy ước làm việc (đọc trước khi sửa)

Ứng dụng quản lý nhà trọ: Vite + React 18 + TypeScript, Firebase (Auth, Firestore, Hosting). UI tiếng Việt.
Roles: admin | staff | tenant. Live: https://nhatrook.web.app

## Quy ước bắt buộc
- **Làm thẳng trên nhánh `main`**, không tạo nhánh phụ, không tạo PR (người dùng đã đồng ý). Push `main` → GitHub Actions tự deploy.
- **Mỗi lần sửa `firestore.rules`: in TOÀN BỘ nội dung file ra cho người dùng copy** và nhắc họ Publish tay trên Firebase Console (rules không tự deploy). Chạy lại bộ test rules trên Firestore Emulator trước khi báo xong.
- Giao diện: **Theme B** (teal tin cậy, bo góc lớn). CSS thuần trong `src/styles.css` + inline style, **không dùng Tailwind**. Icon SVG trong `src/components/Icons.tsx`, không dùng emoji làm icon.
- Nút/hành động phá huỷ (xóa…) dùng `window.confirm` **2 lớp**.
- Firestore transaction: **đọc trước, ghi sau**; `tx.get` chỉ nhận DocumentReference.
- Không `signOut` một mình: auth expose cả `logout`.
- Người dùng chạy Windows PowerShell: dùng `Select-String`, không dùng `grep` trong hướng dẫn cho họ.
- Không dán/đưa bí mật (khóa service account, mật khẩu SMTP) vào repo hay chat.

## Kiến trúc dữ liệu (tóm tắt)
- `userId` (uid tài khoản khách) được denormalize vào tenants/contracts/invoices; khách chỉ đọc doc có `userId == uid`.
- `rooms.residentUids` = danh sách uid khách được xem phòng (duy trì khi chốt inquiry, tạo hợp đồng, liên kết tài khoản).
- Hóa đơn tạo hàng loạt có id cố định `inv_<contractId>_<YYYY-MM>` (chống trùng). Báo chuyển khoản: `paymentReports/pr_<invoiceId>`.
- Nhắc nợ: `reminderLogs` (nhật ký mỗi lần nhắc), `settings/reminders` (bật/tắt email tự động), script `reminders/` chạy bằng GitHub Actions.
