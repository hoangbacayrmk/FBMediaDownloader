// ============================================================
//  Photo Post Downloader — chế độ SONG SONG với Reels Downloader.
//  Quét Timeline/Feed của Profile/Page, lọc bài viết có ẢNH,
//  tải ảnh vào 1 nhánh thư mục và caption vào 1 nhánh thư mục khác.
// ============================================================

import path from "path";
import fs from "fs";
import { download, createIfNotExistDir, sleep, saveToFile } from "../scripts/utils.js";
import { launchBrowser, registerGracefulShutdown } from "../scripts/browser_config.js";
import { ensureLoggedIn } from "../scripts/auto_login.js";
import { extractCaption, extractPostImages, extractPostId } from "../scripts/pageHelpers.js";
import { rewriteCaption } from "./rewriter.js";

const PHOTO_SAVE_DIR = "downloads/photos_download";
const PHOTO_MANIFEST_FILE = "downloads/downloaded_photo_urls.json";

function loadPhotoManifest() {
  if (!fs.existsSync(PHOTO_MANIFEST_FILE)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(PHOTO_MANIFEST_FILE, "utf-8"));
    return new Set(data);
  } catch {
    return new Set();
  }
}

function savePhotoManifest(downloadedSet, url) {
  downloadedSet.add(url);
  const dir = path.dirname(PHOTO_MANIFEST_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PHOTO_MANIFEST_FILE, JSON.stringify([...downloadedSet], null, 2));
}

/**
 * Tải 1 bài viết ảnh: N ảnh → downloads/photos_download/<page>/images/<baseName>/
 *                       1 caption → downloads/photos_download/<page>/texts/<baseName>.txt
 */
async function extractAndDownloadPhotoPost(page, url, pageName, isRewriteMode) {
  console.log(`\n🖼️ Đang xử lý bài viết: ${url}`);
  try {
    const mobileUrl = url.replace("www.facebook.com", "m.facebook.com");
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    );
    await page.goto(mobileUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(4000);

    const caption = await extractCaption(page);
    const imageUrls = await extractPostImages(page);

    if (imageUrls.length === 0) {
      console.log("⏭️ Không tìm thấy ảnh trong bài viết này (có thể là bài video/text) — bỏ qua.");
      return false;
    }

    const postId = extractPostId(url) || `post_${Date.now()}`;
    const baseName = `${pageName}_${postId}`;

    const imagesDir = path.join(PHOTO_SAVE_DIR, pageName, "images", baseName);
    const textsDir = path.join(PHOTO_SAVE_DIR, pageName, "texts");
    createIfNotExistDir(imagesDir);
    createIfNotExistDir(textsDir);

    let downloaded = 0;
    for (let i = 0; i < imageUrls.length; i++) {
      const imgPath = path.join(imagesDir, `${baseName}_${i + 1}.jpg`);
      try {
        await download(imageUrls[i], imgPath);
        downloaded++;
      } catch (e) {
        console.error(`⚠️ Lỗi tải ảnh ${i + 1}/${imageUrls.length}:`, e.message);
      }
    }

    if (downloaded === 0) {
      console.log("⚠️ Không tải được ảnh nào, bỏ qua bài viết này.");
      return false;
    }

    let finalCaption = caption;
    if (caption && caption.length > 3 && isRewriteMode) {
      finalCaption = await rewriteCaption(caption);
    }
    if (finalCaption && finalCaption.length > 3) {
      saveToFile(path.join(textsDir, `${baseName}.txt`), finalCaption, true);
    }

    console.log(`✅ Hoàn tất bài viết: ${baseName} (${downloaded}/${imageUrls.length} ảnh)`);
    console.log(`📁 Thư mục ảnh: ${imagesDir}`);
    console.log(`📝 File caption: ${path.join(textsDir, `${baseName}.txt`)}`);
    return true;
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
    return false;
  }
}

/**
 * Điểm vào chính của chế độ tải bài viết ẢNH.
 * Không đụng tới luồng tải Reels — chạy song song, độc lập.
 */
export async function handlePhotoDownload(inputUrl, options = {}) {
  const { headless = false, noClose = false, isRewriteMode = false } = options;

  const browser = await launchBrowser({ headless });
  registerGracefulShutdown(browser);
  const page = await browser.newPage();

  await ensureLoggedIn(page);

  // Chế độ ảnh cần load ảnh thật nên KHÔNG chặn resourceType "image".
  // Chỉ chặn font để giảm tải nhẹ, không ảnh hưởng tới việc lấy ảnh nội dung.
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.resourceType() === "font") req.abort();
    else req.continue();
  });

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║      FB Photo Post Downloader v1.0       ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║ 🔗 URL: ${inputUrl.substring(0, 33).padEnd(33)}║`);
  console.log(`║ ✍️  Rewrite: ${String(isRewriteMode).padEnd(28)}║`);
  console.log(`║ 🖥️  Headless: ${String(headless).padEnd(27)}║`);
  console.log("╚══════════════════════════════════════════╝\n");

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.goto(inputUrl, { waitUntil: "networkidle2", timeout: 60000 });
  const finalUrl = page.url();

  let pageName = "bulk";
  try {
    const urlObj = new URL(finalUrl);
    if (urlObj.pathname.includes("profile.php")) {
      pageName = urlObj.searchParams.get("id") || "bulk";
    } else {
      const parts = urlObj.pathname.split("/").filter(Boolean);
      pageName = parts[0] === "share" ? parts[1] || "bulk" : parts[0];
    }
  } catch (e) {}

  console.log(`📂 Quét Timeline để tìm bài viết ảnh: ${finalUrl}`);

  let postLinks = new Set();
  let previousSize = 0;
  for (let i = 0; i < 20; i++) {
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a"))
        .map((a) => a.href)
        .filter(
          (h) =>
            h.includes("/posts/") ||
            h.includes("story_fbid=") ||
            h.includes("/photos/") ||
            h.includes("permalink.php")
        )
    );
    links.forEach((l) => postLinks.add(l.split("&mibextid")[0].split("?ref=")[0]));
    if (postLinks.size > 0 && postLinks.size === previousSize && i > 5) break;
    previousSize = postLinks.size;

    // Scroll mượt kiểu người thật (giống chế độ Reels) để tránh bị Facebook nghi ngờ
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = Math.floor(Math.random() * 100) + 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, Math.floor(Math.random() * 100) + 50);
      });
    });

    const humanDelay = Math.floor(Math.random() * 2000) + 2000;
    await sleep(humanDelay);
    process.stdout.write(`\r🔍 Đã tìm thấy: ${postLinks.size} bài viết...`);
  }
  process.stdout.write("\n");

  const linksArray = Array.from(postLinks);
  const manifest = loadPhotoManifest();
  const newLinks = linksArray.filter((link) => !manifest.has(link));
  const skipped = linksArray.length - newLinks.length;
  if (skipped > 0) console.log(`⏭️ Bỏ qua ${skipped} bài viết đã kiểm tra trước đó.`);
  console.log(`🚀 Kiểm tra ${newLinks.length} bài viết mới để tìm ảnh...`);

  let successCount = 0;
  let failCount = 0;
  let postIndex = 0;

  for (const link of newLinks) {
    console.log(`\n📊 Bài viết ${postIndex + 1}/${newLinks.length}`);
    const success = await extractAndDownloadPhotoPost(page, link, pageName, isRewriteMode);
    savePhotoManifest(manifest, link); // đánh dấu đã kiểm tra dù có ảnh hay không, tránh quét lại
    if (success) successCount++;
    else failCount++;
    postIndex++;

    if (postIndex < newLinks.length) {
      const randomDelay = 2000 + Math.floor(Math.random() * 3000);
      console.log(`⏳ Đang nghỉ ${Math.round(randomDelay / 1000)}s trước khi qua bài tiếp theo...`);
      await sleep(randomDelay);
    }
  }

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║          📊 KẾT QUẢ TẢI ẢNH              ║`);
  console.log(`╠══════════════════════════════════════════╣`);
  console.log(`║ ✅ Bài có ảnh:  ${String(successCount).padEnd(25)}║`);
  console.log(`║ ⏭️  Bỏ qua (ko ảnh): ${String(failCount).padEnd(20)}║`);
  console.log(`║ 📁 Thư mục:     ${pageName.substring(0, 24).padEnd(25)}║`);
  console.log(`╚══════════════════════════════════════════╝`);

  if (noClose) {
    console.log("🛑 Chế độ --no-close: Giữ trình duyệt mở để anh thao tác tiếp.");
  } else {
    console.log("🏁 Hoàn tất! Đang đóng trình duyệt...");
    await browser.close();
    console.log("✅ Đã đóng trình duyệt.");
  }
}
