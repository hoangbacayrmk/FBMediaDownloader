import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";

puppeteer.use(StealthPlugin());

const PROFILE_DIR = "./chrome_profile";

async function openComposer() {
  const chromePaths = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"];
  let executablePath = null;
  for (const p of chromePaths) { if (fs.existsSync(p)) { executablePath = p; break; } }
  
  console.log("Mở trình duyệt kiểm tra giao diện Meta Business Suite...");
  const browser = await puppeteer.launch({
    headless: false, // Hiển thị UI
    executablePath, 
    defaultViewport: null, 
    userDataDir: PROFILE_DIR, 
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-notifications", "--disable-blink-features=AutomationControlled", "--start-maximized"],
  });
  
  const page = await browser.newPage();
  await page.goto("https://business.facebook.com/latest/composer?asset_id=61590102560284");
  console.log("✅ Đã mở xong! Anh xem giao diện nhé (Tool sẽ giữ nguyên không tự đóng).");
}

openComposer();
