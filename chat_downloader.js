import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import { download, createIfNotExistDir, sleep, saveToFile } from "./scripts/utils.js";
import { processVideo } from "./Skill/editor.js";
import { rewriteCaption } from "./Skill/rewriter.js";
import { schedulePost } from "./Skill/scheduler.js";

puppeteer.use(StealthPlugin());

const args = process.argv.slice(2);
const targetUrl = args.indexOf("--url") !== -1 ? args[args.indexOf("--url") + 1] : null;
const isEditMode = args.includes("--edit");
const isRewriteMode = args.includes("--rewrite");
const uploadPageName = args.indexOf("--upload") !== -1 ? args[args.indexOf("--upload") + 1] : null;

const PROFILE_DIR = "./chrome_profile";
const SAVE_DIR = "downloads/reels_download";


async function launchBrowser() {
  const chromePaths = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"];
  let executablePath = null;
  for (const p of chromePaths) { if (fs.existsSync(p)) { executablePath = p; break; } }
  return await puppeteer.launch({
    headless: false, // Bật UI để test upload
    executablePath, defaultViewport: null, userDataDir: PROFILE_DIR, ignoreDefaultArgs: ["--enable-automation"],
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-notifications", "--disable-blink-features=AutomationControlled", "--start-maximized"],
  });
}

async function extractAndDownloadMobile(page, url, customSaveDir = SAVE_DIR, postIndex = 0) {
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
        if (v && v.src && v.src.startsWith("https") && !v.src.includes("blob:")) videoUrl = v.src;
        else {
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
      const videoFolder = path.join(customSaveDir, baseName);
      createIfNotExistDir(videoFolder);
      
      const videoPath = path.join(videoFolder, `${baseName}.mp4`);
      // Chạy song cycle quá trình tải video và viết lại caption
      const downloadPromise = download(data.videoUrl, videoPath);
      
      let rewritePromise = Promise.resolve(data.caption);
      if (data.caption && data.caption.length > 3 && isRewriteMode) {
        rewritePromise = rewriteCaption(data.caption);
      }

      // Chờ cả 2 tiến trình hoàn thành
      await downloadPromise;
      const finalCaption = await rewritePromise;
      
      if (finalCaption && finalCaption.length > 3) {
        saveToFile(path.join(videoFolder, `${baseName}.txt`), finalCaption, true);
      }

      
      let finalVideoPath = videoPath;
      if (isEditMode) {
        try {
          finalVideoPath = await processVideo(videoPath, { 
            trimStart: 1, // Cắt 1s đầu
            trimEnd: 1,   // Cắt 1s đuôi
            deleteOriginal: true 
          });
        } catch (e) { console.error("⚠️ Không thể chỉnh sửa video này."); }
      }
      
      console.log(`✅ Hoàn tất thư mục: ${baseName}`);
      console.log(`📁 File video: ${finalVideoPath}`);
      console.log(`📝 File caption: ${path.join(videoFolder, `${baseName}.txt`)}`);
      
      if (uploadPageName) {
        console.log(`⏸️ (Tính năng Lên Lịch Tự Động đã được tắt): Anh có thể truy cập Meta Business Suite của Page ID ${uploadPageName} để upload thủ công nhé!`);
        // await schedulePost(page, uploadPageName, finalVideoPath, finalCaption, postIndex);
      }

      if (isRewriteMode) await sleep(5000); // Chờ 5s để tránh Rate Limit API
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
    let reelsUrl = finalUrl.split("?")[0].replace(/\/$/, "");
    if (!reelsUrl.endsWith("/reels")) reelsUrl += "/reels/";
    if (finalUrl.includes("profile.php?id=")) reelsUrl = `https://www.facebook.com/profile.php?id=${new URL(finalUrl).searchParams.get("id")}&sk=reels`;
    
    console.log(`📂 Chuyển hướng đến Reels: ${reelsUrl}`);
    await page.goto(reelsUrl, { waitUntil: "networkidle2" });
    let reelLinks = new Set();
    let previousSize = 0;
    for (let i = 0; i < 20; i++) {
      const links = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes("/reel/")));
      links.forEach(l => reelLinks.add(l.split('?')[0])); // Clean URL
      if (reelLinks.size > 0 && reelLinks.size === previousSize && i > 5) break; 
      previousSize = reelLinks.size;
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await sleep(3000);
      process.stdout.write(`\r🔍 Đã tìm thấy: ${reelLinks.size} video...`);
    }
    process.stdout.write("\n");
    const linksArray = Array.from(reelLinks);
    console.log(`🚀 Tải ${linksArray.length} video (Edit: ${isEditMode}, Rewrite: ${isRewriteMode})...`);
    let pageName = "bulk";
    try {
      const urlObj = new URL(finalUrl);
      if (urlObj.pathname.includes("profile.php")) {
        pageName = urlObj.searchParams.get("id") || "bulk";
      } else {
        const parts = urlObj.pathname.split("/").filter(Boolean);
        pageName = parts[0] === "share" ? parts[1] || "bulk" : parts[0];
      }
    } catch(e) {}

    let postIndex = 0;
    for (const link of linksArray) { 
      await extractAndDownloadMobile(page, link, path.join(SAVE_DIR, pageName), postIndex); 
      postIndex++;
    }
  } else {
    await extractAndDownloadMobile(page, finalUrl, SAVE_DIR, 0);
  }
  
  console.log("🛑 (Chế độ Học Việc): Không tự động đóng trình duyệt để anh thao tác tiếp.");
  // await browser.close();
}

if (targetUrl) {
  handleDownload(targetUrl).catch(e => console.error(e));
}
