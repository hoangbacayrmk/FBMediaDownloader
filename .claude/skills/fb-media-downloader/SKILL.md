---
name: fb-media-downloader
description: Tải Reels/video từ Facebook (Profile/Page/link đơn) về máy bằng công cụ Puppeteer sẵn có trong dự án. Dùng khi người dùng yêu cầu tải video hoặc reels từ một link Facebook.
---

# FB Media Downloader

Dự án này là 1 CLI Node.js (`chat_downloader.js`) dùng Puppeteer (trình duyệt thật, có stealth
plugin) để tải video/Reels từ Facebook: tự cắt đầu/đuôi (`--edit`), ghép nhạc (`--music`), viết
lại caption bằng Gemini (`--rewrite`). Lưu vào `downloads/reels_download/<page>/<baseName>/`
(video `.mp4` + caption `.txt` chung 1 thư mục).

## Khi nào dùng skill này

Khi người dùng đưa 1 link Facebook (profile, page, hoặc video/reel cụ thể) và yêu cầu tải
video/reels về máy.

## Cách chạy

Luôn chạy trong thư mục gốc dự án (`Download video reels/`). Trước khi chạy lần đầu trong phiên,
kiểm tra file `.env` tồn tại (`npm run validate`); nếu thiếu, nhắc người dùng copy từ `.env.example`.

```bash
# Tải video/reels (1 link hoặc cả trang)
node chat_downloader.js --url "<LINK_FACEBOOK>"

# Tải video kèm auto-edit + viết lại caption AI
node chat_downloader.js --url "<LINK_FACEBOOK>" --edit --rewrite
```

Cờ hữu ích khác: `--headless` (chạy nền không hiện trình duyệt), `--no-close` (giữ trình duyệt mở
sau khi xong để debug), `--trim-start`/`--trim-end`, `--music`.

## Lưu ý quan trọng

- Lần chạy đầu tiên cần đăng nhập Facebook thủ công trong cửa sổ trình duyệt hiện ra (session được
  lưu ở `chrome_profile/` để không phải đăng nhập lại).
- Có manifest chống tải trùng (`downloads/downloaded_urls.json`) — chạy lại cùng 1 link sẽ tự bỏ
  qua video đã tải trước đó.
- Không tự ý xoá `chrome_profile/` hoặc file manifest trừ khi người dùng yêu cầu — sẽ mất session
  đăng nhập / làm tải lại từ đầu.
- Đây là hành động mạng dài (mở trình duyệt thật, tải file), luôn cho người dùng biết lệnh nào sắp
  chạy trước khi chạy nếu output có thể mất nhiều thời gian hoặc chạm tài khoản Facebook cá nhân.
- Tính năng "quét toàn bộ bài viết ẢNH trên Timeline" đã thử và bị gỡ bỏ (2026-07-22): Facebook
  mobile hiện dùng kiến trúc SPA không có link bài viết dạng `<a href>` thật, không phản hồi
  scroll giả lập, và không thể click ổn định do DOM ảo hóa. Muốn làm lại cần nghiên cứu bắt
  network response (GraphQL/AJAX) riêng, không phải sửa nhỏ.
