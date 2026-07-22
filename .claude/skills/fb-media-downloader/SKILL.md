---
name: fb-media-downloader
description: Tải Reels/video hoặc bài viết ảnh từ Facebook (Profile/Page/link đơn) về máy bằng công cụ Puppeteer sẵn có trong dự án. Dùng khi người dùng yêu cầu tải video, reels, hoặc bài viết ảnh từ một link Facebook.
---

# FB Media Downloader

Dự án này là 1 CLI Node.js (`chat_downloader.js`) dùng Puppeteer (trình duyệt thật, có stealth
plugin) để tải video/Reels và bài viết ảnh từ Facebook, tách ra 2 chế độ độc lập:

- **Chế độ Reels/Video** (mặc định): tải video, tự cắt đầu/đuôi (`--edit`), ghép nhạc (`--music`),
  viết lại caption bằng Gemini (`--rewrite`). Lưu vào `downloads/reels_download/<page>/<baseName>/`
  (video `.mp4` + caption `.txt` chung 1 thư mục).
- **Chế độ Photo Post** (`--photos`): quét Timeline/Feed của Profile/Page, lọc các bài có ảnh, tải
  toàn bộ ảnh của bài + caption. Lưu **tách nhánh thư mục**:
  - Ảnh: `downloads/photos_download/<page>/images/<page>_<postId>/<...>.jpg`
  - Caption: `downloads/photos_download/<page>/texts/<page>_<postId>.txt`

## Khi nào dùng skill này

Khi người dùng đưa 1 link Facebook (profile, page, hoặc bài viết/reel cụ thể) và yêu cầu tải
video/reels hoặc tải ảnh về máy.

## Cách chạy

Luôn chạy trong thư mục gốc dự án (`Download video reels/`). Trước khi chạy lần đầu trong phiên,
kiểm tra file `.env` tồn tại (`npm run validate`); nếu thiếu, nhắc người dùng copy từ `.env.example`.

```bash
# Tải video/reels (1 link hoặc cả trang)
node chat_downloader.js --url "<LINK_FACEBOOK>"

# Tải video kèm auto-edit + viết lại caption AI
node chat_downloader.js --url "<LINK_FACEBOOK>" --edit --rewrite

# Tải bài viết ẢNH (chế độ song song, không đụng luồng video)
node chat_downloader.js --url "<LINK_FACEBOOK>" --photos

# Tải ảnh + viết lại caption AI
node chat_downloader.js --url "<LINK_FACEBOOK>" --photos --rewrite
```

Cờ hữu ích khác: `--headless` (chạy nền không hiện trình duyệt), `--no-close` (giữ trình duyệt mở
sau khi xong để debug), `--trim-start`/`--trim-end` (chỉ áp dụng chế độ video).

## Lưu ý quan trọng

- Lần chạy đầu tiên cần đăng nhập Facebook thủ công trong cửa sổ trình duyệt hiện ra (session được
  lưu ở `chrome_profile/` để không phải đăng nhập lại).
- Cả 2 chế độ đều có manifest chống tải trùng (`downloads/downloaded_urls.json` cho video,
  `downloads/downloaded_photo_urls.json` cho ảnh) — chạy lại cùng 1 link sẽ tự bỏ qua nội dung đã
  tải trước đó.
- Không tự ý xoá `chrome_profile/` hoặc file manifest trừ khi người dùng yêu cầu — sẽ mất session
  đăng nhập / làm tải lại từ đầu.
- Đây là hành động mạng dài (mở trình duyệt thật, tải file), luôn cho người dùng biết lệnh nào sắp
  chạy trước khi chạy nếu output có thể mất nhiều thời gian hoặc chạm tài khoản Facebook cá nhân.
