// ====== Cấu hình ======
const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzlTAahSc0drsQzbsRgOaCBSOOY2k6NQoSHqylwQeGEZycvvJc6BN7lnFNGlrOY0Es/exec";

// ====== Helper ======
const $ = (sel) => document.querySelector(sel);

function getText(el, fallback = "") {
  return el ? el.textContent.trim() : fallback;
}

function onlyDigits(s = "") {
  return (s || "").replace(/\D/g, "");
}

// Lấy vài thông tin hiển thị trên trang (nếu có)
function collectProductMeta() {
  const name =
    getText(document.querySelector("h2")) ||
    getText(document.querySelector("h1")) ||
    "Sản phẩm";

  // cố gắng đọc giá mới/cũ theo một số class phổ biến
  const newPrice = getText(document.querySelector(".price-new")) ||
    getText(document.querySelector(".price")) || "";
  const oldPrice = getText(document.querySelector(".price-old")) || "";
  const discount = getText(document.querySelector(".discount")) || "";

  // ảnh đầu tiên trong slider/khung ảnh
  const img =
    document.querySelector(".slides img")?.getAttribute("src") ||
    document.querySelector(".product-image img")?.getAttribute("src") ||
    "";

  return { name, newPrice, oldPrice, discount, img };
}

function setLoading(isLoading) {
  const btn = $("#orderForm button[type='submit']");
  if (!btn) return;
  btn.disabled = isLoading;
  btn.dataset.originalText ||= btn.textContent;
  btn.textContent = isLoading ? "Đang gửi…" : btn.dataset.originalText;
}

function validateInput({ phone, address, quantity }) {
  const phoneEl = $("#phone");
  const addrEl = $("#address");
  const qtyEl = $("#quantity");

  // Chuẩn hoá
  const phoneDigits = onlyDigits(phone);
  const qty = parseInt(quantity, 10);
  const vnPhone10 = /^0\d{9}$/;

  // Reset lỗi cũ
  phoneEl.setCustomValidity("");
  addrEl.setCustomValidity("");
  qtyEl.setCustomValidity("");

  // Kiểm tra theo thứ tự và dừng tại lỗi đầu tiên
  if (!vnPhone10.test(phoneDigits)) {
    phoneEl.setCustomValidity("Số điện thoại phải có 10 số và bắt đầu bằng 0.");
    phoneEl.reportValidity();     // hiện bóng thoại ngay tại ô
    phoneEl.focus();
    return { ok: false };
  }

  if (!address || address.trim().length < 6) {
    addrEl.setCustomValidity("Địa chỉ chi tiết tối thiểu 6 ký tự.");
    addrEl.reportValidity();
    addrEl.focus();
    return { ok: false };
  }

  if (!Number.isInteger(qty) || qty < 1) {
    qtyEl.setCustomValidity("Số lượng phải là số nguyên ≥ 1.");
    qtyEl.reportValidity();
    qtyEl.focus();
    return { ok: false };
  }

  // Hợp lệ → trả dữ liệu chuẩn hoá
  return { ok: true, phone: phoneDigits, address: address.trim(), quantity: qty };
}


// Tạo FormData gửi lên Apps Script
function buildFormData({ phone, address, quantity, note }) {
  const meta = collectProductMeta();
  const fd = new FormData();

  // Thông tin đơn
  fd.append("quantity", String(quantity));
  fd.append("phone", phone);
  fd.append("address", address);
  fd.append("note", note);
  fd.append("name", 'Váy LV');

  // Thông tin sản phẩm/nguồn (có thì tốt, không có cũng không sao)
  fd.append("product_name", meta.name);
  fd.append("price_new", meta.newPrice);
  fd.append("price_old", meta.oldPrice);
  fd.append("discount", meta.discount);
  fd.append("image", meta.img);

  // Metadata tiện tra cứu
  fd.append("timestamp_iso", new Date().toISOString());
  fd.append("page_url", location.href);
  fd.append("referrer", document.referrer || "");
  fd.append("user_agent", navigator.userAgent);

  // UTM (nếu có trên URL)
  const params = new URLSearchParams(location.search);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) =>
    fd.append(k, params.get(k) || "")
  );

  return fd;
}


(() => {
  const slides = [...document.querySelectorAll(".slides img")];
  const prev = document.querySelector(".nav.prev");
  const next = document.querySelector(".nav.next");
  const dots = [...document.querySelectorAll(".dot")];
  console.log("[slider] slides:", slides.length);
  if (!slides.length) {
    console.warn("Không tìm thấy .slides img (kiểm tra <script defer> hoặc vị trí thẻ script).");
    return;
  }

  if (!slides.length) return;

  let i = slides.findIndex(el => el.classList.contains("active"));
  if (i < 0) { i = 0; slides[0].classList.add("active"); dots[0]?.classList.add("active"); }

  const show = (n) => {
    i = (n + slides.length) % slides.length;
    slides.forEach((el, k) => el.classList.toggle("active", k === i));
    dots.forEach((d, k) => d.classList.toggle("active", k === i));
  };


  dots.forEach((d, k) => d.addEventListener("click", () => show(k)));
  // ---- Auto slide
  const INTERVAL = 4000;
  let autoId = null;

  const startAuto = () => {
    stopAuto();
    if (slides.length > 1) autoId = setInterval(() => show(i + 1), INTERVAL);
  };
  const stopAuto = () => {
    if (autoId !== null) {
      clearInterval(autoId);
      autoId = null;
    }
  };

  // Event chỉ gắn MỘT lần, có reset auto bên trong
  const goPrev = () => { show(i - 1); startAuto(); };
  const goNext = () => { show(i + 1); startAuto(); };

  prev?.addEventListener("click", goPrev);
  next?.addEventListener("click", goNext);
  dots.forEach((d, k) => d.addEventListener("click", () => { show(k); startAuto(); }));

  // Hover/focus dừng, rời chạy lại
  const slider = document.querySelector(".slider");
  slider?.addEventListener("mouseenter", stopAuto);
  slider?.addEventListener("mouseleave", startAuto);
  slider?.addEventListener("focusin", stopAuto);
  slider?.addEventListener("focusout", startAuto);

  // Dừng khi tab ẩn
  document.addEventListener("visibilitychange", () => {
    document.hidden ? stopAuto() : startAuto();
  });

  // Khởi động
  startAuto();
})();
// ====== Qty +/- & cập nhật giá ở cả page + sticky ======
(() => {
  const qtyInput = document.getElementById("quantity");
  const btns = document.querySelectorAll(".qty-btn");

  // lấy tất cả nơi hiển thị giá mới (trên card + sticky-bar)
  const priceEls = [...document.querySelectorAll(".price-new")];

  // đơn giá: đọc từ phần tử nào có data-unit; fallback đọc số trong text
  const unitFromData = priceEls.find(el => el.dataset.unit)?.dataset.unit;
  const UNIT_PRICE =
    parseInt(unitFromData, 10) ||
    (priceEls[0] ? parseInt(priceEls[0].textContent.replace(/[^\d]/g, ""), 10) : 0);

  const formatVND = (n) =>
    n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

  const clampQty = (n) => {
    n = parseInt(n, 10);
    return Number.isNaN(n) || n < 1 ? 1 : n;
  };

  function updateAllPrices() {
    const qty = clampQty(qtyInput.value);
    const total = UNIT_PRICE * qty;
    priceEls.forEach((el) => {
      el.textContent = formatVND(total);
    });
  }

  // nút +/-
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      let qty = clampQty(qtyInput.value);
      if (btn.dataset.action === "inc") qty++;
      if (btn.dataset.action === "dec" && qty > 1) qty--;
      qtyInput.value = qty;
      updateAllPrices();
    });
  });

  // gõ trực tiếp
  qtyInput.addEventListener("input", updateAllPrices);

  // khởi tạo
  updateAllPrices();
})();




// ====== Submit ======
document.getElementById("orderForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const quantity = $("#quantity")?.value || "1";
  const phone = $("#phone")?.value || "";
  const address = $("#address")?.value || "";
  const note = $("#note")?.value?.trim() || "";

  const hp = $("#hp");
  if (hp && hp.value) return;

  const v = validateInput({ phone, address, quantity, note });
  if (!v.ok) return;

  const formData = buildFormData({ ...v, note });

  setLoading(true);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(ENDPOINT, { method: "POST", body: formData, signal: controller.signal });
    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await res.json().catch(() => ({}))
      : await res.text();

    const okByStatus = res.ok;
    const okByBody =
      (typeof payload === "string" && payload.includes("SUCCESS")) ||
      (typeof payload === "object" && (payload.status === "SUCCESS" || payload.success === true));

    if (okByStatus && okByBody) {
      alert("✅ Đặt hàng thành công! Chúng mình sẽ liên hệ sớm nhất.");
      this.reset();
      if ($("#quantity")) $("#quantity").value = 1;

      const submitBtn = this.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.textContent = "Đã đặt";
        submitBtn.disabled = true;
        submitBtn.classList.add("success");
        // để lỡ setLoading(false) chạy ở nơi khác cũng không đổi text
        submitBtn.dataset.originalText = "Đã đặt ✅";
      }

      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } else {
      const msg = typeof payload === "string" ? payload : JSON.stringify(payload || { error: "Unknown" });
      alert("⚠️ Có lỗi xảy ra: " + msg);
    }
  } catch (err) {
    const isAbort = err?.name === "AbortError";
    alert("❌ Lỗi kết nối" + (isAbort ? " (quá thời gian chờ)." : ": " + err));
  } finally {
    clearTimeout(t);
    // chỉ bỏ loading nếu chưa khoá nút
    if (!locked) setLoading(false);
  }
});
document.getElementById("buyNow").addEventListener("click", () => {
  document.getElementById("orderForm").dispatchEvent(
    new Event("submit", { cancelable: true, bubbles: true })
  );
});
