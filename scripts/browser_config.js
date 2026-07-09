/**
 * Browser Configuration Module
 * Tập trung toàn bộ cấu hình Puppeteer vào 1 nơi duy nhất.
 * Tất cả các file cần mở browser đều import từ đây.
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";

puppeteer.use(StealthPlugin());

const PROFILE_DIR = "./chrome_profile";

/**
 * Tìm Chrome đã cài trên máy (Windows).
 * Nếu không tìm thấy → trả về null (Puppeteer sẽ dùng Chromium bundled).
 */
function findChromeExecutable() {
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const p of chromePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Khởi chạy browser với cấu hình chuẩn.
 * @param {object} [options]
 * @param {boolean} [options.headless=false] - Chạy nền (không hiện UI).
 * @param {string}  [options.profileDir]     - Thư mục profile Chrome (mặc định: ./chrome_profile).
 * @returns {Promise<import('puppeteer').Browser>}
 */
export async function launchBrowser(options = {}) {
  const headless = options.headless || false;
  const profileDir = options.profileDir || PROFILE_DIR;

  const executablePath = findChromeExecutable();

  const browser = await puppeteer.launch({
    headless,
    executablePath,
    defaultViewport: null,
    userDataDir: profileDir,
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-notifications",
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
    ],
  });

  return browser;
}

/**
 * Graceful shutdown — đóng browser an toàn khi process bị kill.
 * Gọi hàm này sau khi launch browser để đăng ký cleanup handlers.
 * @param {import('puppeteer').Browser} browser
 */
export function registerGracefulShutdown(browser) {
  let isClosing = false;

  const cleanup = async (signal) => {
    if (isClosing) return;
    isClosing = true;
    console.log(`\n🛑 Nhận tín hiệu ${signal}, đang đóng trình duyệt...`);
    try {
      await browser.close();
      console.log("✅ Đã đóng trình duyệt an toàn.");
    } catch (err) {
      console.error("⚠️ Lỗi khi đóng browser:", err.message);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => cleanup("SIGINT"));
  process.on("SIGTERM", () => cleanup("SIGTERM"));
  process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
    cleanup("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled Rejection:", reason);
    cleanup("unhandledRejection");
  });
}

export { puppeteer };
