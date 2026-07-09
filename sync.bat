@echo off
chcp 65001 > nul
echo =======================================================
echo    DONG BO MA NGUON LEN GITHUB
echo =======================================================
echo.
echo Luu y: Nen dung "npm run sync" thay vi file .bat nay
echo        de dam bao token duoc bao ve an toan.
echo.

:: Kiem tra trang thai Git
echo Trang thai cac file thay doi:
git status -s
echo.

:: Kiem tra co thay doi khong
git diff --quiet --cached 2>nul
git diff --quiet 2>nul
for /f %%i in ('git status -s') do (
    goto HAS_CHANGES
)
echo Khong co thay doi gi moi. Thoat.
goto END

:HAS_CHANGES
:: Stage va commit
echo 1. Dang them cac thay doi vao Git...
git add .

echo 2. Dang luu ban thay doi (Commit)...
:: Dung ngay gio lam commit message mac dinh (tranh injection tu user input)
git commit -m "Cap nhat: %date% %time:~0,8%"

echo 3. Dang day len GitHub...
:: Luu y: Can npm run sync de co token authentication
:: Neu push truc tiep bang bat, can cau hinh credential helper truoc:
::   git config --global credential.helper manager
git push origin master

echo.
echo =======================================================
echo HOAN TAT!
echo =======================================================

:END
pause
