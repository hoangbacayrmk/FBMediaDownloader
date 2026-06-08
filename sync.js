import { execSync } from "child_process";
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

try {
  // Cập nhật remote URL với token
  const remoteUrl = `https://${USERNAME}:${TOKEN}@github.com/${USERNAME}/${REPO}.git`;
  execSync(`git remote set-url origin "${remoteUrl}"`, { stdio: "pipe" });

  console.log("📦 Đang kiểm tra thay đổi...");
  const status = execSync("git status -s").toString().trim();

  if (!status) {
    console.log("✅ Không có thay đổi gì mới để đồng bộ.");
    process.exit(0);
  }

  console.log("📝 Các file thay đổi:\n" + status);
  
  execSync("git add .", { stdio: "inherit" });
  execSync(`git commit -m "${commitMsg}"`, { stdio: "inherit" });

  console.log("🚀 Đang đẩy lên GitHub...");
  execSync("git push origin master", { stdio: "inherit" });

  console.log("\n✅ Đồng bộ thành công!");
  console.log(`🔗 https://github.com/${USERNAME}/${REPO}`);
} catch (err) {
  console.error("❌ Lỗi khi đồng bộ:", err.message);
  process.exit(1);
}
