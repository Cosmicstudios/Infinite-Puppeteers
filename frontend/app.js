let categories = [];
let niches = [];
let categoryMap = {};
let nicheMap = {};
let selectedCategory = null;
let selectedNiche = null;

async function fetchCategories() {
  const res = await fetch('/api/categories');
  if (!res.ok) return [];
  return res.json();
}

async function fetchNiches(categoryId) {
  if (!categoryId) return [];
  const res = await fetch(`/api/categories/${categoryId}/niches`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchProducts(category, niche) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (niche) params.set('niche', niche);
  const url = '/api/products' + (params.toString() ? `?${params.toString()}` : '');
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

function renderProducts(list) {
  const container = document.getElementById('products');
  if (!list || !list.length) {
    container.innerHTML = '<em>No products</em>';
    return;
  }
  container.innerHTML = list.map(p => {
    const cname = (p.categoryId && categoryMap[p.categoryId]) ? categoryMap[p.categoryId].name : (p.category || 'Uncategorized');
    const nname = (p.nicheId && nicheMap[p.nicheId]) ? nicheMap[p.nicheId].name : '';
    return `<div class="product"><strong>${escapeHtml(p.title)}</strong><div>Price: ${p.price}</div><div>Category: ${cname}${nname?(' / '+nname):''}</div><div>ID: ${p.id}</div></div>`;
  }).join('');
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

function renderCategories() {
  const el = document.getElementById('categories');
  el.innerHTML = '';
  categories.forEach(c => {
    const div = document.createElement('div');
    div.className = 'category' + (selectedCategory===c.id? ' selected' : '');
    div.textContent = c.name;
    div.onclick = async () => {
      if (selectedCategory === c.id) { selectedCategory = null; selectedNiche = null; }
      else { selectedCategory = c.id; selectedNiche = null; }
      await refreshNiches();
      await refreshProducts();
      renderCategories();
    };
    el.appendChild(div);
  });
}

function renderNiches() {
  const el = document.getElementById('niches');
  const title = document.getElementById('nicheTitle');
  el.innerHTML = '';
  if (!selectedCategory) { title.style.display='none'; return; }
  title.style.display='block';
  niches.forEach(n => {
    const d = document.createElement('div');
    d.className = 'niche' + (selectedNiche===n.id? ' selected' : '');
    d.textContent = n.name;
    d.onclick = async () => {
      if (selectedNiche === n.id) selectedNiche = null; else selectedNiche = n.id;
      await refreshProducts();
      renderNiches();
    };
    el.appendChild(d);
  });
}

async function refreshNiches(){
  if (!selectedCategory) { niches = []; renderNiches(); return; }
  niches = await fetchNiches(selectedCategory);
  nicheMap = {};
  niches.forEach(n=>nicheMap[n.id]=n);
  renderNiches();
}

async function refreshProducts(){
  const prods = await fetchProducts(selectedCategory, selectedNiche);
  renderProducts(prods);
}

async function load(){
  categories = await fetchCategories();
  categoryMap = {};
  categories.forEach(c=>categoryMap[c.id]=c);
  renderCategories();
  await refreshNiches();
  await refreshProducts();
}

// keep existing demo handlers for orders/payments
document.getElementById('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const productId = document.getElementById('productId').value;
  const qty = parseInt(document.getElementById('qty').value || '1', 10);
  const coupon = document.getElementById('coupon').value || null;
  const prods = await fetchProducts();
  const product = prods.find(p => p.id === productId) || prods[0];
  if (!product) { alert('No product available'); return; }
  const items = [{ productId: product.id, qty, price: product.price || 0 }];
  const body = { buyer: 'demo_buyer', items };
  if (coupon) body.couponCode = coupon;
  const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const out = document.getElementById('orderResult');
  if (res.ok) {
    const data = await res.json();
    out.innerText = 'Order created: ' + JSON.stringify(data, null, 2);
    document.getElementById('paymentOrderId').value = data.id;
    refreshProducts();
  } else {
    const err = await res.json().catch(()=>({error:'unknown'}));
    out.innerText = 'Order failed: ' + JSON.stringify(err);
  }
});

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const orderId = document.getElementById('paymentOrderId').value;
  if (!orderId) { alert('Enter an order ID'); return; }
  const res = await fetch('/api/stripe/create-payment-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
  const out = document.getElementById('paymentResult');
  if (res.ok) {
    const data = await res.json();
    out.innerText = 'Payment intent: ' + JSON.stringify(data, null, 2);
  } else {
    const err = await res.json().catch(()=>({error:'unknown'}));
    out.innerText = 'Payment failed: ' + JSON.stringify(err);
  }
});

document.getElementById('prodForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('title').value;
  const price = parseFloat(document.getElementById('price').value || '0');
  const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, price })});
  if (res.ok) {
    document.getElementById('title').value = '';
    document.getElementById('price').value = '';
    refreshProducts();
  } else {
    alert('Failed to create product (requires vendor auth)');
  }
});

load();
