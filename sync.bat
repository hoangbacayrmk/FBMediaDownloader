@echo off
chcp 65001 > nul
echo =======================================================
echo DANG DONG BO MA NGUON LEN GITHUB CUA ANH...
echo =======================================================
echo.

:: Kiem tra trang thai Git
echo Trang thai cac file thay doi:
git status -s
echo.

:: Nhap thong tin ghi chu
set "commit_msg=Cap nhat ma nguon tu dong %date% %time%"
set /p user_msg="Nhap ghi chu thay doi (An Enter de dung mac dinh): "
if not "%user_msg%"=="" (
    set "commit_msg=%user_msg%"
)

echo.
echo 1. Dang them cac thay doi vao Git...
git add .

echo 2. Dang luu ban thay doi (Commit)...
git commit -m "%commit_msg%"

echo 3. Dang day len GitHub cua anh (Push)...
git push origin master

echo.
echo =======================================================
echo TIEN TRINH HOAN TAT!
echo =======================================================
pause
