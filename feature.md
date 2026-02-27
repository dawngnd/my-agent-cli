# Đề xuất tính năng bổ sung cho my-agent-cli

Dưới đây là danh sách các tính năng đề xuất để cải thiện công cụ CLI. Bạn có thể ghi chú hoặc bình luận ý kiến của mình vào bên dưới từng mục trước khi chúng ta bắt đầu implement.

## 1. 🔥 Tải trực tiếp từ GitHub thay vì Local
- **Mô tả:** Cho phép CLI tải trực tiếp các tệp `.md` từ một Repository GitHub cá nhân thay vì lấy từ thư mục `templates` cục bộ.
- **Lợi ích:** Dễ dàng quản lý và cập nhật kiến thức (Rules/Skills) ở một nơi thống nhất. Các dự án chỉ cần chạy CLI để kéo về phiên bản mới nhất.
- **Ý kiến của bạn:** 
tôi muốn sử dụng github api để tải các skill và rule từ github, và có thể tải từ nhiều repository khác nhau thông qua set tham số link github khi chạy cli.

## 2. 🛡️ Cảnh báo Ghi đè file (Overwrite Warning)
- **Mô tả:** Trước khi thực hiện copy (`fs.cpSync`), kiểm tra xem file đích đã tồn tại trong dự án hay chưa. Nếu có, hỏi người dùng: (1) Bỏ qua, (2) Ghi đè, hay (3) Ghi đè tất cả.
- **Lợi ích:** Tránh làm mất các tuỳ chỉnh quy tắc AI mà dự án hiện tại đã sửa đổi.
- **Ý kiến của bạn:** 

## 3. 🔎 Search / Lọc kỹ năng (Searchable Prompt)
- **Mô tả:** Thay vì chỉ kéo thả checkbox, cung cấp thanh tìm kiếm (như `inquirer-autocomplete-prompt`) khi danh sách Rules/Skills ngày càng lớn.
- **Lợi ích:** Tìm kiếm nhanh chóng kỹ năng cần thiết bằng cách gõ từ khoá thay vì cuộn chuột.
- **Ý kiến của bạn:** 


## 4. ⚡ Hỗ trợ tham số dòng lệnh (Non-interactive Mode)
- **Mô tả:** Cung cấp khả năng chạy CLI bằng tham số (ví dụ: `my-agent-cli --skills java-testing --auto-confirm`).
- **Lợi ích:** Khả năng tích hợp vào các script tự động hoá hoặc dùng để cài đặt một lần (one-liner) nhanh gọn không qua tương tác.
- **Ý kiến của bạn:** 
tôi nghĩ bạn hãy thêm tham số --help để giới thiệu về cli, hướng dẫn sử dụng cũng như các tham số có thể sử dụng khi chạy cli.

## 5. 🗑️ Tính năng Gỡ cài đặt / Dọn dẹp (Uninstall / Clean)
- **Mô tả:** Bổ sung tham số xoá (ví dụ: `my-agent-cli clean`) để xoá đi các cấu hình AI do công cụ sinh ra khỏi dự án hiện tại.
- **Lợi ích:** Hỗ trợ dọn dẹp các thư mục `.agent` và `.agents` khi dự án không còn cần dùng hoặc muốn xoá bớt một số kỹ năng đã tải thừa.
- **Ý kiến của bạn:** 

## 6. 🔄 Tích hợp tự động cài cài đặt thư viện đi kèm của Skills
- **Mô tả:** Mỗi skill (nếu cần) có thể kèm theo tệp khai báo phụ thuộc (`dependencies.json`). CLI sẽ đọc file này và hỏi xem người dùng có muốn chạy ngầm lệnh (`npm install`, `mvn install`,... ) để cài đặt công cụ cần thiết hay không.
- **Lợi ích:** Tạo trải nghiệm liền mạch, giúp môi trường chuẩn bị đầy đủ tài nguyên cho AI ngay sau khi tải cấu trúc.
- **Ý kiến của bạn:** 
