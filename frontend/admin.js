// admin.js - HelloIdly Admin Portal Logic

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const ordersList = document.getElementById('orders-list');
    if (ordersList) {
        checkAuth();
        startOrderPolling();
    }
});

function checkAuth() {
    if (!localStorage.getItem('adminToken')) {
        window.location.href = 'login.html';
    }
}

function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = 'login.html';
}

async function handleLogin(e) {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    const errorMsg = document.getElementById('login-error');

    // Hardcoded check (Mocking backend validation)
    if (username === 'admin' && password === 'admin123') {
        localStorage.setItem('adminToken', 'valid-token');
        window.location.href = 'orders.html';
    } else {
        errorMsg.textContent = 'Invalid credentials';
    }
}

// Order Management
let orders = [];

function startOrderPolling() {
    fetchOrders();
    setInterval(fetchOrders, 5000);
    setInterval(updateTimers, 60000); // Update minute timers
}

async function fetchOrders() {
    try {
        const response = await fetch('/api/admin/orders');
        if (response.ok) {
            orders = await response.json();
            renderOrders();
        } else {
            throw new Error('Fetch failed');
        }
    } catch (e) {
        // Mock fallback
        const stored = JSON.parse(localStorage.getItem('currentOrder'));
        if (stored) {
            orders = [stored]; // Just one for demo
            renderOrders();
        } else {
            renderOrders(); // Empty
        }
    }
}

function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align:center; opacity:0.7;">No active orders.</p>';
        return;
    }

    // Sort by status priority (PAID > READY > COLLECTED) and time
    // For now just render

    container.innerHTML = orders.map(order => {
        const timeAgo = Math.floor((Date.now() - (order.timestamp || Date.now())) / 60000);
        return `
      <div class="order-card">
        <div class="order-header">
          <span class="order-id">#${order.orderNo || '---'}</span>
          <span class="order-timer">${timeAgo} min ago</span>
        </div>
        
        <div class="order-items">
          <ul>
            ${order.items.map(item => `
              <li>
                <span>${item.name}</span>
                <span>x${item.quantity}</span>
              </li>
            `).join('')}
          </ul>
          <div class="passcode-mask">Passcode: **** ${order.passcode ? order.passcode.slice(-4) : '----'}</div>
        </div>

        <div class="order-actions">
          <div style="margin-bottom:0.5rem; font-weight:bold; color:${getStatusColor(order.status)}">${order.status}</div>
          ${getActionButtons(order)}
        </div>
      </div>
    `;
    }).join('');
}

function getStatusColor(status) {
    if (status === 'PAID') return '#4285F4';
    if (status === 'READY') return '#FBBC05';
    if (status === 'COLLECTED') return '#34A853';
    return '#fff';
}

function getActionButtons(order) {
    if (order.status === 'PAID') {
        return `<button class="action-btn btn-ready" onclick="updateStatus('${order.orderId}', 'READY')">Mark Ready</button>`;
    }
    if (order.status === 'READY') {
        return `<button class="action-btn btn-collected" onclick="updateStatus('${order.orderId}', 'COLLECTED')">Mark Collected</button>`;
    }
    return '';
}

async function updateStatus(orderId, status) {
    try {
        await fetch(`/api/admin/order/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        fetchOrders();
    } catch (e) {
        // Mock update
        const stored = JSON.parse(localStorage.getItem('currentOrder'));
        if (stored && stored.orderId === orderId) {
            stored.status = status;
            localStorage.setItem('currentOrder', JSON.stringify(stored));
            fetchOrders();
        }
    }
}

function updateTimers() {
    renderOrders(); // Re-render to update times
}

// Search Logic
async function searchOrder() {
    const input = document.getElementById('search-input').value.trim();
    const resultsContainer = document.getElementById('search-results');

    if (!input || !resultsContainer) return;

    resultsContainer.innerHTML = '<p style="text-align:center;">Searching...</p>';

    try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(input)}`);
        if (response.ok) {
            const results = await response.json();
            renderSearchResults(results);
        } else {
            throw new Error('Search failed');
        }
    } catch (e) {
        // Mock search
        const stored = JSON.parse(localStorage.getItem('currentOrder'));
        if (stored && (stored.orderNo == input || (stored.passcode && stored.passcode.endsWith(input)))) {
            renderSearchResults([stored]);
        } else {
            renderSearchResults([]);
        }
    }
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = '<p style="text-align:center;">No orders found.</p>';
        return;
    }

    // Reuse similar HTML structure
    container.innerHTML = results.map(order => {
        const timeAgo = Math.floor((Date.now() - (order.timestamp || Date.now())) / 60000);
        return `
      <div class="order-card">
        <div class="order-header">
          <span class="order-id">#${order.orderNo || '---'}</span>
          <span class="order-timer">${timeAgo} min ago</span>
        </div>
        
        <div class="order-items">
          <ul>
            ${order.items.map(item => `
              <li>
                <span>${item.name}</span>
                <span>x${item.quantity}</span>
              </li>
            `).join('')}
          </ul>
          <div class="passcode-mask">Passcode: ${order.passcode}</div>
        </div>

        <div class="order-actions">
          <div style="margin-bottom:0.5rem; font-weight:bold; color:${getStatusColor(order.status)}">${order.status}</div>
          ${getActionButtons(order)}
        </div>
      </div>
    `;
    }).join('');
}

// Menu Management Logic
let adminMenuData = [];

document.addEventListener('DOMContentLoaded', () => {
    const adminMenuList = document.getElementById('admin-menu-list');
    if (adminMenuList) {
        checkAuth();
        fetchAdminMenu();
    }
});

async function fetchAdminMenu() {
    try {
        const response = await fetch('/api/menu'); // Use same public API for now
        if (response.ok) {
            adminMenuData = await response.json();
            renderAdminMenu();
        } else {
            throw new Error('Fetch failed');
        }
    } catch (e) {
        // Fallback to local file fetch for dev
        try {
            const res = await fetch('../../menu.json');
            adminMenuData = await res.json();
            renderAdminMenu();
        } catch (err) {
            console.error(err);
        }
    }
}

function renderAdminMenu() {
    const container = document.getElementById('admin-menu-list');
    if (!container) return;

    container.innerHTML = adminMenuData.map(cat => `
    <div class="menu-category-admin">
      <h2 style="border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem;">${cat.category}</h2>
      ${cat.items.map(item => `
        <div class="admin-menu-item ${item.available === false ? 'unavailable' : ''}">
          <div class="item-details">
            <span class="item-name">${item.name}</span>
            <div class="price-edit">
              <span>₹</span>
              <input type="number" value="${item.price}" onchange="updatePrice(${item.id}, this.value)" />
            </div>
          </div>
          <div class="item-controls">
            <label class="switch">
              <input type="checkbox" ${item.available !== false ? 'checked' : ''} onchange="toggleAvailability(${item.id}, this.checked)">
              <span class="slider round"></span>
            </label>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

async function updatePrice(itemId, newPrice) {
    // In real app: PUT /api/admin/menu/:id
    console.log(`Update price for ${itemId} to ${newPrice}`);
    // Mock update local state
    for (const cat of adminMenuData) {
        const item = cat.items.find(i => i.id === itemId);
        if (item) {
            item.price = parseInt(newPrice);
            break;
        }
    }
}

async function toggleAvailability(itemId, isAvailable) {
    // In real app: PUT /api/admin/menu/:id
    console.log(`Set availability for ${itemId} to ${isAvailable}`);
    // Mock update local state
    for (const cat of adminMenuData) {
        const item = cat.items.find(i => i.id === itemId);
        if (item) {
            item.available = isAvailable;
            break;
        }
    }
    renderAdminMenu(); // Re-render to update visual state
}
