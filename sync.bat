@echo off
chcp 65001 > nul
echo =======================================================
echo 🚀 ĐANG ĐỒNG BỘ MÃ NGUỒN LÊN GITHUB CỦA ANH...
echo =======================================================
echo.

:: Kiểm tra trạng thái Git
echo 🔍 Trạng thái các file thay đổi:
git status -s
echo.

:: Nhập thông tin ghi chú
set "commit_msg=Cập nhật mã nguồn tự động %date% %time%"
set /p user_msg="✍️ Nhập ghi chú thay đổi (Ấn Enter để dùng mặc định): "
if not "%user_msg%"=="" (
    set "commit_msg=%user_msg%"
)

echo.
echo 📦 1. Đang thêm các thay đổi vào Git...
git add .

echo 💾 2. Đang lưu bản thay đổi (Commit)...
git commit -m "%commit_msg%"

echo 📤 3. Đang đẩy lên GitHub của anh (Push)...
git push origin master

echo.
echo =======================================================
echo ✅ TIẾN TRÌNH HOÀN TẤT!
echo =======================================================
pause
