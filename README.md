# FB Media Automation Downloader 🚀

Công cụ tự động hóa tải video và Reels từ Facebook sử dụng Puppeteer.

## ✨ Tính năng
- **Tải hàng loạt Reels**: Chỉ cần gửi link Profile hoặc Fanpage, công cụ tự động quét và tải toàn bộ Reels.
- **Trình duyệt thực (Real Browser Mode)**: Sử dụng Google Chrome thật để vượt qua các lớp bảo mật và Captcha của Facebook.
- **Duy trì đăng nhập**: Lưu trữ phiên làm việc an toàn tại địa phương, không cần đăng nhập lại nhiều lần.
- **Chất lượng cao nhất**: Tự động nhận diện và ưu tiên tải link Progressive MP4 chất lượng HD.

## 🛠 Cài đặt

1. Đảm bảo máy tính đã cài đặt [Node.js](https://nodejs.org/).
2. Cài đặt các thư viện cần thiết:
```bash
npm install
```

## 🚀 Cách sử dụng

### 1. Đăng nhập (Chỉ làm lần đầu)
Chạy lệnh sau để mở trình duyệt, đăng nhập vào Facebook của bạn rồi đóng trình duyệt lại.
```bash
node chat_downloader.js --login
```

### 2. Tải video/Reels
Gửi link Facebook (Profile, Page hoặc video đơn lẻ):
```bash
node chat_downloader.js --url "LINK_CỦA_BẠN"
```

## 📂 Cấu trúc thư mục
- `chat_downloader.js`: File điều khiển chính.
- `scripts/`: Chứa các tiện ích hỗ trợ.
- `downloads/`: Nơi lưu trữ video tải về (đã được cấu hình ẩn khi upload GitHub).
- `chrome_profile/`: Lưu phiên đăng nhập (đã được cấu hình ẩn khi upload GitHub).

---
*Lưu ý: Công cụ này phục vụ mục đích học tập và cá nhân. Vui lòng tôn trọng quyền sở hữu trí tuệ của nội dung trên Facebook.*
