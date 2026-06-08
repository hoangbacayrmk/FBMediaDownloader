import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";

puppeteer.use(StealthPlugin());

const PROFILE_DIR = "./chrome_profile";

async function openBrowser() {
  const chromePaths = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"];
  let executablePath = null;
  for (const p of chromePaths) { if (fs.existsSync(p)) { executablePath = p; break; } }
  
  console.log("Mở trình duyệt...");
  const browser = await puppeteer.launch({
    headless: false, // Bật chế độ có UI để người dùng thao tác
    executablePath, 
    defaultViewport: null, 
    userDataDir: PROFILE_DIR, 
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-notifications", "--disable-blink-features=AutomationControlled", "--start-maximized"],
  });
  
  const page = await browser.newPage();
  await page.goto("https://www.facebook.com/pages/create/?ref_type=pages_browser");
  console.log("✅ Trình duyệt đã mở! Anh thao tác tạo Fanpage nhé. Đóng trình duyệt khi xong.");
}

openBrowser();
