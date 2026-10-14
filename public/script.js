let products = [];

const formatPrice = (n) => "$" + n.toLocaleString("es-CO");

let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentFilter = "todos";
let currentSearch = "";

const grid = document.getElementById("productsGrid");
const emptyMsg = document.getElementById("productsEmpty");
const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");
const cartItemsEl = document.getElementById("cartItems");
const cartCountEl = document.getElementById("cartCount");
const cartItemsCountEl = document.getElementById("cartItemsCount");
const cartTotalEl = document.getElementById("cartTotal");
const toast = document.getElementById("toast");

function renderProducts() {
  const filtered = products.filter((p) => {
    const matchCategory = currentFilter === "todos" || p.category === currentFilter;
    const matchSearch = p.name.toLowerCase().includes(currentSearch.toLowerCase());
    return matchCategory && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = "";
    emptyMsg.hidden = false;
    return;
  }

  emptyMsg.hidden = true;
  grid.innerHTML = filtered
    .map(
      (p) => `
    <article class="product-card">
      <div class="product-card__image">
        ${p.badge ? `<span class="product-card__badge">${p.badge}</span>` : ""}
        <img src="${p.image}" alt="${p.name}" loading="lazy">
      </div>
      <div class="product-card__body">
        <p class="product-card__category">${p.category}</p>
        <h3 class="product-card__name">${p.name}</h3>
        <div class="product-card__footer">
          <div class="product-card__price">
            ${formatPrice(p.price)}
          </div>
          <button class="add-to-cart" onclick="addToCart(${p.id})" aria-label="Agregar al carrito">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          </button>
        </div>
      </div>
    </article>`
    )
    .join("");
}

function addToCart(id) {
  const product = products.find((p) => p.id === id);
  const existing = cart.find((item) => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: product.id, qty: 1 });
  }
  saveCart();
  renderCart();
  showToast(`${product.name} agregado al carrito`);
}

function removeFromCart(id) {
  cart = cart.filter((item) => item.id !== id);
  saveCart();
  renderCart();
}

function updateQty(id, delta) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }
  saveCart();
  renderCart();
}

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function renderCart() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);
    return sum + (product ? product.price * item.qty : 0);
  }, 0);

  cartCountEl.textContent = totalQty;
  cartItemsCountEl.textContent = totalQty;
  cartTotalEl.textContent = formatPrice(totalPrice);

  if (cart.length === 0) {
    cartItemsEl.innerHTML = `<div class="cart-empty">Tu carrito está vacío</div>`;
    return;
  }

  cartItemsEl.innerHTML = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.id);
      if (!product) return "";
      return `
      <div class="cart-item">
        <img src="${product.image}" alt="${product.name}">
        <div class="cart-item__info">
          <p class="cart-item__name">${product.name}</p>
          <p class="cart-item__price">${formatPrice(product.price)}</p>
          <div class="cart-item__qty">
            <button onclick="updateQty(${product.id}, -1)">−</button>
            <span>${item.qty}</span>
            <button onclick="updateQty(${product.id}, 1)">+</button>
          </div>
        </div>
        <button class="cart-item__remove" onclick="removeFromCart(${product.id})" aria-label="Eliminar">✕</button>
      </div>`;
    })
    .join("");
}

function openCart() {
  cartDrawer.classList.add("active");
  cartOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  cartDrawer.classList.remove("active");
  cartOverlay.classList.remove("active");
  document.body.style.overflow = "";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function clearCart() {
  cart = [];
  saveCart();
  renderCart();
  showToast("Carrito vaciado");
}

document.getElementById("cartBtn").addEventListener("click", openCart);
document.getElementById("cartClose").addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);
document.getElementById("clearCart").addEventListener("click", clearCart);

document.getElementById("checkoutBtn").addEventListener("click", () => {
  if (cart.length === 0) {
    showToast("Tu carrito está vacío");
    return;
  }
  openPayment();
});

let siteSettings = {};

async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    siteSettings = data && typeof data === "object" ? data : {};
  } catch {
    siteSettings = {};
  }
  const rate = parseFloat(siteSettings.exchange_rate);
  if (rate > 0) {
    const el = document.getElementById("topbarRate");
    el.textContent = `💵 Tasa del día: ${rate.toFixed(2)} Bs/$`;
    el.hidden = false;
  }
}

const paymentMethods = {
  binance: {
    title: "Binance Pay",
    rows: () => [
      { label: "Binance ID", value: siteSettings.binance_id || "—", copy: !!siteSettings.binance_id },
      { label: "Correo Binance", value: siteSettings.binance_email || "—", copy: !!siteSettings.binance_email },
      { label: "Moneda", value: "USDT (BEP20 / TRC20)" }
    ],
    note: "Una vez que realices el pago, envía el comprobante por WhatsApp indicando tu nombre y el número de orden."
  },
  "pago-movil": {
    title: "Pago Móvil",
    rows: () => {
      const rate = parseFloat(siteSettings.exchange_rate) || 0;
      const totalUSD = cart.reduce((sum, item) => {
        const product = products.find((p) => p.id === item.id);
        return sum + (product ? product.price * item.qty : 0);
      }, 0);
      const totalBs = rate > 0 ? totalUSD * rate : 0;
      const rows = [
        { label: "Teléfono", value: siteSettings.pago_movil_phone || "—", copy: !!siteSettings.pago_movil_phone },
        { label: "Banco", value: siteSettings.pago_movil_bank || "—", copy: !!siteSettings.pago_movil_bank },
        { label: "Titular", value: siteSettings.pago_movil_holder || "—", copy: !!siteSettings.pago_movil_holder },
        { label: "Cédula / RIF", value: siteSettings.pago_movil_cedula || "—" }
      ];
      if (rate > 0) {
        rows.push({ label: "Tasa del día", value: `${rate.toFixed(2)} Bs/$` });
        rows.push({ label: "Total en Bs", value: `${totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs` });
      }
      return rows;
    },
    note: "Realiza el pago móvil desde tu aplicación bancaria. Envía el comprobante por WhatsApp con tu nombre y la referencia del pago."
  }
};

const paymentOverlay = document.getElementById("paymentOverlay");
const paymentModal = document.getElementById("paymentModal");
const paymentTotal = document.getElementById("paymentTotal");
const paymentDetails = document.getElementById("paymentDetails");
const paymentDetailsContent = document.getElementById("paymentDetailsContent");

function openPayment() {
  const totalPrice = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);
    return sum + (product ? product.price * item.qty : 0);
  }, 0);
  paymentTotal.textContent = formatPrice(totalPrice);
  paymentDetails.hidden = true;
  document.querySelectorAll(".payment-option").forEach((btn) => btn.classList.remove("selected"));
  paymentOverlay.classList.add("active");
  paymentModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closePayment() {
  paymentOverlay.classList.remove("active");
  paymentModal.classList.remove("active");
  document.body.style.overflow = "";
}

document.getElementById("paymentClose").addEventListener("click", closePayment);
paymentOverlay.addEventListener("click", closePayment);

document.querySelectorAll(".payment-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".payment-option").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    const method = paymentMethods[btn.dataset.method];
    const rows = method.rows();
    paymentDetailsContent.innerHTML = `
      <h4 style="margin-bottom:12px;font-size:1rem;">${method.title}</h4>
      ${rows.map((r) => `
        <div class="payment-detail-row">
          <span>${r.label}</span>
          <div>
            <strong>${r.value}</strong>
            ${r.copy ? `<button class="copy-btn" onclick="copyText('${r.value}', this)">Copiar</button>` : ""}
          </div>
        </div>
      `).join("")}
      <p class="payment-note">${method.note}</p>
    `;
    paymentDetails.hidden = false;
  });
});

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "¡Copiado!";
    setTimeout(() => (btn.textContent = "Copiar"), 1500);
  });
}

document.getElementById("paymentConfirm").addEventListener("click", () => {
  showToast("¡Pago registrado! Te contactaremos para confirmar tu pedido.");
  clearCart();
  closePayment();
});

document.getElementById("filters").addEventListener("click", (e) => {
  if (!e.target.classList.contains("filter-btn")) return;
  document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
  e.target.classList.add("active");
  currentFilter = e.target.dataset.filter;
  renderProducts();
});

document.querySelectorAll(".category-card").forEach((card) => {
  card.addEventListener("click", (e) => {
    e.preventDefault();
    const category = card.dataset.category;
    currentFilter = category;
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === category);
    });
    renderProducts();
    document.getElementById("productos").scrollIntoView({ behavior: "smooth" });
  });
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  currentSearch = e.target.value;
  renderProducts();
});

document.getElementById("menuToggle").addEventListener("click", () => {
  document.getElementById("nav").classList.toggle("active");
});

document.querySelectorAll(".nav__link").forEach((link) => {
  link.addEventListener("click", () => {
    document.getElementById("nav").classList.remove("active");
  });
});

async function loadProducts() {
  try {
    const res = await fetch("/api/products");
    const data = await res.json();
    products = Array.isArray(data) ? data : [];
  } catch {
    products = [];
  }
  renderProducts();
}

window.addEventListener("scroll", () => {
  document.getElementById("header").classList.toggle("scrolled", window.scrollY > 10);
});

loadProducts();
loadSettings();
renderCart();
