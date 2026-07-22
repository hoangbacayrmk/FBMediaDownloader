// ============================================================
//  Page Helpers dùng chung cho cả chế độ tải Reels và tải Ảnh
// ============================================================

/**
 * Trích xuất caption từ trang Facebook mobile.
 * Thử nhiều phương pháp theo thứ tự ưu tiên.
 */
export async function extractCaption(page) {
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

/**
 * Trích xuất danh sách URL ảnh nội dung trong 1 bài viết (bỏ avatar/icon/emoji tĩnh).
 */
export async function extractPostImages(page) {
  return await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    const seen = new Set();
    const results = [];
    for (const img of imgs) {
      const src = img.src;
      if (!src || !src.startsWith("https")) continue;
      // Ảnh nội dung Facebook luôn nằm trên host "scontent"
      if (!/scontent/i.test(src)) continue;
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w < 150 || h < 150) continue; // bỏ avatar/icon/emoji nhỏ
      if (img.closest('header, nav, [role="banner"], [role="navigation"]')) continue;
      const clean = src.split("?")[0];
      if (seen.has(clean)) continue;
      seen.add(clean);
      results.push(src);
    }
    return results;
  });
}

/**
 * Rút gọn 1 id định danh bài viết từ URL Facebook (dùng để đặt tên thư mục/file).
 */
export function extractPostId(url) {
  try {
    const u = new URL(url);
    const storyFbid = u.searchParams.get("story_fbid") || u.searchParams.get("fbid");
    if (storyFbid) return storyFbid;

    const parts = u.pathname.split("/").filter(Boolean);
    const postsIdx = parts.indexOf("posts");
    if (postsIdx !== -1 && parts[postsIdx + 1]) return parts[postsIdx + 1];

    const photosIdx = parts.indexOf("photos");
    if (photosIdx !== -1 && parts[parts.length - 1]) return parts[parts.length - 1];

    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}
