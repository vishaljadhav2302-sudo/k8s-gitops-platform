const productGrid = document.querySelector('#products');
const searchInput = document.querySelector('#search-input');
const categoryFilters = document.querySelector('#category-filters');
const cartDrawer = document.querySelector('#cart-drawer');
const drawerScrim = document.querySelector('#drawer-scrim');
const cartItems = document.querySelector('#cart-items');
const cartCount = document.querySelector('#cart-count');
const toastRegion = document.querySelector('#toast-region');
const ordersDialog = document.querySelector('#orders-dialog');
const orderHistory = document.querySelector('#order-history');
const fallbackImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 740"><rect width="800" height="740" fill="#e9eee8"/><path d="M0 560 220 355l126 120 153-190 301 275v180H0z" fill="#d5dfd4"/><circle cx="596" cy="180" r="58" fill="#f2c65d"/><text x="400" y="665" text-anchor="middle" fill="#526057" font-family="sans-serif" font-size="24">Image unavailable</text></svg>')}`;
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
let products = [];
let selectedCategory = 'All';
let cart = readCart();
let lastFocusedElement = null;

function readCart() {
  try {
    const stored = JSON.parse(localStorage.getItem('field-form-cart') || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((item) => item && typeof item.productId === 'string' && Number.isInteger(item.quantity) && item.quantity > 0);
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem('field-form-cart', JSON.stringify(cart));
}

function formatPrice(value) {
  return currency.format(value);
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function request(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Something went wrong. Please try again.');
  return payload;
}

function attachImageFallback(image) {
  image.addEventListener('error', () => {
    image.src = fallbackImage;
  }, { once: true });
}

function visibleProducts() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  return products.filter((product) => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.name.toLocaleLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
}

function renderProducts() {
  const filtered = visibleProducts();
  document.querySelector('#result-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'piece' : 'pieces'}`;
  if (filtered.length === 0) {
    productGrid.replaceChildren(Object.assign(document.createElement('p'), {
      className: 'empty-state',
      textContent: 'Nothing here just yet. Try another search or category.',
    }));
    return;
  }

  productGrid.replaceChildren(...filtered.map((product, index) => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.style.animationDelay = `${Math.min(index * 35, 210)}ms`;

    const media = document.createElement('div');
    media.className = 'product-media';
    const image = document.createElement('img');
    image.className = 'product-image';
    image.src = product.image;
    image.alt = product.name;
    image.loading = 'lazy';
    attachImageFallback(image);
    const category = document.createElement('span');
    category.className = 'product-category';
    category.textContent = product.category;
    media.append(image, category);

    const info = document.createElement('div');
    info.className = 'product-info';
    const meta = document.createElement('div');
    meta.className = 'product-meta';
    const rating = document.createElement('span');
    rating.className = 'product-rating';
    const star = document.createElement('span');
    star.className = 'star';
    star.setAttribute('aria-hidden', 'true');
    star.textContent = '★';
    rating.append(star, document.createTextNode(` ${Number(product.rating).toFixed(1)}`));
    const stock = document.createElement('span');
    stock.className = 'product-stock';
    stock.textContent = product.stock > 0 ? `${product.stock} in stock` : 'Out of stock';
    meta.append(rating, stock);

    const title = document.createElement('h2');
    title.className = 'product-title';
    title.textContent = product.name;
    const description = document.createElement('p');
    description.className = 'product-description';
    description.textContent = product.description;

    const purchase = document.createElement('div');
    purchase.className = 'product-purchase';
    const price = document.createElement('span');
    price.className = 'product-price';
    price.textContent = formatPrice(product.price);
    const addButton = document.createElement('button');
    addButton.className = 'add-button';
    addButton.type = 'button';
    addButton.dataset.addProduct = product.id;
    addButton.disabled = product.stock < 1;
    addButton.textContent = product.stock > 0 ? 'Add to cart' : 'Sold out';
    purchase.append(price, addButton);

    info.append(meta, title, description, purchase);
    card.append(media, info);
    return card;
  }));
}

function getProduct(productId) {
  return products.find((product) => product.id === productId);
}

function cartQuantity() {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

function cartTotals() {
  const subtotal = roundMoney(cart.reduce((sum, item) => {
    const product = getProduct(item.productId);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0));
  const gst = roundMoney(subtotal * 0.18);
  return { subtotal, gst, total: roundMoney(subtotal + gst) };
}

function renderCart() {
  cart = cart.filter((item) => getProduct(item.productId));
  saveCart();
  cartCount.textContent = String(cartQuantity());
  document.querySelector('#cart-line-count').textContent = `(${cart.length})`;
  const totals = cartTotals();
  document.querySelector('#cart-subtotal').textContent = formatPrice(totals.subtotal);
  document.querySelector('#cart-gst').textContent = formatPrice(totals.gst);
  document.querySelector('#cart-total').textContent = formatPrice(totals.total);
  document.querySelector('#place-order').disabled = cart.length === 0;

  if (cart.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cart-empty';
    const heading = document.createElement('strong');
    heading.textContent = 'Your cart is taking a breather.';
    empty.append(heading, document.createTextNode('Add something lovely from the collection.'));
    cartItems.replaceChildren(empty);
    return;
  }

  cartItems.replaceChildren(...cart.map((item) => {
    const product = getProduct(item.productId);
    const row = document.createElement('article');
    row.className = 'cart-row';
    const image = document.createElement('img');
    image.className = 'cart-thumb';
    image.src = product.image;
    image.alt = '';
    attachImageFallback(image);

    const details = document.createElement('div');
    const name = document.createElement('h3');
    name.className = 'cart-product-name';
    name.textContent = product.name;
    const unitPrice = document.createElement('div');
    unitPrice.className = 'cart-product-price';
    unitPrice.textContent = formatPrice(product.price);
    const controls = document.createElement('div');
    controls.className = 'quantity-control';
    const decrement = document.createElement('button');
    decrement.type = 'button';
    decrement.dataset.cartAction = 'decrement';
    decrement.dataset.productId = product.id;
    decrement.disabled = item.quantity <= 1;
    decrement.setAttribute('aria-label', `Decrease ${product.name} quantity`);
    decrement.textContent = '−';
    const quantity = document.createElement('span');
    quantity.className = 'quantity-value';
    quantity.textContent = String(item.quantity);
    const increment = document.createElement('button');
    increment.type = 'button';
    increment.dataset.cartAction = 'increment';
    increment.dataset.productId = product.id;
    increment.disabled = item.quantity >= product.stock;
    increment.setAttribute('aria-label', `Increase ${product.name} quantity`);
    increment.textContent = '+';
    controls.append(decrement, quantity, increment);
    details.append(name, unitPrice, controls);

    const end = document.createElement('div');
    end.className = 'cart-row-end';
    const lineTotal = document.createElement('strong');
    lineTotal.className = 'cart-line-total';
    lineTotal.textContent = formatPrice(product.price * item.quantity);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-button';
    remove.dataset.cartAction = 'remove';
    remove.dataset.productId = product.id;
    remove.textContent = 'Remove';
    end.append(lineTotal, remove);
    row.append(image, details, end);
    return row;
  }));
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' is-error' : ''}`;
  toast.setAttribute('role', isError ? 'alert' : 'status');
  toast.textContent = message;
  toastRegion.append(toast);
  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 220);
  }, 3000);
}

function openCart() {
  lastFocusedElement = document.activeElement;
  drawerScrim.hidden = false;
  requestAnimationFrame(() => drawerScrim.classList.add('is-open'));
  cartDrawer.classList.add('is-open');
  cartDrawer.setAttribute('aria-hidden', 'false');
  cartDrawer.inert = false;
  document.querySelector('#close-cart').focus();
}

function closeCart() {
  drawerScrim.classList.remove('is-open');
  cartDrawer.classList.remove('is-open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  cartDrawer.inert = true;
  window.setTimeout(() => { drawerScrim.hidden = true; }, 230);
  if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
}

function addToCart(productId) {
  const product = getProduct(productId);
  if (!product || product.stock < 1) return;
  const existing = cart.find((item) => item.productId === productId);
  if (existing) {
    if (existing.quantity >= product.stock) {
      showToast('That is all the stock we have right now.', true);
      return;
    }
    existing.quantity += 1;
  } else {
    cart.push({ productId, quantity: 1 });
  }
  renderCart();
  showToast(`${product.name} added to your cart.`);
}

categoryFilters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  selectedCategory = button.dataset.category;
  categoryFilters.querySelectorAll('[data-category]').forEach((pill) => {
    const isActive = pill === button;
    pill.classList.toggle('is-active', isActive);
    pill.setAttribute('aria-pressed', String(isActive));
  });
  renderProducts();
});

searchInput.addEventListener('input', renderProducts);
productGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add-product]');
  if (button) addToCart(button.dataset.addProduct);
});

document.querySelector('#cart-trigger').addEventListener('click', openCart);
document.querySelector('#close-cart').addEventListener('click', closeCart);
drawerScrim.addEventListener('click', closeCart);
cartItems.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cart-action]');
  if (!button) return;
  const { cartAction, productId } = button.dataset;
  const item = cart.find((entry) => entry.productId === productId);
  if (!item) return;
  if (cartAction === 'remove') cart = cart.filter((entry) => entry.productId !== productId);
  if (cartAction === 'decrement' && item.quantity > 1) item.quantity -= 1;
  if (cartAction === 'increment' && item.quantity < getProduct(productId).stock) item.quantity += 1;
  renderCart();
});

document.querySelector('#checkout-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity() || cart.length === 0) return;
  const button = document.querySelector('#place-order');
  const customerName = document.querySelector('#customer-name').value.trim();
  const totals = cartTotals();
  const items = cart.map((item) => {
    const product = getProduct(item.productId);
    return { productId: product.id, name: product.name, price: product.price, quantity: item.quantity };
  });
  button.disabled = true;
  button.firstChild.textContent = 'Placing order... ';
  try {
    const order = await request('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customerName, items, totalAmount: totals.total }),
    });
    cart = [];
    saveCart();
    renderCart();
    document.querySelector('#customer-name').value = '';
    closeCart();
    showToast(`Order ${order.orderId.slice(0, 8)} confirmed. Thank you, ${order.customerName}.`);
  } catch (error) {
    button.disabled = false;
    showToast(error.message, true);
  } finally {
    button.firstChild.textContent = 'Place order ';
  }
});

function renderOrderHistory(orders) {
  if (orders.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = 'No orders yet. The good things are waiting when you are.';
    orderHistory.replaceChildren(empty);
    return;
  }

  orderHistory.replaceChildren(...orders.slice().reverse().map((order) => {
    const card = document.createElement('article');
    card.className = 'order-card';
    const top = document.createElement('div');
    top.className = 'order-card-top';
    const reference = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'order-reference';
    title.textContent = `Order ${order.orderId.slice(0, 8)}`;
    const date = document.createElement('p');
    date.className = 'order-date';
    date.textContent = new Date(order.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    reference.append(title, date);
    const status = document.createElement('span');
    status.className = 'status-badge';
    status.textContent = order.status;
    top.append(reference, status);

    const customer = document.createElement('p');
    customer.className = 'order-customer';
    customer.textContent = `Placed by ${order.customerName}`;
    const itemList = document.createElement('div');
    itemList.className = 'history-items';
    itemList.replaceChildren(...order.items.map((item) => {
      const line = document.createElement('div');
      line.textContent = `${item.quantity} × ${item.name} · ${formatPrice(item.price * item.quantity)}`;
      return line;
    }));
    const total = document.createElement('div');
    total.className = 'history-total';
    const totalLabel = document.createElement('span');
    totalLabel.textContent = 'Total paid';
    const totalPrice = document.createElement('span');
    totalPrice.textContent = formatPrice(order.totalAmount);
    total.append(totalLabel, totalPrice);
    card.append(top, customer, itemList, total);
    return card;
  }));
}

document.querySelector('#orders-trigger').addEventListener('click', async () => {
  orderHistory.innerHTML = '<p class="loading-message">Loading your orders...</p>';
  ordersDialog.showModal();
  try {
    renderOrderHistory(await request('/api/orders'));
  } catch (error) {
    orderHistory.textContent = error.message;
  }
});
document.querySelector('#close-orders').addEventListener('click', () => ordersDialog.close());
ordersDialog.addEventListener('click', (event) => {
  if (event.target === ordersDialog) ordersDialog.close();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && cartDrawer.classList.contains('is-open')) closeCart();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
  }
});

async function loadProducts() {
  try {
    products = await request('/api/products');
    cart = cart.filter((item) => products.some((product) => product.id === item.productId));
    renderProducts();
    renderCart();
    productGrid.setAttribute('aria-busy', 'false');
  } catch (error) {
    productGrid.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-state', textContent: error.message }));
    productGrid.setAttribute('aria-busy', 'false');
  }
}

loadProducts();