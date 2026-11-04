# Nhắc nợ tự động qua email (không cần gói Blaze)

Mỗi sáng 8 giờ (giờ Việt Nam), GitHub Actions chạy `send-reminders.mjs`: đọc Firestore bằng Admin SDK,
tìm hóa đơn cần nhắc và gửi email cho khách. Chạy từ ngoài Google nên **gói Spark miễn phí vẫn dùng được**.

## Khi nào gửi
Trước hạn N ngày (cài trong app), đúng ngày hạn, sau hạn 1, 3, 7 ngày rồi mỗi 7 ngày.
Bỏ qua: hóa đơn đã trả, khách đã bấm "Tôi đã chuyển khoản" (đang chờ xác nhận), hóa đơn đã nhắc trong ngày,
khách chưa có email. Mỗi khách và mỗi phòng nhận tối đa một email mỗi ngày (gộp các hóa đơn).
Mỗi lần gửi được ghi vào `reminderLogs` (kênh "email tự động") và hiện ở trang Hóa đơn, Báo cáo.

## Cài đặt (làm một lần)

### 1. Tạo tài khoản dịch vụ riêng, chỉ có quyền Firestore
1. Mở [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts), chọn đúng project `nhatrook`.
2. **Create service account** → tên `nhatro-reminders` → cấp vai trò **Cloud Datastore User** → xong.
3. Vào tài khoản vừa tạo → tab **Keys** → **Add key** → **Create new key** → **JSON**. Một file `.json` được tải về.

> Khóa này truy cập được dữ liệu thật. Đừng gửi qua chat, đừng commit vào repo. Chỉ dán vào GitHub Secrets ở bước 3.
> Nên tạo tài khoản riêng như trên, không dùng lại khóa deploy Hosting hay khóa "Firebase Admin SDK" có quyền rộng.

### 2. Chuẩn bị tài khoản gửi email (SMTP)
Dùng bất kỳ dịch vụ nào có SMTP. Ví dụ:
- **Gmail**: bật xác minh 2 bước, tạo "Mật khẩu ứng dụng". `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<email của bạn>`, `SMTP_PASS=<mật khẩu ứng dụng>`.
- **Brevo, Resend hoặc dịch vụ tương tự**: lấy thông số SMTP trong trang quản trị của họ. Hạn mức miễn phí tùy từng nơi, hãy kiểm tra trang giá hiện hành.

### 3. Thêm Secrets vào GitHub
Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Giá trị |
|---|---|
| `FIREBASE_ADMIN_KEY` | Toàn bộ nội dung file JSON ở bước 1 |
| `SMTP_HOST` | Ví dụ `smtp.gmail.com` |
| `SMTP_PORT` | `465` hoặc `587` |
| `SMTP_USER` | Tên đăng nhập SMTP |
| `SMTP_PASS` | Mật khẩu SMTP / mật khẩu ứng dụng |
| `MAIL_FROM` | Địa chỉ người gửi, ví dụ `Nhà trọ Hoa Sữa <email@domain.com>` |

Khi chưa có `FIREBASE_ADMIN_KEY`, workflow tự bỏ qua, không báo lỗi mỗi ngày.

### 4. Chạy thử
Repo → **Actions** → **Nhắc nợ tự động** → **Run workflow** (để ô "Chỉ mô phỏng" được bật) → đọc log.
Log chỉ in số lượng và email đã che (`a***@gmail.com`), vì log của repo public ai cũng xem được.
Khi thấy danh sách hợp lý, chạy lại với "Chỉ mô phỏng" tắt để thử gửi thật.

### 5. Bật trong app
Cài đặt → Chỉnh đơn giá → mục **Nhắc nợ tự động qua email** → bật → Lưu.
Khi tắt, lần chạy theo lịch không gửi gì.

## Lưu ý
- GitHub tự tắt workflow theo lịch nếu repo không có hoạt động nào trong 60 ngày. Nếu thấy email ngừng gửi, vào tab Actions bật lại.
- Giờ chạy có thể trễ vài phút đến vài chục phút khi GitHub bận.
- Mỗi lần chạy gửi tối đa 100 email (`MAX_EMAILS`).
- Chạy thử trên máy: `FIREBASE_ADMIN_KEY='...' DRY_RUN=1 node --experimental-strip-types reminders/send-reminders.mjs` (cần Node 22).
- Rules Firestore không áp dụng cho Admin SDK, nên script đọc được mọi collection. Vì vậy khóa chỉ nên có vai trò Cloud Datastore User.
