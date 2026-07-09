import { log } from "./logger.js";
import * as OTPAuth from "otpauth";
import { sleep, createIfNotExistDir } from "./utils.js";
import fs from "fs";
import "dotenv/config";

/**
 * Kiểm tra xem đã đăng nhập chưa. Nếu chưa, tự động đăng nhập.
 * Quá trình đăng nhập sử dụng m.facebook.com để đơn giản hóa giao diện.
 * 
 * @param {import('puppeteer').Page} page
 */
export async function ensureLoggedIn(page) {
  log("INFO", "🔍 Kiểm tra trạng thái đăng nhập Facebook...");
  
  // Giữ nguyên User Agent gốc của Windows/Chrome (Desktop) thay vì chuyển sang iPhone
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  
  await page.goto("https://www.facebook.com/", { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  
  const isLoginFormPresent = await page.evaluate(() => {
    return !!document.querySelector('input[id="email"]') || !!document.querySelector('input[name="email"]');
  });

  if (!isLoginFormPresent) {
    log("INFO", "✅ Đã đăng nhập từ trước (session còn hạn).");
    return true;
  }

  log("WARN", "⚠️ Chưa đăng nhập hoặc session hết hạn. Đang tiến hành tự động đăng nhập...");

  const email = process.env.FB_EMAIL;
  const password = process.env.FB_PASSWORD;
  const twoFactorSecret = process.env.FB_2FA_SECRET;

  if (!email || !password || email === "your_facebook_email" || password === "your_facebook_password") {
    throw new Error("❌ Không tìm thấy FB_EMAIL hoặc FB_PASSWORD trong .env. Vui lòng cấu hình để tự động đăng nhập.");
  }

  log("INFO", `🔑 Đang đăng nhập với tài khoản: ${email}`);
  
  const emailInput = await page.$('input[id="email"]') || await page.$('input[name="email"]');
  const passInput = await page.$('input[id="pass"]') || await page.$('input[name="pass"]');
  
  if (emailInput && passInput) {
    await emailInput.type(email, { delay: 50 });
    await passInput.type(password, { delay: 50 });
    
    // Bấm nút Đăng nhập trên giao diện Desktop
    // Bấm nút Đăng nhập bằng Puppeteer native click (tránh dùng form.submit() vì FB sẽ block bot)
    const loginBtn = await page.$('button[name="login"]');
    if (loginBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {}),
        loginBtn.click()
      ]);
    } else {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {}),
        page.keyboard.press('Enter')
      ]);
    }
  } else {
    throw new Error("❌ Không tìm thấy ô nhập email/password trên trang facebook.com");
  }

  await sleep(3000);

  // Kiểm tra yêu cầu mã 2FA
  const is2FAPresent = await page.evaluate(() => {
    return !!document.querySelector('input[name="approvals_code"]') || 
           document.body.innerText.toLowerCase().includes("enter login code") || 
           document.body.innerText.toLowerCase().includes("nhập mã đăng nhập") ||
           document.body.innerText.toLowerCase().includes("two-factor") ||
           document.body.innerText.toLowerCase().includes("ứng dụng xác thực") ||
           document.body.innerText.toLowerCase().includes("6 chữ số");
  });

  if (is2FAPresent) {
    if (!twoFactorSecret || twoFactorSecret === "your_2fa_secret_here") {
      throw new Error("❌ Tài khoản yêu cầu mã 2FA nhưng chưa cấu hình FB_2FA_SECRET trong .env!");
    }
    log("INFO", "🛡️ Phát hiện yêu cầu xác thực 2 yếu tố (2FA). Đang tạo mã...");

    let totp = new OTPAuth.TOTP({
      issuer: "Facebook",
      label: "User",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: twoFactorSecret.replace(/\s+/g, ""), // Xóa khoảng trắng thừa
    });

    const code = totp.generate();
    log("INFO", `🔢 Đã tạo mã OTP: ${code}`);

    const twoFactorInput = await page.$('input[id="approvals_code"]') || 
                           await page.$('input[name="approvals_code"]') || 
                           await page.$('input[type="text"]'); // Thường ô nhập mã là ô text duy nhất trên màn hình này
    
    if (twoFactorInput) {
      await twoFactorInput.type(code, { delay: 50 });
      
      // Submit mã 2FA bằng click hoặc Enter
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {}),
        page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(b => {
             const t = (b.innerText || "").toLowerCase();
             return t.includes("tiếp tục") || t.includes("continue") || t.includes("gửi mã") || t.includes("submit");
          });
          if (btn) btn.click();
        })
      ]);
      await sleep(3000);
    } else {
      log("WARN", "⚠️ Không tìm thấy ô nhập mã 2FA. Đang lưu ảnh chụp màn hình để debug...");
      createIfNotExistDir("downloads");
      await page.screenshot({ path: "downloads/2fa_error.png" });
      throw new Error("Không tìm thấy ô nhập mã 2FA.");
    }

    // Xử lý màn hình "Save Browser" (Lưu trình duyệt) nếu có
    const isSaveBrowserPresent = await page.evaluate(() => {
      const btn = document.querySelector('button[value="Continue"]') || 
                  document.querySelector('input[value="Tiếp tục"]') ||
                  document.querySelector('button[id="checkpointSubmitButton"]') ||
                  document.querySelector('input[type="submit"]');
      return !!btn;
    });

    if (isSaveBrowserPresent) {
      log("INFO", "💾 Nhấn tiếp tục/lưu trình duyệt...");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {}),
        page.evaluate(() => {
          const btn = document.querySelector('button[value="Continue"]') || 
                      document.querySelector('input[value="Tiếp tục"]') ||
                      document.querySelector('button[id="checkpointSubmitButton"]') ||
                      document.querySelector('input[type="submit"]');
          if (btn) btn.click();
        })
      ]);
      await sleep(3000);
    }
  }

  // Check login success bằng cách kiểm tra các phần tử của màn hình chính (feed/navigation)
  // thay vì chỉ kiểm tra xem form login có biến mất không (vì đôi khi bị treo ở màn hình loading)
  try {
    await page.waitForSelector('div[role="navigation"], div[role="feed"], input[type="search"], svg[aria-label="Facebook"]', { timeout: 10000 });
  } catch (err) {
    createIfNotExistDir("downloads");
    await page.screenshot({ path: "downloads/login_failed.png", fullPage: true });
    throw new Error("❌ Đăng nhập thất bại hoặc bị kẹt. Vui lòng xem ảnh downloads/login_failed.png.");
  }

  log("INFO", "✅ Đăng nhập thành công! Session đã được lưu.");
  return true;
}
