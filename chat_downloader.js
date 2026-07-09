import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { spawn } from "child_process";
import ffmpegInstaller from "ffmpeg-static";
import { download, createIfNotExistDir, sleep, saveToFile } from "./scripts/utils.js";
import { processVideo } from "./Skill/editor.js";
import { rewriteCaption } from "./Skill/rewriter.js";
import { schedulePost } from "./Skill/scheduler.js";
import { launchBrowser, registerGracefulShutdown } from "./scripts/browser_config.js";
import { ensureLoggedIn } from "./scripts/auto_login.js";
import { ensureYtDlp } from "./scripts/download_music.js";

dotenv.config();

// ============================================================
//  CLI Argument Parser
// ============================================================

/**
 * Parse CLI arguments thành object có cấu trúc.
 * Hỗ trợ: --flag (boolean) và --key value (string/number).
 */
function parseArgs(argv) {
  const flags = new Set();
  const params = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        params[key] = argv[++i];
      } else {
        flags.add(key);
      }
    }
  }
  return { flags, params };
}

function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║           FB Media Downloader - Hướng dẫn sử dụng      ║
╚══════════════════════════════════════════════════════════╝

📥 Tải 1 video:
  node chat_downloader.js --url "https://www.facebook.com/reel/123..."

📂 Tải hàng loạt (từ Profile/Page):
  node chat_downloader.js --url "https://www.facebook.com/pagename"

🎬 Tùy chọn:
  --url <link>          Link Facebook (bắt buộc)
  --edit                Tự động cắt đầu/cuối video
  --music               Ghép ngẫu nhiên nhạc trẻ không bản quyền thay âm gốc
  --rewrite             Viết lại caption bằng Gemini AI
  --upload <page_id>    (Tạm tắt) ID Fanpage để upload
  --trim-start <giây>   Số giây cắt đầu (mặc định: ${process.env.DEFAULT_TRIM_START || 1})
  --trim-end <giây>     Số giây cắt cuối (mặc định: ${process.env.DEFAULT_TRIM_END || 1})
  --no-close            Giữ browser mở sau khi xong
  --headless            Chạy nền không hiện browser
  --help                Hiện hướng dẫn này

💡 Kết hợp nhiều tùy chọn:
  node chat_downloader.js --url "LINK" --edit --rewrite --trim-start 2
`);
}

const { flags, params } = parseArgs(process.argv.slice(2));

// Xử lý --help
if (flags.has("help")) {
  showHelp();
  process.exit(0);
}

const targetUrl     = params["url"] || null;
const isEditMode    = flags.has("edit");
const isRewriteMode = flags.has("rewrite");
const isMusicMode   = flags.has("music");
const uploadPageName = params["upload"] || null;
const noClose       = flags.has("no-close");
const headless      = flags.has("headless");
const trimStart     = params["trim-start"] !== undefined ? parseFloat(params["trim-start"]) : undefined;
const trimEnd       = params["trim-end"]   !== undefined ? parseFloat(params["trim-end"])   : undefined;

// ============================================================
//  Validate
// ============================================================

function validateConfig() {
  if (!targetUrl) {
    console.error("❌ Thiếu tham số --url. Dùng --help để xem hướng dẫn.");
    process.exit(1);
  }

  try {
    new URL(targetUrl);
  } catch {
    console.error(`❌ URL không hợp lệ: "${targetUrl}"`);
    process.exit(1);
  }

  if (!targetUrl.includes("facebook.com") && !targetUrl.includes("fb.com") && !targetUrl.includes("fb.watch")) {
    console.warn("⚠️ URL không phải Facebook. Vẫn tiếp tục nhưng có thể không hoạt động.");
  }

  if (isRewriteMode && (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here")) {
    console.error("❌ Chế độ --rewrite yêu cầu GEMINI_API_KEY trong file .env!");
    console.error("   👉 Lấy key tại: https://aistudio.google.com/app/apikey");
    process.exit(1);
  }
}

// ============================================================
//  Constants & Manifest
// ============================================================

const SAVE_DIR = "downloads/reels_download";
// File manifest lưu danh sách URL đã tải (chống trùng lặp)
const MANIFEST_FILE = "downloads/downloaded_urls.json";

/**
 * Đọc manifest danh sách URL đã tải
 */
function loadManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"));
    return new Set(data);
  } catch { return new Set(); }
}

/**
 * Lưu một URL mới vào manifest
 */
function saveToManifest(downloadedSet, url) {
  downloadedSet.add(url);
  const dir = path.dirname(MANIFEST_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify([...downloadedSet], null, 2));
}

// ============================================================
//  Caption Extraction (cải thiện)
// ============================================================

/**
 * Trích xuất caption từ trang Facebook mobile.
 * Thử nhiều phương pháp theo thứ tự ưu tiên.
 */
async function extractCaption(page) {
  return await page.evaluate(() => {
    // 1. Thử lấy từ meta tags (đáng tin nhất)
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && ogDesc.content && ogDesc.content.length > 5) return ogDesc.content;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && metaDesc.content && metaDesc.content.length > 5) return metaDesc.content;

    // 2. Thử aria-label
    const ariaLabel = document.querySelector('[aria-label*="caption"], [aria-label*="mô tả"]');
    if (ariaLabel) {
      const text = ariaLabel.getAttribute("aria-label");
      if (text && text.length > 5) return text;
    }

    // 3. Tìm text element dài nhất — lọc bỏ noise
    const NOISE_PATTERNS = /^(like|comment|share|follow|xem thêm|see more|đăng nhập|log in|sign up|menu|home)/i;
    const textElements = Array.from(document.querySelectorAll("span, div, p")).filter((el) => {
      const style = window.getComputedStyle(el);
      const text = el.innerText?.trim() || "";
      return (
        style.display !== "none" &&
        text.length > 10 &&
        el.childElementCount === 0 &&
        !NOISE_PATTERNS.test(text) &&
        !el.closest("nav, header, footer, [role='navigation'], [role='banner']")
      );
    });

    const sorted = textElements.sort((a, b) => b.innerText.length - a.innerText.length);
    if (sorted.length > 0) {
      const caption = sorted[0].innerText.trim();
      // Giới hạn 2000 ký tự để tránh lấy nhầm DOM quá dài
      return caption.length > 2000 ? caption.substring(0, 2000) : caption;
    }

    return "";
  });
}

// ============================================================
//  Core Download Logic
// ============================================================

async function downloadSingleMusic() {
  const NCS_MUSIC_LINKS = [
    "https://www.youtube.com/watch?v=K4DyBUG242c", // Cartoon - On & On
    "https://www.youtube.com/watch?v=AOeY-nDp7hI", // Alan Walker - Fade
    "https://www.youtube.com/watch?v=bM7SZ5SBzyY", // Elektronomia - Sky High
    "https://www.youtube.com/watch?v=3nQNiWdeH2Q", // Janji - Heroes Tonight
    "https://www.youtube.com/watch?v=J2X5mJ3HDYE", // DEAF KEV - Invincible
    "https://www.youtube.com/watch?v=TW9d8vYrVFQ", // Tobu - Hope
    "https://www.youtube.com/watch?v=vtHGESuQ22s"  // Disfigure - Blank
  ];
  const url = NCS_MUSIC_LINKS[Math.floor(Math.random() * NCS_MUSIC_LINKS.length)];
  const binDir = "./bin";
  const ytdlpPath = path.join(binDir, "yt-dlp.exe");
  const musicDir = "./assets/temp_music";
  createIfNotExistDir(musicDir);

  const outputPath = path.join(musicDir, `temp_${Date.now()}.mp3`);

  return new Promise(async (resolve) => {
    // Tự động tải yt-dlp.exe nếu user mới clone code về chưa có
    await ensureYtDlp();

    if (!fs.existsSync(ytdlpPath)) {
      console.log("⚠️ Không thể tải yt-dlp.exe, bỏ qua tải nhạc song song...");
      return resolve(null);
    }

    console.log(`🎵 [Tiến trình song song] Đang tải 1 bài nhạc NCS ngẫu nhiên từ Youtube...`);
    
    const ytdlp = spawn(ytdlpPath, [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--ffmpeg-location", ffmpegInstaller,
      "-o", outputPath,
      url
    ], { shell: false });

    ytdlp.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`✅ [Tiến trình song song] Đã tải nhạc nền xong! Sẵn sàng chèn vào video.`);
        resolve(outputPath);
      } else {
        console.log(`❌ [Tiến trình song song] Lỗi tải nhạc, sẽ dùng nhạc lấy từ kho assets/bg_music...`);
        resolve(null);
      }
    });
  });
}

async function extractAndDownloadMobile(page, url, customSaveDir = SAVE_DIR, postIndex = 0) {
  console.log(`\n🌐 Đang xử lý: ${url}`);
  try {
    const mobileUrl = url.replace("www.facebook.com", "m.facebook.com");
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    );

    await page.goto(mobileUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(6000);

    // Lấy video URL
    const videoUrl = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const hdMatch =
        html.match(/"browser_native_hd_url":"(.*?)"/) ||
        html.match(/"playable_url_quality_hd":"(.*?)"/);
      if (hdMatch && hdMatch[1]) {
        return hdMatch[1].replace(/\\/g, "");
      }

      const v = document.querySelector("video");
      if (v && v.src && v.src.startsWith("https") && !v.src.includes("blob:")) return v.src;

      const sdMatch = html.match(/"playable_url":"(.*?)"/);
      return sdMatch ? sdMatch[1].replace(/\\/g, "") : null;
    });

    // Lấy caption (đã cải thiện)
    const caption = await extractCaption(page);

    if (videoUrl) {
      console.log(`🔗 Link: ${videoUrl.substring(0, 60)}...`);
      const baseName = `reel_${Date.now()}`;
      const videoFolder = path.join(customSaveDir, baseName);
      createIfNotExistDir(videoFolder);

      const videoPath = path.join(videoFolder, `${baseName}.mp4`);
      // Chạy song song: tải video + viết lại caption + tải nhạc
      const downloadPromise = download(videoUrl, videoPath);

      let rewritePromise = Promise.resolve(caption);
      if (caption && caption.length > 3 && isRewriteMode) {
        rewritePromise = rewriteCaption(caption);
      }

      let musicPromise = Promise.resolve(null);
      if (isMusicMode) {
        musicPromise = downloadSingleMusic();
      }

      // Chờ tất cả 3 tiến trình hoàn thành
      await downloadPromise;
      const finalCaption = await rewritePromise;
      const downloadedMusicPath = await musicPromise;

      if (finalCaption && finalCaption.length > 3) {
        saveToFile(path.join(videoFolder, `${baseName}.txt`), finalCaption, true);
      }

      let finalVideoPath = videoPath;
      if (isEditMode || isMusicMode) {
        try {
          finalVideoPath = await processVideo(videoPath, {
            trimStart, // Lấy từ --trim-start hoặc .env
            trimEnd, // Lấy từ --trim-end hoặc .env
            deleteOriginal: true,
            addMusic: isMusicMode,
            musicFilePath: downloadedMusicPath
          });

          // Dọn dẹp file nhạc tạm sau khi đã ghép xong
          if (downloadedMusicPath && fs.existsSync(downloadedMusicPath)) {
            fs.unlinkSync(downloadedMusicPath);
          }
        } catch (e) {
          console.error("⚠️ Không thể chỉnh sửa video này:", e.message);
        }
      }

      console.log(`✅ Hoàn tất thư mục: ${baseName}`);
      console.log(`📁 File video: ${finalVideoPath}`);
      console.log(`📝 File caption: ${path.join(videoFolder, `${baseName}.txt`)}`);

      if (uploadPageName) {
        console.log(
          `⏸️ (Tính năng Lên Lịch Tự Động đã được tắt): Anh có thể truy cập Meta Business Suite của Page ID ${uploadPageName} để upload thủ công nhé!`
        );
      }

      if (isRewriteMode) {
        const delay = parseInt(process.env.REWRITE_DELAY_MS) || 5000;
        await sleep(delay);
      }
      return true;
    } else {
      console.error("⚠️ Không tìm thấy video URL trên trang này.");
    }
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
  }
  return false;
}

// ============================================================
//  Main Handler
// ============================================================

async function handleDownload(inputUrl) {
  const browser = await launchBrowser({ headless });
  registerGracefulShutdown(browser);

  const page = await browser.newPage();

  // Đảm bảo đã đăng nhập trước khi tải (sẽ tự động đăng nhập nếu chưa)
  await ensureLoggedIn(page);

  // Hiển thị config summary
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║        FB Media Downloader v1.1          ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║ 🔗 URL: ${inputUrl.substring(0, 33).padEnd(33)}║`);
  console.log(`║ ✂️  Edit: ${String(isEditMode).padEnd(31)}║`);
  console.log(`║ 🎵 Music: ${String(isMusicMode).padEnd(30)}║`);
  console.log(`║ ✍️  Rewrite: ${String(isRewriteMode).padEnd(28)}║`);
  console.log(`║ 🖥️  Headless: ${String(headless).padEnd(27)}║`);
  console.log("╚══════════════════════════════════════════╝\n");

  console.log(`🔗 Quét: ${inputUrl}`);
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.goto(inputUrl, { waitUntil: "networkidle2", timeout: 60000 });
  const finalUrl = page.url();

  const isBulk =
    !finalUrl.includes("/videos/") &&
    !finalUrl.includes("/watch") &&
    !finalUrl.includes("/reel/") &&
    !finalUrl.includes("/posts/") &&
    !finalUrl.includes("fbid=");

  if (isBulk) {
    let reelsUrl = finalUrl.split("?")[0].replace(/\/$/, "");
    if (!reelsUrl.endsWith("/reels")) reelsUrl += "/reels/";
    if (finalUrl.includes("profile.php?id="))
      reelsUrl = `https://www.facebook.com/profile.php?id=${new URL(finalUrl).searchParams.get("id")}&sk=reels`;

    console.log(`📂 Chuyển hướng đến Reels: ${reelsUrl}`);
    await page.goto(reelsUrl, { waitUntil: "networkidle2" });
    let reelLinks = new Set();
    let previousSize = 0;
    for (let i = 0; i < 20; i++) {
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a"))
          .map((a) => a.href)
          .filter((h) => h.includes("/reel/"))
      );
      links.forEach((l) => reelLinks.add(l.split("?")[0])); // Clean URL
      if (reelLinks.size > 0 && reelLinks.size === previousSize && i > 5) break;
      previousSize = reelLinks.size;
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await sleep(3000);
      process.stdout.write(`\r🔍 Đã tìm thấy: ${reelLinks.size} video...`);
    }
    process.stdout.write("\n");
    const linksArray = Array.from(reelLinks);

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

    let postIndex = 0;
    let successCount = 0;
    let failCount = 0;
    const downloadedSet = loadManifest();
    const newLinks = linksArray.filter((link) => !downloadedSet.has(link));
    const skipped = linksArray.length - newLinks.length;
    if (skipped > 0) console.log(`⏭️ Bỏ qua ${skipped} video đã tải trước đó.`);
    console.log(`🚀 Tải ${newLinks.length} video mới (Edit: ${isEditMode}, Rewrite: ${isRewriteMode})...`);

    const downloadDelay = parseInt(process.env.DOWNLOAD_DELAY_MS) || 3000;

    for (const link of newLinks) {
      console.log(`\n📊 Video ${postIndex + 1}/${newLinks.length}`);
      const success = await extractAndDownloadMobile(page, link, path.join(SAVE_DIR, pageName), postIndex);
      if (success) {
        saveToManifest(downloadedSet, link);
        successCount++;
      } else {
        failCount++;
      }
      postIndex++;

      // Delay giữa các video (tránh bị Facebook chặn)
      if (postIndex < newLinks.length) {
        await sleep(downloadDelay);
      }
    }

    // Summary
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║              📊 KẾT QUẢ TẢI             ║`);
    console.log(`╠══════════════════════════════════════════╣`);
    console.log(`║ ✅ Thành công: ${String(successCount).padEnd(26)}║`);
    console.log(`║ ❌ Thất bại:   ${String(failCount).padEnd(26)}║`);
    console.log(`║ ⏭️  Đã bỏ qua: ${String(skipped).padEnd(25)}║`);
    console.log(`║ 📁 Thư mục:    ${pageName.substring(0, 25).padEnd(26)}║`);
    console.log(`╚══════════════════════════════════════════╝`);
  } else {
    const downloadedSet = loadManifest();
    const cleanUrl = finalUrl.split("?")[0];
    if (downloadedSet.has(cleanUrl)) {
      console.log(`⏭️ Video này đã được tải trước đó. Bỏ qua.`);
    } else {
      const success = await extractAndDownloadMobile(page, finalUrl, SAVE_DIR, 0);
      if (success) saveToManifest(downloadedSet, cleanUrl);
    }
  }

  if (noClose) {
    console.log("🛑 Chế độ --no-close: Giữ trình duyệt mở để anh thao tác tiếp.");
  } else {
    console.log("🏁 Hoàn tất! Đang đóng trình duyệt...");
    await browser.close();
    console.log("✅ Đã đóng trình duyệt.");
  }
}

// ============================================================
//  Entry Point
// ============================================================

validateConfig();
handleDownload(targetUrl).catch((e) => {
  console.error("❌ Lỗi nghiêm trọng:", e);
  process.exit(1);
});
