# FB Media Automation Downloader & Editor 🚀

Công cụ tự động hóa tải video và Reels từ Facebook kèm tính năng chỉnh sửa hậu kỳ tự động.

## ✨ Tính năng
- **Tải hàng loạt Reels**: Tự động quét và tải toàn bộ Reels từ Profile/Page.
- **Lưu nội dung văn bản**: Mỗi video tải về đều kèm theo file `.txt` chứa mô tả (caption).
- **Tự động cắt ghép (Auto Edit)**: Sử dụng FFmpeg để tự động xử lý video (cắt đầu/đuôi, scale...) ngay sau khi tải.
- **Trình duyệt thực**: Vượt qua Captcha và bảo mật Facebook dễ dàng.

## 🛠 Cài đặt

1. Đảm bảo máy tính đã cài đặt [Node.js](https://nodejs.org/).
2. Cài đặt các thư viện:
```bash
npm install
```

## 🚀 Cách sử dụng

### 1. Tải thông thường (Video + Text)
```bash
node chat_downloader.js --url "LINK_CỦA_BẠN"
```

### 2. Tải + Tự động cắt video (Auto Edit)
Sử dụng thêm tham số `--edit` để hệ thống tự động cắt bỏ 1 giây đầu và cuối:
```bash
node chat_downloader.js --url "LINK_CỦA_BẠN" --edit
```

### 3. Tải + Tự động viết lại Caption (AI Rewrite)
Sử dụng thêm tham số `--rewrite` để AI tự động viết lại nội dung mô tả hấp dẫn hơn:
```bash
node chat_downloader.js --url "LINK_CỦA_BẠN" --rewrite
```
*Lưu ý: Có thể kết hợp cả `--edit` và `--rewrite`.*


## 📂 Cấu trúc thư mục
- `chat_downloader.js`: File điều khiển chính.
- `scripts/editor.js`: Module xử lý video (FFmpeg).
- `downloads/`: Video được chia vào từng thư mục riêng (Video + Text).

---
*Lưu ý: Tính năng chỉnh sửa tự động yêu cầu thư viện FFmpeg (đã được tích hợp sẵn).*
