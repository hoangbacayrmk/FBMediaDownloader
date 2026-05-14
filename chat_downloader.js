import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import { download, createIfNotExistDir, sleep, saveToFile } from "./scripts/utils.js";

puppeteer.use(StealthPlugin());

const args = process.argv.slice(2);
const targetUrl = args.indexOf("--url") !== -1 ? args[args.indexOf("--url") + 1] : null;

const PROFILE_DIR = "./chrome_profile";
const SAVE_DIR = "downloads/chat_media";

async function launchBrowser() {
  const chromePaths = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"];
  let executablePath = null;
  for (const p of chromePaths) { if (fs.existsSync(p)) { executablePath = p; break; } }
  return await puppeteer.launch({
    headless: "new", executablePath, defaultViewport: null, userDataDir: PROFILE_DIR, ignoreDefaultArgs: ["--enable-automation"],
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-notifications", "--disable-blink-features=AutomationControlled", "--start-maximized"],
  });
}

async function extractAndDownloadMobile(page, url, customSaveDir = SAVE_DIR) {
  console.log(`🌐 Đang xử lý: ${url}`);
  try {
    const mobileUrl = url.replace("www.facebook.com", "m.facebook.com");
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1");
    
    await page.goto(mobileUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(6000);

    const data = await page.evaluate(() => {
      let videoUrl = null;
      const html = document.documentElement.innerHTML;
      const hdMatch = html.match(/"browser_native_hd_url":"(.*?)"/) || html.match(/"playable_url_quality_hd":"(.*?)"/);
      if (hdMatch && hdMatch[1]) {
        videoUrl = hdMatch[1].replace(/\\/g, "");
      } else {
        const v = document.querySelector("video");
        if (v && v.src && v.src.startsWith("https") && !v.src.includes("blob:")) {
          videoUrl = v.src;
        } else {
          const sdMatch = html.match(/"playable_url":"(.*?)"/);
          videoUrl = sdMatch ? sdMatch[1].replace(/\\/g, "") : null;
        }
      }

      let caption = "";
      const ariaLabel = document.querySelector('[aria-label*="caption"], [aria-label*="mô tả"]')?.getAttribute('aria-label');
      if (ariaLabel) caption = ariaLabel;

      if (!caption) {
        const textElements = Array.from(document.querySelectorAll('span, div')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && el.innerText.length > 2 && el.childElementCount === 0;
        });
        const sorted = textElements.sort((a, b) => b.innerText.length - a.innerText.length);
        if (sorted.length > 0) caption = sorted[0].innerText;
      }
      return { videoUrl, caption };
    });

    if (data.videoUrl) {
      console.log(`🔗 Link: ${data.videoUrl.substring(0, 40)}...`);
      const baseName = `reel_${Date.now()}`;
      
      // TẠO THƯ MỤC RIÊNG CHO MỖI VIDEO
      const videoFolder = path.join(customSaveDir, baseName);
      createIfNotExistDir(videoFolder);
      
      // Tải video vào thư mục đó
      await download(data.videoUrl, path.join(videoFolder, `${baseName}.mp4`));
      
      // Lưu text vào thư mục đó
      if (data.caption && data.caption.length > 3) {
        console.log(`📝 Caption: ${data.caption.substring(0, 50)}...`);
        saveToFile(path.join(videoFolder, `${baseName}.txt`), data.caption, true);
      }
      
      console.log(`✅ Hoàn tất thư mục: ${baseName}`);
      return true;
    }
  } catch (err) { console.error("❌ Lỗi: ", err.message); }
  return false;
}

async function handleDownload(inputUrl) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  console.log(`🔗 Quét: ${inputUrl}`);
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.goto(inputUrl, { waitUntil: "networkidle2" });
  const finalUrl = page.url();

  const isBulk = !finalUrl.includes("/videos/") && !finalUrl.includes("/watch") && !finalUrl.includes("/reel/") && !finalUrl.includes("/posts/") && !finalUrl.includes("fbid=");

  if (isBulk) {
    let reelsUrl = finalUrl.split("?")[0].replace(/\/$/, "") + "/reels/";
    if (finalUrl.includes("profile.php?id=")) reelsUrl = `https://www.facebook.com/profile.php?id=${new URL(finalUrl).searchParams.get("id")}&sk=reels`;
    await page.goto(reelsUrl, { waitUntil: "networkidle2" });
    let reelLinks = new Set();
    for (let i = 0; i < 3; i++) {
      const links = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes("/reel/")));
      links.forEach(l => reelLinks.add(l));
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await sleep(3000);
    }
    const linksArray = Array.from(reelLinks);
    console.log(`🚀 Tải ${linksArray.length} video (mỗi video một thư mục riêng)...`);
    const pageName = finalUrl.split("/").filter(Boolean).pop().split("?")[0] || "bulk";
    for (const link of linksArray) { await extractAndDownloadMobile(page, link, path.join(SAVE_DIR, pageName)); }
  } else {
    await extractAndDownloadMobile(page, finalUrl);
  }
  await browser.close();
}

if (targetUrl) {
  handleDownload(targetUrl).catch(e => console.error(e));
}
