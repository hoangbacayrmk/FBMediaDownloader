# FB Media Automation Downloader & Editor 🚀

Công cụ tự động hóa tải video và Reels từ Facebook kèm tính năng chỉnh sửa hậu kỳ tự động.

## ✨ Tính năng
- **Tải hàng loạt Reels**: Tự động quét và tải toàn bộ Reels từ Profile/Page.
- **Tải hàng loạt bài viết ẢNH** (`--photos`): Quét Timeline/Feed, tự lọc bài có ảnh và tải về — chế độ song song, tách biệt hoàn toàn với chế độ Reels.
- **Lưu nội dung văn bản**: Mỗi video/bài viết tải về đều kèm theo file `.txt` chứa mô tả (caption).
- **Tự động cắt ghép (Auto Edit)**: Sử dụng FFmpeg để tự động xử lý video (cắt đầu/đuôi, scale...) ngay sau khi tải.
- **Trình duyệt thực**: Vượt qua Captcha và bảo mật Facebook dễ dàng.
- **Chống Bot Detection (Anti-Ban)**: Scroll mượt kiểu người thật (random tốc độ/độ trễ), delay ngẫu nhiên giữa các lượt tải, chặn tải ảnh/media/font khi quét để giảm tải RAM.
- **Tối ưu CPU**: Preset FFmpeg `ultrafast` giúp xử lý video nhanh hơn, nhẹ máy hơn.

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

### 4. Tải bài viết ẢNH (chế độ song song với Reels)
Dùng tham số `--photos` để chuyển sang quét Timeline/Feed và tải bài viết có ảnh thay vì Reels:
```bash
node chat_downloader.js --url "LINK_PROFILE_HOẶC_PAGE" --photos
```
Có thể kết hợp `--rewrite` để viết lại caption bằng AI. Ảnh và caption được lưu **tách 2 nhánh
thư mục riêng biệt** (xem cấu trúc bên dưới), không lẫn với video Reels.


## 📂 Cấu trúc thư mục
- `chat_downloader.js`: File điều khiển chính.
- `scripts/editor.js`: Module xử lý video (FFmpeg).
- `Skill/photoDownloader.js`: Module quét & tải bài viết ảnh (chế độ `--photos`).
- `downloads/reels_download/<page>/<baseName>/`: Video Reels — mỗi video 1 thư mục (video `.mp4` + caption `.txt`).
- `downloads/photos_download/<page>/images/<page>_<postId>/`: Ảnh của từng bài viết.
- `downloads/photos_download/<page>/texts/<page>_<postId>.txt`: Caption tương ứng, lưu tách riêng khỏi ảnh.

---
*Lưu ý: Tính năng chỉnh sửa tự động yêu cầu thư viện FFmpeg (đã được tích hợp sẵn).*
