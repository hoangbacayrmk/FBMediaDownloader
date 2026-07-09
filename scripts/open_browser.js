import { launchBrowser } from "./browser_config.js";

async function openBrowser() {
  console.log("Mở trình duyệt...");
  const browser = await launchBrowser({ headless: false });

  const page = await browser.newPage();
  await page.goto("https://www.facebook.com/pages/create/?ref_type=pages_browser");
  console.log("✅ Trình duyệt đã mở! Anh thao tác tạo Fanpage nhé. Đóng trình duyệt khi xong.");
}

openBrowser();
