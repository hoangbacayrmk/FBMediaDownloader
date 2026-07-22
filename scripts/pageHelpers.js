// ============================================================
//  Page Helpers dùng chung cho chế độ tải Reels
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
