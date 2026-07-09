import { launchBrowser } from "./browser_config.js";

async function openComposer() {
  console.log("Mở trình duyệt kiểm tra giao diện Meta Business Suite...");
  const browser = await launchBrowser({ headless: false });

  const page = await browser.newPage();
  await page.goto("https://business.facebook.com/latest/composer?asset_id=61590102560284");
  console.log("✅ Đã mở xong! Anh xem giao diện nhé (Tool sẽ giữ nguyên không tự đóng).");
}

openComposer();
