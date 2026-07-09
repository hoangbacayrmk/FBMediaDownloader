import { execSync, execFileSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Đọc .env thủ công để lấy token (không dùng dotenv để tránh vòng lặp)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");

function loadEnv(envFilePath) {
  if (!existsSync(envFilePath)) return {};
  const lines = readFileSync(envFilePath, "utf-8").split("\n");
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key) env[key.trim()] = rest.join("=").trim();
  }
  return env;
}

const env = loadEnv(envPath);
const TOKEN    = env.GITHUB_TOKEN;
const USERNAME = env.GITHUB_USERNAME || "hoangbacayrmk";
const REPO     = "FBMediaDownloader";

if (!TOKEN || TOKEN === "your_github_token_here") {
  console.error("❌ Lỗi: Anh chưa điền GITHUB_TOKEN vào file .env!");
  console.error("   👉 Lấy token tại: https://github.com/settings/tokens/new (tick scope: repo)");
  process.exit(1);
}

// Lấy commit message từ tham số CLI, hoặc dùng mặc định
const commitMsg = process.argv.slice(2).join(" ") || `Cập nhật: ${new Date().toLocaleString("vi-VN")}`;

// Remote URLs
const remoteWithToken = `https://${USERNAME}:${TOKEN}@github.com/${USERNAME}/${REPO}.git`;
const remoteClean     = `https://github.com/${USERNAME}/${REPO}.git`;

/**
 * Dọn dẹp remote URL — xóa token khỏi remote để không bị lộ khi chạy `git remote -v`.
 */
function cleanupRemote() {
  try {
    execSync(`git remote set-url origin "${remoteClean}"`, { stdio: "pipe" });
  } catch {
    // Bỏ qua lỗi cleanup
  }
}

try {
  // Bước 0: Kiểm tra có đang trong Git repo không
  try {
    execSync("git rev-parse --git-dir", { stdio: "pipe" });
  } catch {
    console.error("❌ Thư mục hiện tại không phải Git repository!");
    console.error("   👉 Chạy: git init && git remote add origin ...");
    process.exit(1);
  }

  // Bước 1: Kiểm tra thay đổi TRƯỚC khi set token vào remote
  console.log("📦 Đang kiểm tra thay đổi...");
  const status = execSync("git status -s").toString().trim();

  if (!status) {
    console.log("✅ Không có thay đổi gì mới để đồng bộ.");
    process.exit(0);
  }

  console.log("📝 Các file thay đổi:\n" + status);

  // Bước 2: Stage & Commit (chưa cần token)
  execSync("git add .", { stdio: "inherit" });
  
  // Dùng execFileSync để tránh command injection từ commit message
  execFileSync("git", ["commit", "-m", commitMsg], { stdio: "inherit" });

  // Bước 3: Set token vào remote → Push → Dọn dẹp token ngay
  console.log("🚀 Đang đẩy lên GitHub...");
  execSync(`git remote set-url origin "${remoteWithToken}"`, { stdio: "pipe" });
  
  try {
    execSync("git push origin master", { stdio: "inherit" });
  } finally {
    // LUÔN dọn dẹp token khỏi remote, dù push thành công hay thất bại
    cleanupRemote();
  }

  console.log("\n✅ Đồng bộ thành công!");
  console.log(`🔗 https://github.com/${USERNAME}/${REPO}`);
} catch (err) {
  // Đảm bảo dọn dẹp token dù có lỗi
  cleanupRemote();
  console.error("❌ Lỗi khi đồng bộ:", err.message);
  process.exit(1);
}
