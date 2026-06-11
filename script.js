// --- MM INTERNATIONAL ATELIER SYSTEM CONTROLLER ---

// --- GLOBAL STATE ---
const state = {
  cart: [],
  wishlist: [],
  user: null,
  products: [],
  config: {},
  customizer: {
    metal: 'platinum',
    gem: 'diamond',
    design: 'solitaire'
  },
  booking: {
    step: 1,
    service: '',
    date: '',
    time: '',
    name: '',
    email: '',
    notes: ''
  },
  activeTestimonial: 0
};

// Pricing rules loaded from config
let PRICING_MATRIX = {
  metal: { platinum: 2200, 'yellow-gold': 1500, 'white-gold': 1600, 'rose-gold': 1550 },
  gem: { diamond: 5500, emerald: 4200, sapphire: 3800, ruby: 4800 },
  design: { solitaire: 1200, halo: 1800, threestone: 2500 }
};

const GEM_COLORS = {
  'diamond': { color: '#ffffff', glow: 'rgba(255,255,255,0.7)', label: 'Solitaire Diamond' },
  'emerald': { color: '#00cc7a', glow: 'rgba(0,204,122,0.7)', label: 'Colombian Emerald' },
  'sapphire': { color: '#1a75ff', glow: 'rgba(26,117,255,0.7)', label: 'Ceylon Sapphire' },
  'ruby': { color: '#ff1a40', glow: 'rgba(255,26,64,0.7)', label: 'Velvet Ruby' }
};

const METAL_COLORS = {
  'yellow-gold': { fill: '#d4af37', label: '18K Yellow Gold' },
  'white-gold': { fill: '#e5e5e5', label: '18K White Gold' },
  'rose-gold': { fill: '#e0a98b', label: '18K Rose Gold' },
  'platinum': { fill: '#c0c0c0', label: 'Platinum 950' }
};

const DESIGN_LABELS = {
  'solitaire': 'Classic Solitaire',
  'halo': 'Halo Vintage',
  'threestone': 'Bespoke Three-Stone'
};

const TESTIMONIALS = [
  { text: "The Signature Solitaire is absolute perfection. The sparkle from the platinum setting exceeds all of my expectations. Exceptional service.", author: "Elizabeth Sterling" },
  { text: "Bespoke process was highly professional. The team took my concepts and refined them into a stunning custom wedding band.", author: "Jonathan Thorne" },
  { text: "Excellent customer care. The private viewing showroom experience in Paris was private, luxurious, and completely satisfying.", author: "Sophia Lauren" }
];

// --- APP INITIALIZATION ---
async function initApp() {
  try { await loadData(); } catch(e) { console.warn('loadData failed:', e); }
  try { syncLocalData(); } catch(e) { console.warn('syncLocalData failed:', e); }

  // Initialize systems — each wrapped so one crash doesn't stop others
  const inits = [
    initNavbarScroll,
    () => { renderCatalog('all'); renderBestsellers(); },
    initModals,
    initCustomizer,
    initBookingFlow,
    initCartWishlist,
    initUserAuth,
    initCheckoutFlow,
    initOrderTracker,
    initTestimonials,
    initAIGenerator,
    initProductZoom,
    initScrollReveals
  ];

  for (const fn of inits) {
    try { fn(); } catch(e) { console.warn(`Init failed [${fn.name || 'anonymous'}]:`, e); }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// --- LOAD DATA FROM BACKEND ---
async function loadData() {
  try {
    const configRes = await fetch('data/config.json');
    state.config = await configRes.json();
    if (state.config.customizer_pricing) {
      PRICING_MATRIX = state.config.customizer_pricing;
    }
  } catch (e) {
    console.warn("Could not load config.json, using mock config.");
  }

  try {
    const productsRes = await fetch('data/products.json');
    state.products = await productsRes.json();
  } catch (e) {
    console.warn("Could not load products.json. Database offline.");
  }
}

// --- SYNC LOCAL STORAGE DATA ---
function syncLocalData() {
  const localCart = localStorage.getItem('mm_cart');
  const localWish = localStorage.getItem('mm_wishlist');
  const localUser = localStorage.getItem('mm_user');
  
  if (localCart) state.cart = JSON.parse(localCart);
  if (localWish) state.wishlist = JSON.parse(localWish);
  if (localUser) {
    state.user = JSON.parse(localUser);
    updateUserHeaderUI();
  }
  
  updateBadges();
  renderCartDrawer();
  renderWishlistDrawer();
}

function saveCartToLocal() {
  localStorage.setItem('mm_cart', JSON.stringify(state.cart));
  updateBadges();
  renderCartDrawer();
}

function saveWishlistToLocal() {
  localStorage.setItem('mm_wishlist', JSON.stringify(state.wishlist));
  updateBadges();
  renderWishlistDrawer();
}

// --- BADGES UPDATE ---
function updateBadges() {
  const cartBadge = document.getElementById('cart-badge');
  const wishBadge = document.getElementById('wishlist-badge');
  
  const totalCartQty = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  
  if (cartBadge) {
    cartBadge.textContent = totalCartQty;
    cartBadge.style.display = totalCartQty > 0 ? 'flex' : 'none';
  }
  if (wishBadge) {
    wishBadge.textContent = state.wishlist.length;
    wishBadge.style.display = state.wishlist.length > 0 ? 'flex' : 'none';
  }
}

// --- DYNAMIC RENDERING (CATALOG & BEST SELLERS) ---
function renderCatalog(filter) {
  const grid = document.getElementById('collections-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  const filtered = filter === 'all' 
    ? state.products.filter(p => p.enabled !== false) 
    : state.products.filter(p => p.category === filter && p.enabled !== false);
    
  filtered.forEach(p => {
    const card = createProductCard(p);
    grid.appendChild(card);
  });
}

function renderBestsellers() {
  const grid = document.getElementById('bestsellers-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  // Top 3 bestsellers
  const bestsellers = state.products.slice(0, 3);
  bestsellers.forEach(p => {
    const card = createProductCard(p);
    grid.appendChild(card);
  });
}

function createProductCard(p) {
  const card = document.createElement('div');
  card.className = 'jewelry-card reveal revealed';
  card.setAttribute('data-id', p.id);
  
  const isWishlisted = state.wishlist.some(item => item.id === p.id);
  const isOutOfStock = p.stock === 0;

  card.innerHTML = `
    ${p.badge ? `<span class="card-badge">${p.badge}</span>` : ''}
    ${isOutOfStock ? `<span class="card-badge" style="background:#ff4d4d; color:#fff; left:auto; right:15px;">Sold Out</span>` : ''}
    <div class="card-img-wrapper">
      <img class="card-img" src="${p.img}" alt="${p.title}" loading="lazy">
      <div class="card-overlay">
        <button class="btn btn-secondary card-quick-view">Inspect Piece</button>
      </div>
    </div>
    <div class="card-info">
      <span class="card-category">${p.category.slice(0, -1)}</span>
      <h3 class="card-title">${p.title}</h3>
      <p class="card-price">${p.price}</p>
    </div>
  `;
  
  card.querySelector('.card-quick-view').addEventListener('click', (e) => {
    e.stopPropagation();
    openProductModal(p.id);
  });
  
  card.addEventListener('click', () => {
    openProductModal(p.id);
  });
  
  return card;
}

// --- CART & WISHLIST DRAWERS SYSTEM ---
function initCartWishlist() {
  const cartBtn = document.getElementById('header-cart-btn');
  const cartOverlay = document.getElementById('cart-drawer-overlay');
  const cartClose = document.getElementById('cart-drawer-close-btn');
  
  const wishBtn = document.getElementById('header-wishlist-btn');
  const wishOverlay = document.getElementById('wishlist-drawer-overlay');
  const wishClose = document.getElementById('wishlist-drawer-close-btn');

  // Toggle Cart Drawer
  if (cartBtn && cartOverlay) {
    cartBtn.addEventListener('click', () => cartOverlay.classList.add('active'));
  }
  if (cartClose && cartOverlay) {
    cartClose.addEventListener('click', () => cartOverlay.classList.remove('active'));
    cartOverlay.addEventListener('click', (e) => {
      if (e.target === cartOverlay) cartOverlay.classList.remove('active');
    });
  }

  // Toggle Wishlist Drawer
  if (wishBtn && wishOverlay) {
    wishBtn.addEventListener('click', () => wishOverlay.classList.add('active'));
  }
  if (wishClose && wishOverlay) {
    wishClose.addEventListener('click', () => wishOverlay.classList.remove('active'));
    wishOverlay.addEventListener('click', (e) => {
      if (e.target === wishOverlay) wishOverlay.classList.remove('active');
    });
  }

  // Bind Collections Tabs Filter
  const tabs = document.querySelectorAll('.filter-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.getAttribute('data-filter');
      
      const grid = document.getElementById('collections-grid');
      grid.style.opacity = '0';
      setTimeout(() => {
        renderCatalog(cat);
        grid.style.opacity = '1';
      }, 200);
    });
  });
}

function renderCartDrawer() {
  const container = document.getElementById('cart-drawer-items');
  const subtotalLabel = document.getElementById('cart-subtotal-label');
  if (!container) return;
  
  container.innerHTML = '';
  let subtotal = 0;
  
  if (state.cart.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:50px 0; color:var(--color-text-muted);">Your shopping bag is empty.</div>`;
    if (subtotalLabel) subtotalLabel.textContent = "$0.00";
    return;
  }
  
  state.cart.forEach((item, idx) => {
    const priceVal = parseFloat(item.product.price.replace(/[$,]/g, ''));
    subtotal += priceVal * item.quantity;
    
    const div = document.createElement('div');
    div.className = 'drawer-item';
    div.innerHTML = `
      <img src="${item.product.img}" alt="${item.product.title}">
      <div class="drawer-item-info">
        <div class="drawer-item-title">${item.product.title}</div>
        <div class="drawer-item-variant">${item.variant.Metal || ''} ${item.variant.Size ? `/ Size: ${item.variant.Size}` : ''}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
          <div class="drawer-item-price">${item.product.price} × ${item.quantity}</div>
          <button type="button" class="btn-remove-cart" style="background:none; border:none; color:#ff4d4d; cursor:pointer;" data-key="${item.key}"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
    `;
    
    div.querySelector('.btn-remove-cart').addEventListener('click', () => {
      removeItemFromCart(item.key);
    });
    
    container.appendChild(div);
  });
  
  if (subtotalLabel) {
    subtotalLabel.textContent = `$${subtotal.toLocaleString()}`;
  }
}

function renderWishlistDrawer() {
  const container = document.getElementById('wishlist-drawer-items');
  if (!container) return;
  
  container.innerHTML = '';
  if (state.wishlist.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:50px 0; color:var(--color-text-muted);">Your wishlist is empty.</div>`;
    return;
  }
  
  state.wishlist.forEach(p => {
    const div = document.createElement('div');
    div.className = 'drawer-item';
    div.innerHTML = `
      <img src="${p.img}" alt="${p.title}">
      <div class="drawer-item-info">
        <div class="drawer-item-title">${p.title}</div>
        <div class="drawer-item-price">${p.price}</div>
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button type="button" class="btn-move-to-cart" style="background:none; border:1px solid var(--color-gold); color:var(--color-gold); font-size:9px; padding:4px 8px; cursor:pointer; text-transform:uppercase;">Move to Bag</button>
          <button type="button" class="btn-remove-wishlist" style="background:none; border:1px solid rgba(255,255,255,0.1); color:var(--color-text-secondary); font-size:9px; padding:4px 8px; cursor:pointer;" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
    
    div.querySelector('.btn-move-to-cart').addEventListener('click', () => {
      addItemToCart(p, { Metal: 'Platinum 950', Size: '6' });
      removeItemFromWishlist(p.id);
    });
    
    div.querySelector('.btn-remove-wishlist').addEventListener('click', () => {
      removeItemFromWishlist(p.id);
    });
    
    container.appendChild(div);
  });
}

// --- CART ACTIONS ---
function addItemToCart(product, variant = {}) {
  const variantKey = `${product.id}-${JSON.stringify(variant)}`;
  const existing = state.cart.find(item => item.key === variantKey);
  
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      key: variantKey,
      product,
      variant,
      quantity: 1
    });
  }
  
  saveCartToLocal();
  toastNotification('Piece added to shopping bag!');
  const overlay = document.getElementById('cart-drawer-overlay');
  if (overlay) overlay.classList.add('active');
}

function removeItemFromCart(key) {
  state.cart = state.cart.filter(item => item.key !== key);
  saveCartToLocal();
}

// --- WISHLIST ACTIONS ---
function toggleProductWishlist(product) {
  const exists = state.wishlist.some(item => item.id === product.id);
  if (exists) {
    removeItemFromWishlist(product.id);
    toastNotification('Piece removed from wishlist.');
  } else {
    state.wishlist.push(product);
    saveWishlistToLocal();
    toastNotification('Piece saved to wishlist!');
  }
}

function removeItemFromWishlist(id) {
  state.wishlist = state.wishlist.filter(item => item.id !== id);
  saveWishlistToLocal();
  
  // If product modal is open, sync wishlist button styling
  const detailModal = document.getElementById('product-modal');
  if (detailModal && detailModal.classList.contains('active')) {
    const wishBtn = document.getElementById('detail-add-to-wishlist-btn');
    if (wishBtn) {
      wishBtn.style.color = '#fff';
      wishBtn.style.borderColor = 'rgba(255,255,255,0.15)';
    }
  }
}

// --- TOAST NOTIFICATIONS ---
function toastNotification(message) {
  const oldToast = document.querySelector('.toast-msg');
  if (oldToast) oldToast.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// --- DETAILED VIEW MODAL (INSPECT & ZOOM) ---
function openProductModal(id) {
  const p = state.products.find(prod => prod.id === id);
  if (!p) return;
  
  const modal = document.getElementById('product-modal');
  
  document.getElementById('detail-modal-img').src = p.img;
  document.getElementById('detail-modal-category').textContent = p.category.slice(0, -1).toUpperCase();
  document.getElementById('detail-modal-title').textContent = p.title;
  document.getElementById('detail-modal-price').textContent = p.price;
  document.getElementById('detail-modal-desc').textContent = p.desc;
  
  // Stock Status
  const stockLabel = document.getElementById('detail-modal-stock-status');
  if (p.stock === 0) {
    stockLabel.textContent = "Sold Out";
    stockLabel.style.color = "#ff4d4d";
    document.getElementById('detail-add-to-cart-btn').disabled = true;
    document.getElementById('detail-add-to-cart-btn').textContent = "Sold Out";
  } else if (p.stock <= 2) {
    stockLabel.textContent = `Limited Quantity Available: Only ${p.stock} Left`;
    stockLabel.style.color = "#ffae1a";
    document.getElementById('detail-add-to-cart-btn').disabled = false;
    document.getElementById('detail-add-to-cart-btn').innerHTML = `<i class="fa-solid fa-bag-shopping" style="margin-right:8px;"></i> Add to Cart`;
  } else {
    stockLabel.textContent = "In Stock";
    stockLabel.style.color = "#00cc7a";
    document.getElementById('detail-add-to-cart-btn').disabled = false;
    document.getElementById('detail-add-to-cart-btn').innerHTML = `<i class="fa-solid fa-bag-shopping" style="margin-right:8px;"></i> Add to Cart`;
  }
  
  // Specifications
  const specsContainer = document.getElementById('detail-modal-specs');
  specsContainer.innerHTML = '';
  if (p.specs) {
    Object.entries(p.specs).forEach(([k, v]) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${k.replace('_', ' ')}:</strong> ${v}`;
      specsContainer.appendChild(li);
    });
  }
  
  // Bind actions
  const addToCartBtn = document.getElementById('detail-add-to-cart-btn');
  const addWishlistBtn = document.getElementById('detail-add-to-wishlist-btn');
  
  // Reset active active variant states
  const metalButtons = document.querySelectorAll('#detail-metal-variants button');
  let selectedMetal = "Platinum 950";
  
  metalButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-metal') === selectedMetal) btn.classList.add('active');
    
    // Custom click trigger
    btn.onclick = () => {
      metalButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMetal = btn.getAttribute('data-metal');
    };
  });
  
  // Wishlist visual indicator status check
  const isSaved = state.wishlist.some(item => item.id === p.id);
  addWishlistBtn.style.color = isSaved ? 'var(--color-gold)' : '#fff';
  addWishlistBtn.style.borderColor = isSaved ? 'var(--color-gold)' : 'rgba(255,255,255,0.15)';
  
  addToCartBtn.onclick = () => {
    const sizeSelect = document.getElementById('detail-size-select');
    addItemToCart(p, {
      Metal: selectedMetal,
      Size: sizeSelect ? sizeSelect.value : '6'
    });
    modal.classList.remove('active');
  };
  
  addWishlistBtn.onclick = () => {
    toggleProductWishlist(p);
    const updatedSave = state.wishlist.some(item => item.id === p.id);
    addWishlistBtn.style.color = updatedSave ? 'var(--color-gold)' : '#fff';
    addWishlistBtn.style.borderColor = updatedSave ? 'var(--color-gold)' : 'rgba(255,255,255,0.15)';
  };
  
  // Related catalog products logic
  const relatedContainer = document.getElementById('detail-related-grid');
  relatedContainer.innerHTML = '';
  const related = state.products.filter(item => item.id !== p.id && item.category === p.category).slice(0, 2);
  related.forEach(item => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; gap:10px; background:rgba(255,255,255,0.02); border:1px solid rgba(212,175,55,0.1); padding:8px; cursor:pointer;';
    div.innerHTML = `
      <img src="${item.img}" style="width:40px; height:45px; object-fit:cover;">
      <div style="flex-grow:1; display:flex; flex-direction:column; justify-content:center;">
        <h5 style="font-size:11px; margin:0; color:#fff;">${item.title}</h5>
        <span style="font-size:10px; color:var(--color-gold); margin-top:2px;">${item.price}</span>
      </div>
    `;
    div.addEventListener('click', () => {
      openProductModal(item.id);
    });
    relatedContainer.appendChild(div);
  });
  
  modal.classList.add('active');
}

function initProductZoom() {
  const container = document.getElementById('modal-zoom-container');
  const img = document.getElementById('detail-modal-img');
  const lens = document.getElementById('zoom-lens');
  
  if (!container || !img || !lens) return;
  
  container.addEventListener('mousemove', (e) => {
    lens.style.display = 'block';
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    lens.style.left = `${x}px`;
    lens.style.top = `${y}px`;
    
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    
    lens.style.backgroundImage = `url(${img.src})`;
    lens.style.backgroundPosition = `${xPercent}% ${yPercent}%`;
  });
  
  container.addEventListener('mouseleave', () => {
    lens.style.display = 'none';
  });
}

function initBookingFlow() {
  const container = document.getElementById('booking-service-cards-container');
  const form = document.getElementById('booking-multi-step');
  const successView = document.getElementById('booking-success-view');
  
  if (!form) return;

  // Render services dynamically
  if (container) {
    container.innerHTML = '';
    const services = state.config.booking_services || [
      { id: "bespoke-design", title: "Bespoke Design", desc: "Design a custom engagement ring or specialized heirloom with our lead designer." },
      { id: "showroom-viewing", title: "Showroom Viewing", desc: "A private 45-minute viewing of our current catalog at our luxurious suite." }
    ];
    
    services.forEach((s, idx) => {
      const card = document.createElement('div');
      card.className = `service-card ${idx === 0 ? 'active' : ''}`;
      card.setAttribute('data-id', s.id);
      card.innerHTML = `
        <h4 style="font-family:var(--font-serif); font-size:16px; margin-bottom:8px; color:var(--color-gold-light);">${s.title}</h4>
        <p style="font-size:11px; color:var(--color-text-secondary); line-height:1.5;">${s.desc}</p>
      `;
      card.onclick = () => {
        container.querySelectorAll('.service-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.booking.service = s.title;
      };
      container.appendChild(card);
      if (idx === 0) state.booking.service = s.title;
    });
  }

  const steps = form.querySelectorAll('.booking-step');
  const dots = document.querySelectorAll('.step-dot');
  let currentStep = 1;

  const showStep = (stepNum) => {
    steps.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));
    
    const targetStep = form.querySelector(`.booking-step[data-step="${stepNum}"]`);
    if (targetStep) targetStep.classList.add('active');
    
    dots.forEach((d, idx) => {
      if (idx < stepNum) d.classList.add('active');
    });
    
    currentStep = stepNum;
  };

  form.querySelectorAll('.btn-booking-next').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      // Simple validation for step fields
      if (currentStep === 1) {
        showStep(2);
      } else if (currentStep === 2) {
        const dateInput = document.getElementById('book-date');
        const timeInput = document.getElementById('book-time');
        if (!dateInput.value || !timeInput.value) {
          alert('Please select preferred date and time slot.');
          return;
        }
        state.booking.date = dateInput.value;
        state.booking.time = timeInput.value;
        showStep(3);
      }
    };
  });

  form.querySelectorAll('.btn-booking-prev').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      showStep(currentStep - 1);
    };
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('book-name').value;
    const email = document.getElementById('book-email').value;
    const notes = document.getElementById('book-notes').value;
    
    state.booking.name = name;
    state.booking.email = email;
    state.booking.notes = notes;

    try {
      const r = await fetch('/api/submit-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.booking)
      });
      const res = await r.json();
      if (res.success) {
        showSuccess();
      } else {
        alert(res.error || 'Concierge request failed.');
      }
    } catch(err) {
      // Offline fallback
      showSuccess();
    }
  };

  const showSuccess = () => {
    form.style.display = 'none';
    if (successView) {
      document.getElementById('summary-service').textContent = state.booking.service;
      document.getElementById('summary-datetime').textContent = `${state.booking.date} at ${state.booking.time}`;
      successView.style.display = 'block';
      setTimeout(() => successView.style.opacity = '1', 50);
    }
  };
}

function initModals() {
  const modal = document.getElementById('product-modal');
  if (!modal) return;
  const close = modal.querySelector('.modal-close-btn');
  close.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
}

// --- USER AUTH SYSTEM ---
function initUserAuth() {
  const loginTriggerBtn = document.getElementById('header-login-btn');
  const authModal = document.getElementById('user-auth-modal');
  const authClose = document.getElementById('auth-modal-close-btn');
  
  const toSignup = document.getElementById('toggle-to-signup-link');
  const toLogin = document.getElementById('toggle-to-login-link');
  const loginView = document.getElementById('auth-login-view');
  const signupView = document.getElementById('auth-signup-view');

  if (!loginTriggerBtn || !authModal) return;

  loginTriggerBtn.addEventListener('click', () => {
    if (state.user) {
      if (confirm(`Logout of ${state.user.name}?`)) {
        state.user = null;
        localStorage.removeItem('mm_user');
        updateUserHeaderUI();
        toastNotification('Logged out successfully.');
      }
    } else {
      authModal.classList.add('active');
    }
  });

  authClose.addEventListener('click', () => authModal.classList.remove('active'));
  
  toSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginView.style.display = 'none';
    signupView.style.display = 'block';
  });
  toLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupView.style.display = 'none';
    loginView.style.display = 'block';
  });

  // Login handler
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
      const r = await fetch('/api/auth-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password })
      });
      const res = await r.json();
      if (res.success) {
        state.user = res.user;
        localStorage.setItem('mm_user', JSON.stringify(res.user));
        updateUserHeaderUI();
        authModal.classList.remove('active');
        toastNotification(`Welcome back, ${res.user.name}`);
      } else {
        alert(res.error || 'Login failed.');
      }
    } catch(err) {
      alert('Authentication offline. Using default mock customer login.');
      state.user = { email, name: 'Alexandra Sterling' };
      localStorage.setItem('mm_user', JSON.stringify(state.user));
      updateUserHeaderUI();
      authModal.classList.remove('active');
    }
  });

  // Signup handler
  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    try {
      const r = await fetch('/api/auth-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signup', name, email, password })
      });
      const res = await r.json();
      if (res.success) {
        state.user = res.user;
        localStorage.setItem('mm_user', JSON.stringify(res.user));
        updateUserHeaderUI();
        authModal.classList.remove('active');
        toastNotification(`Account registered! Welcome ${name}`);
      } else {
        alert(res.error || 'Signup failed.');
      }
    } catch(err) {
      alert('Could not sync to cloud database. Saved account locally.');
      state.user = { email, name };
      localStorage.setItem('mm_user', JSON.stringify(state.user));
      updateUserHeaderUI();
      authModal.classList.remove('active');
    }
  });
}

function updateUserHeaderUI() {
  const portal = document.getElementById('user-header-portal');
  if (!portal) return;
  if (state.user) {
    portal.innerHTML = `
      <div class="user-panel-bar">
        <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">${state.user.name.split(' ')[0]}</span>
        <button type="button" class="user-logout-btn" title="Sign Out"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>
      </div>
    `;
    portal.querySelector('.user-logout-btn').addEventListener('click', () => {
      state.user = null;
      localStorage.removeItem('mm_user');
      updateUserHeaderUI();
      toastNotification('Logged out successfully.');
    });
  } else {
    portal.innerHTML = `
      <button class="btn-icon" id="header-login-btn" aria-label="User Account" style="background:none;border:none;color:#fff;cursor:pointer;outline:none;">
        <i class="fa-solid fa-user" style="font-size:18px;"></i>
      </button>
    `;
    // Rebind
    initUserAuth();
  }
}

// --- SECURE CHECKOUT FLOW (PAYMENT MOCK) ---
function initCheckoutFlow() {
  const checkoutOverlay = document.getElementById('checkout-modal');
  const triggerBtn = document.getElementById('cart-checkout-trigger-btn');
  const closeBtn = document.getElementById('checkout-modal-close-btn');
  
  if (!triggerBtn || !checkoutOverlay) return;

  triggerBtn.addEventListener('click', () => {
    if (state.cart.length === 0) return;
    document.getElementById('cart-drawer-overlay').classList.remove('active');
    
    // Auto fill if logged in
    if (state.user) {
      document.getElementById('checkout-name').value = state.user.name;
    }
    
    renderCheckoutSummary();
    
    // Reset view
    document.getElementById('checkout-form-container').style.display = 'grid';
    document.getElementById('checkout-success-view').style.display = 'none';
    
    checkoutOverlay.classList.add('active');
  });

  closeBtn.addEventListener('click', () => checkoutOverlay.classList.remove('active'));

  // Promo Coupon apply
  let activeCoupon = null;
  const promoApply = document.getElementById('checkout-promo-apply-btn');
  
  if (promoApply) promoApply.onclick = () => {
    const code = document.getElementById('checkout-promo-input').value.toUpperCase().trim();
    if (code === 'LUXURY10') {
      activeCoupon = { code: 'LUXURY10', rate: 0.1 };
      alert('10% discount applied to invoice.');
      renderCheckoutSummary(activeCoupon);
    } else {
      alert('Coupon code invalid or expired.');
    }
  };

  // Submit Order Details
  document.getElementById('checkout-details-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('checkout-name').value;
    const address = document.getElementById('checkout-address').value;
    const city = document.getElementById('checkout-city').value;
    const zip = document.getElementById('checkout-zip').value;
    
    const cartSubtotal = state.cart.reduce((sum, item) => {
      const priceVal = parseFloat(item.product.price.replace(/[$,]/g, ''));
      return sum + (priceVal * item.quantity);
    }, 0);
    const tax = cartSubtotal * 0.08;
    const discount = activeCoupon ? cartSubtotal * activeCoupon.rate : 0;
    const total = cartSubtotal + tax - discount;
    
    const payload = {
      items: state.cart,
      total: `$${total.toLocaleString()}`,
      shipping: { name, address, city, zip, email: state.user ? state.user.email : 'guest@example.com' },
      discount_applied: activeCoupon ? activeCoupon.code : ''
    };
    
    try {
      const r = await fetch('/api/submit-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const res = await r.json();
      if (res.success) {
        printCheckoutReceipt(res.orderId, payload, total);
      } else {
        alert(res.error || 'Transaction authorization failed.');
      }
    } catch(err) {
      // Offline fallback
      const mockId = `MM-${Math.floor(100000 + Math.random() * 900000)}`;
      printCheckoutReceipt(mockId, payload, total);
    }
  };
}

function renderCheckoutSummary(coupon = null) {
  const container = document.getElementById('checkout-summary-items');
  container.innerHTML = '';
  
  let subtotal = 0;
  state.cart.forEach(item => {
    const priceVal = parseFloat(item.product.price.replace(/[$,]/g, ''));
    subtotal += priceVal * item.quantity;
    
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; justify-content:space-between; margin-bottom:8px;';
    div.innerHTML = `
      <span>${item.product.title} × ${item.quantity}</span>
      <span>${item.product.price}</span>
    `;
    container.appendChild(div);
  });
  
  const tax = subtotal * 0.08;
  const discount = coupon ? subtotal * coupon.rate : 0;
  const total = subtotal + tax - discount;
  
  document.getElementById('checkout-subtotal-lbl').textContent = `$${subtotal.toLocaleString()}`;
  document.getElementById('checkout-tax-lbl').textContent = `$${tax.toLocaleString()}`;
  
  const discountRow = document.getElementById('checkout-discount-row');
  if (coupon) {
    discountRow.style.display = 'flex';
    document.getElementById('checkout-discount-lbl').textContent = `-$${discount.toLocaleString()}`;
  } else {
    discountRow.style.display = 'none';
  }
  
  document.getElementById('checkout-total-lbl').textContent = `$${total.toLocaleString()}`;
}

function printCheckoutReceipt(orderId, payload, total) {
  // Clear cart
  state.cart = [];
  saveCartToLocal();
  
  document.getElementById('checkout-form-container').style.display = 'none';
  
  const receipt = document.getElementById('checkout-receipt-details');
  receipt.innerHTML = `
    <p style="margin-bottom:8px;"><strong>Order ID:</strong> <span style="color:var(--color-gold);">${orderId}</span></p>
    <p style="margin-bottom:8px;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
    <p style="margin-bottom:8px;"><strong>Delivery Destination:</strong> ${payload.shipping.address}, ${payload.shipping.city}</p>
    <p style="margin-bottom:8px;"><strong>Total Invoiced:</strong> $${total.toLocaleString()}</p>
    <p style="margin-bottom:0;"><strong>Estimated Delivery:</strong> 5-7 business days</p>
  `;
  
  document.getElementById('checkout-success-view').style.display = 'block';
  
  document.getElementById('checkout-success-track-btn').onclick = () => {
    document.getElementById('checkout-modal').classList.remove('active');
    document.getElementById('tracking-id-input').value = orderId;
    document.getElementById('tracking-section').scrollIntoView({ behavior: 'smooth' });
    trackOrderById(orderId);
  };
}

// --- ORDER STATUS TRACKER ---
function initOrderTracker() {
  const form = document.getElementById('tracking-search-form');
  if (!form) return;
  
  form.onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('tracking-id-input').value.toUpperCase().trim();
    trackOrderById(id);
  };
}

async function trackOrderById(id) {
  const timeline = document.getElementById('tracking-visual-timeline');
  const errBox = document.getElementById('tracking-error-box');
  
  if (!timeline || !errBox) return;
  
  try {
    const r = await fetch('/api/get-orders');
    const orders = await r.json();
    const match = orders.find(o => o.id === id);
    
    if (match) {
      errBox.style.display = 'none';
      document.getElementById('track-order-id-label').textContent = match.id;
      document.getElementById('track-order-total-label').textContent = match.total;
      
      const statuses = ['Ordered', 'Processing', 'Shipped', 'Delivered'];
      const currentIdx = statuses.indexOf(match.status);
      
      // Update visual nodes
      statuses.forEach((status, idx) => {
        const node = document.getElementById(`node-${status.toLowerCase()}`);
        if (node) {
          if (idx <= currentIdx) {
            node.classList.add('active');
          } else {
            node.classList.remove('active');
          }
        }
      });
      
      // Update path percentage line
      const progress = document.getElementById('tracking-progress-bar');
      if (progress) {
        const pct = (currentIdx / 3) * 100;
        progress.style.width = `${pct}%`;
      }
      
      // Detail summary
      document.getElementById('track-summary-label').innerHTML = `
        <p><strong>Shipping Status:</strong> <span style="color:var(--color-gold);">${match.status}</span></p>
        <p><strong>Shipping To:</strong> ${match.shipping.name} · ${match.shipping.address}, ${match.shipping.city}</p>
        <p><strong>Delivery Method:</strong> Luxury Concierge Freight Courier</p>
      `;
      
      timeline.style.display = 'block';
    } else {
      timeline.style.display = 'none';
      errBox.style.display = 'block';
    }
  } catch(e) {
    // Offline simulation
    if (id.startsWith('MM-')) {
      errBox.style.display = 'none';
      document.getElementById('track-order-id-label').textContent = id;
      document.getElementById('track-order-total-label').textContent = '$8,500';
      
      const progress = document.getElementById('tracking-progress-bar');
      progress.style.width = '33%';
      document.getElementById('node-ordered').classList.add('active');
      document.getElementById('node-processing').classList.add('active');
      document.getElementById('node-shipped').classList.remove('active');
      document.getElementById('node-delivered').classList.remove('active');
      
      document.getElementById('track-summary-label').innerHTML = `
        <p><strong>Shipping Status:</strong> <span style="color:var(--color-gold);">Processing</span></p>
        <p><strong>Delivery Method:</strong> Mock Freight Courier</p>
      `;
      timeline.style.display = 'block';
    } else {
      timeline.style.display = 'none';
      errBox.style.display = 'block';
    }
  }
}

// --- TESTIMONIALS SLIDER ---
function initTestimonials() {
  const prevBtn = document.getElementById('prev-testi-btn');
  const nextBtn = document.getElementById('next-testi-btn');
  
  if (!prevBtn || !nextBtn) return;
  
  const textEl = document.getElementById('testimonial-text');
  const authorEl = document.getElementById('testimonial-author');
  
  const showTestimonial = (idx) => {
    state.activeTestimonial = idx;
    const item = TESTIMONIALS[idx];
    textEl.style.opacity = '0';
    authorEl.style.opacity = '0';
    setTimeout(() => {
      textEl.textContent = `"${item.text}"`;
      authorEl.textContent = item.author;
      textEl.style.opacity = '1';
      authorEl.style.opacity = '1';
    }, 250);
  };

  prevBtn.onclick = () => {
    let nextIdx = state.activeTestimonial - 1;
    if (nextIdx < 0) nextIdx = TESTIMONIALS.length - 1;
    showTestimonial(nextIdx);
  };
  
  nextBtn.onclick = () => {
    let nextIdx = state.activeTestimonial + 1;
    if (nextIdx >= TESTIMONIALS.length) nextIdx = 0;
    showTestimonial(nextIdx);
  };
}

// --- AI GENERATOR VAULT SIMULATOR ---
function initAIGenerator() {
  const form = document.getElementById('ai-generator-form');
  const resultImg = document.getElementById('ai-generated-img');
  const placeholder = document.getElementById('ai-placeholder-msg');
  const loader = document.getElementById('ai-loading-indicator');
  
  if (!form) return;

  form.onsubmit = (e) => {
    e.preventDefault();
    placeholder.style.display = 'none';
    resultImg.style.display = 'none';
    loader.style.display = 'block';
    
    // Simulate generation loop
    setTimeout(() => {
      loader.style.display = 'none';
      // Pick dynamic stock photos of jewelry as concepts
      const mockImages = [
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&q=80&w=600'
      ];
      const randomImg = mockImages[Math.floor(Math.random() * mockImages.length)];
      resultImg.src = randomImg;
      resultImg.style.display = 'block';
    }, 2000);
  };
}

// --- Dynamic pricing and customized ring integration in Cart ---
function initCustomizer() {
  const metalBtns = document.querySelectorAll('[data-opt="metal"]');
  const gemBtns = document.querySelectorAll('[data-opt="gem"]');
  const designBtns = document.querySelectorAll('[data-opt="design"]');
  
  metalBtns.forEach(btn => btn.addEventListener('click', () => {
    setActiveOption(metalBtns, btn);
    state.customizer.metal = btn.getAttribute('data-val');
    updateCustomizerVisuals();
  }));
  
  gemBtns.forEach(btn => btn.addEventListener('click', () => {
    setActiveOption(gemBtns, btn);
    state.customizer.gem = btn.getAttribute('data-val');
    updateCustomizerVisuals();
  }));
  
  designBtns.forEach(btn => btn.addEventListener('click', () => {
    setActiveOption(designBtns, btn);
    state.customizer.design = btn.getAttribute('data-val');
    updateCustomizerVisuals();
  }));
  
  // Customizer add-to-cart link binding
  const orderBtn = document.getElementById('customizer-order-btn');
  if (orderBtn) {
    orderBtn.onclick = () => {
      const { metal, gem, design } = state.customizer;
      const baseCost = PRICING_MATRIX.metal[metal] + PRICING_MATRIX.gem[gem] + PRICING_MATRIX.design[design];
      
      const customProduct = {
        id: `custom-ring-${Date.now()}`,
        title: 'Bespoke Atelier Ring',
        price: `$${baseCost.toLocaleString()}`,
        img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=600',
        category: 'rings',
        desc: `Custom designed ring. Band Metal: ${METAL_COLORS[metal].label}, Gemstone: ${GEM_COLORS[gem].label}, Setting: ${DESIGN_LABELS[design]} Style.`
      };
      
      addItemToCart(customProduct, { Metal: METAL_COLORS[metal].label, Style: DESIGN_LABELS[design] });
    };
  }
  
  updateCustomizerVisuals();
}

function setActiveOption(buttonsList, activeBtn) {
  buttonsList.forEach(b => b.classList.remove('active'));
  activeBtn.classList.add('active');
}

function updateCustomizerVisuals() {
  const { metal, gem, design } = state.customizer;
  
  const baseCost = PRICING_MATRIX.metal[metal] + PRICING_MATRIX.gem[gem] + PRICING_MATRIX.design[design];
  
  const priceLabel = document.getElementById('customizer-price-text');
  const specLabel = document.getElementById('custom-spec');
  
  if (priceLabel) priceLabel.textContent = `$${baseCost.toLocaleString()}`;
  if (specLabel) specLabel.textContent = `${METAL_COLORS[metal].label} / ${GEM_COLORS[gem].label} / ${DESIGN_LABELS[design]}`;
  
  const shank = document.querySelector('.svg-ring-metal');
  if (shank) {
    const metalColor = METAL_COLORS[metal].fill;
    shank.style.color = metalColor;
    const circles = shank.querySelectorAll('circle');
    const paths = shank.querySelectorAll('path');
    circles.forEach(c => c.setAttribute('stroke', metalColor));
    paths.forEach(p => p.setAttribute('stroke', metalColor));
  }
  
  const gemElement = document.querySelector('.gemstone-render');
  if (gemElement) {
    const gemData = GEM_COLORS[gem];
    gemElement.style.backgroundColor = gemData.color;
    gemElement.style.boxShadow = `0 0 25px ${gemData.glow}`;
    
    if (design === 'solitaire') {
      gemElement.style.transform = 'scale(1)';
    } else if (design === 'halo') {
      gemElement.style.transform = 'scale(1.1)';
      gemElement.style.boxShadow = `0 0 35px ${gemData.glow}, 0 0 0 4px rgba(255,255,255,0.4)`;
    } else if (design === 'threestone') {
      gemElement.style.transform = 'scale(0.9)';
      gemElement.style.boxShadow = `0 0 20px ${gemData.glow}, -15px 5px 15px ${gemData.glow}, 15px 5px 15px ${gemData.glow}`;
    }
  }
}

// --- SCROLL ANIMATION ---
function initNavbarScroll() {
  const header = document.querySelector('header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

function initScrollReveals() {
  const reveals = document.querySelectorAll('.reveal');
  
  // 1. Intersection Observer (Standard and fast)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(r => observer.observe(r));
  } else {
    // Fallback: reveal everything immediately if IntersectionObserver is not supported
    reveals.forEach(r => r.classList.add('revealed'));
  }

  // 2. Click fallback for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          targetEl.classList.add('revealed');
          // Also reveal children with .reveal class inside it if any
          targetEl.querySelectorAll('.reveal').forEach(child => child.classList.add('revealed'));
        }
      }
    });
  });

  // 3. Scroll fallback (just in case)
  const checkReveal = () => {
    const triggerBottom = window.innerHeight * 0.95;
    reveals.forEach(r => {
      const rect = r.getBoundingClientRect();
      if (rect.top < triggerBottom) {
        r.classList.add('revealed');
      }
    });
  };
  window.addEventListener('scroll', checkReveal);
  // Run once initially to catch elements already in viewport
  setTimeout(checkReveal, 200);
}

