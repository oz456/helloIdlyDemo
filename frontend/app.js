// app.js - HelloIdly Frontend Logic

// State
let menuData = [];
let cart = JSON.parse(localStorage.getItem('helloIdlyCart')) || {};

// DOM Elements
const menuItemsContainer = document.getElementById('menu-items');
const categoryTabsContainer = document.querySelector('.category-tabs');
const stickyCartBtn = document.querySelector('.sticky-cart');

// Initiate Payment (called from Cart)
async function initiatePayment() {
    const items = Object.values(cart);
    if (items.length === 0) return alert('Cart is empty');

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderData = { items, total };

    try {
        const response = await fetch('/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) throw new Error('Order creation failed');
        const data = await response.json();
        window.location.href = `pay.html?orderId=${data.orderId}`;
    } catch (error) {
        console.error('API failed, using mock for demo', error);
        // Mock order creation
        const mockOrderId = 'ORD-' + Date.now().toString().slice(-6);
        localStorage.setItem('currentOrder', JSON.stringify({ ...orderData, orderId: mockOrderId, status: 'PENDING' }));
        window.location.href = `pay.html?orderId=${mockOrderId}`;
    }
}

// Handle Payment Page
async function handlePaymentPage() {
    const payAmountEl = document.getElementById('pay-amount');
    if (!payAmountEl) return;

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');

    if (!orderId) {
        alert('No order ID found');
        window.location.href = 'menu.html';
        return;
    }

    // Fetch order details
    let order;
    try {
        const response = await fetch(`/api/order/${orderId}`);
        if (response.ok) {
            order = await response.json();
        } else {
            throw new Error('Fetch failed');
        }
    } catch (e) {
        // Mock fallback
        const stored = JSON.parse(localStorage.getItem('currentOrder'));
        if (stored && stored.orderId === orderId) order = stored;
    }

    if (order) {
        payAmountEl.textContent = `₹${order.total}`;
        setupUPI(order.total, order.orderId);
        pollPaymentStatus(orderId);
    }
}

// Setup UPI Links
function setupUPI(amount, orderId) {
    const upiId = 'merchant@upi'; // Placeholder
    const name = 'HelloIdly';
    const url = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&tn=${orderId}&cu=INR`;

    document.getElementById('gpay-link').href = url;
    document.getElementById('phonepe-link').href = url;
    document.getElementById('paytm-link').href = url;
}

// Poll Payment Status
function pollPaymentStatus(orderId) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`/api/order/${orderId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'PAID') {
                    clearInterval(interval);
                    window.location.href = `success.html?orderId=${orderId}`;
                }
            }
        } catch (e) {
            // Mock simulation: Auto-success after 5 seconds
            console.log('Polling mock status...');
            // In a real app, we wouldn't auto-approve in frontend. 
            // But for this demo without backend, we'll simulate success.
            setTimeout(() => {
                clearInterval(interval);
                // Update mock status
                const stored = JSON.parse(localStorage.getItem('currentOrder'));
                if (stored) {
                    stored.status = 'PAID';
                    stored.passcode = Math.floor(1000000000 + Math.random() * 9000000000); // 10 digit
                    stored.orderNo = Math.floor(100 + Math.random() * 900); // 3 digit
                    localStorage.setItem('currentOrder', JSON.stringify(stored));
                }
                window.location.href = `success.html?orderId=${orderId}`;
            }, 5000);
        }
    }, 2000);
}

// Handle Success Page
async function handleSuccessPage() {
    const orderNoEl = document.getElementById('order-no');
    const passCodeEl = document.getElementById('pass-code');
    const statusEl = document.getElementById('order-status');

    if (!orderNoEl) return;

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');

    if (!orderId) {
        window.location.href = 'menu.html';
        return;
    }

    // Clear cart on success
    if (Object.keys(cart).length > 0) {
        cart = {};
        saveCart();
        updateCartUI();
    }

    // Fetch Order Details
    let order;
    try {
        const response = await fetch(`/api/order/${orderId}`);
        if (response.ok) {
            order = await response.json();
        } else {
            throw new Error('Fetch failed');
        }
    } catch (e) {
        // Mock fallback / Offline support
        const stored = JSON.parse(localStorage.getItem('currentOrder'));
        if (stored && stored.orderId === orderId) order = stored;
    }

    if (order) {
        orderNoEl.textContent = order.orderNo || '---';
        passCodeEl.textContent = order.passcode || '---';
        if (statusEl) statusEl.textContent = order.status;

        // Poll for status updates (e.g. READY)
        pollOrderStatus(orderId);
    }
}

// Poll Order Status (for Success Page)
function pollOrderStatus(orderId) {
    const statusEl = document.getElementById('order-status');
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`/api/order/${orderId}`);
            if (response.ok) {
                const data = await response.json();
                if (statusEl) statusEl.textContent = data.status;
                if (data.status === 'COLLECTED') {
                    clearInterval(interval);
                }
            }
        } catch (e) {
            // Offline or error, just keep showing last known
        }
    }, 5000);
}

// Initialization Update
document.addEventListener('DOMContentLoaded', () => {
    if (menuItemsContainer) {
        fetchMenu();
    }
    if (document.getElementById('cart-items')) {
        renderCart();
        // Attach click to Pay Now button
        const payBtn = document.querySelector('.pay-btn');
        if (payBtn) {
            payBtn.onclick = (e) => {
                e.preventDefault();
                initiatePayment();
            };
        }
    }
    handlePaymentPage();
    handleSuccessPage();
    updateCartUI();
});

// Fetch Menu
async function fetchMenu() {
    try {
        // Try fetching from API first, fallback to local file for dev/testing if needed
        // In production this should be /api/menu
        const response = await fetch('/api/menu');
        if (!response.ok) throw new Error('Failed to fetch menu');
        menuData = await response.json();
        renderCategories();
        renderMenu('all');
    } catch (error) {
        console.error(error);
        menuItemsContainer.innerHTML = '<p>Error loading menu. Please try again.</p>';
        // Fallback for development without backend (optional, remove in prod)
        // fetch('../menu.json').then(res => res.json()).then(data => { menuData = data; renderCategories(); renderMenu('all'); });
    }
}

// Render Categories
function renderCategories() {
    if (!categoryTabsContainer) return;

    const categories = ['All', ...menuData.map(c => c.category)];
    categoryTabsContainer.innerHTML = categories.map(cat => `
    <button class="tab ${cat === 'All' ? 'active' : ''}" data-category="${cat}">
      ${cat}
    </button>
  `).join('');

    categoryTabsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab')) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            renderMenu(e.target.dataset.category);
        }
    });
}

// Render Menu Items
function renderMenu(category) {
    if (!menuItemsContainer) return;

    let itemsToRender = [];
    if (category === 'All' || category === 'all') {
        menuData.forEach(cat => itemsToRender.push(...cat.items));
    } else {
        const catData = menuData.find(c => c.category === category);
        itemsToRender = catData ? catData.items : [];
    }

    menuItemsContainer.innerHTML = itemsToRender.map(item => {
        const qty = cart[item.id] ? cart[item.id].quantity : 0;
        return `
      <div class="menu-item">
        <div class="item-info">
          <h3 class="item-name">${item.name}</h3>
          <p class="item-price">₹${item.price}</p>
        </div>
        <div class="item-actions">
          ${qty > 0 ? `
            <div class="qty-control">
              <button onclick="updateQuantity(${item.id}, -1)">-</button>
              <span>${qty}</span>
              <button onclick="updateQuantity(${item.id}, 1)">+</button>
            </div>
          ` : `
            <button class="add-btn" onclick="updateQuantity(${item.id}, 1)">Add</button>
          `}
        </div>
      </div>
    `;
    }).join('');
}

// Render Cart
function renderCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalEl = document.getElementById('cart-total');

    if (!cartItemsContainer) return;

    const items = Object.values(cart);

    if (items.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align:center; opacity:0.7; margin-top:2rem;">Your cart is empty.</p>';
        if (cartTotalEl) cartTotalEl.textContent = '₹0';
        return;
    }

    cartItemsContainer.innerHTML = items.map(item => `
    <div class="cart-item">
      <div class="item-info">
        <h3 class="item-name">${item.name}</h3>
        <p class="item-price">₹${item.price} x ${item.quantity}</p>
      </div>
      <div class="item-actions">
        <div class="qty-control">
          <button onclick="updateQuantity(${item.id}, -1)">-</button>
          <span>${item.quantity}</span>
          <button onclick="updateQuantity(${item.id}, 1)">+</button>
        </div>
      </div>
      <div class="item-total">₹${item.price * item.quantity}</div>
    </div>
  `).join('');

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (cartTotalEl) cartTotalEl.textContent = `₹${total}`;
}

// Update Quantity (Modified to refresh cart)
window.updateQuantity = function (itemId, change) {
    // If we are on menu page, we need menuData to find item
    // If on cart page, we might rely on cart data itself if menuData isn't loaded
    // But let's try to find in cart first

    let item = cart[itemId];

    // If not in cart (adding new from menu), find in menuData
    if (!item && menuData.length > 0) {
        for (const cat of menuData) {
            const found = cat.items.find(i => i.id === itemId);
            if (found) {
                item = { ...found, quantity: 0 };
                break;
            }
        }
    }

    if (!item) return;

    if (!cart[itemId]) {
        cart[itemId] = item;
    }

    cart[itemId].quantity += change;

    if (cart[itemId].quantity <= 0) {
        delete cart[itemId];
    }

    saveCart();

    // Refresh Views
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) renderMenu(activeTab.dataset.category);

    renderCart(); // Refresh cart page if active
    updateCartUI(); // Refresh sticky button
};

// Save Cart
function saveCart() {
    localStorage.setItem('helloIdlyCart', JSON.stringify(cart));
}

// Update Cart UI (Sticky Button)
function updateCartUI() {
    if (!stickyCartBtn) return;

    const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);

    stickyCartBtn.textContent = `View Cart (${totalItems}) • ₹${totalPrice}`;

    if (totalItems > 0) {
        stickyCartBtn.classList.add('visible');
    } else {
        stickyCartBtn.classList.remove('visible');
    }
}
