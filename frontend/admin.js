const state = { token: null };

function authHeaders() {
  if (!state.token) return {};
  return { Authorization: state.token, 'Content-Type': 'application/json' };
}

async function fetchVendors() {
  const res = await fetch('/api/vendors');
  return res.ok ? res.json() : [];
}

async function fetchAdminOrders() {
  const res = await fetch('/api/admin/orders', { headers: authHeaders() });
  return res.ok ? res.json() : [];
}

async function fetchCommissions() {
  const res = await fetch('/api/admin/commissions', { headers: authHeaders() });
  return res.ok ? res.json() : [];
}

async function fetchPayouts() {
  const res = await fetch('/api/admin/payouts', { headers: authHeaders() });
  return res.ok ? res.json() : [];
}

async function approveVendor(id) {
  const res = await fetch(`/api/admin/vendors/${id}/approve`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) alert('Approve failed');
  await refreshAll();
}

async function payCommission(id) {
  const res = await fetch(`/api/admin/commissions/${id}/pay`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) { const err = await res.json().catch(()=>({})); alert('Pay failed: ' + JSON.stringify(err)); }
  await refreshAll();
}

async function refreshAll() {
  const vendors = await fetchVendors();
  document.getElementById('vendors').innerHTML = vendors.map(v => `<div style="border:1px solid #ddd;padding:8px;margin:6px"><strong>${v.businessName}</strong> (${v.status})<div>id: ${v.id}</div>${v.status==='pending'?`<button onclick="approveVendor('${v.id}')">Approve</button>`:''}</div>`).join('') || '<em>No vendors</em>';

  const orders = await fetchAdminOrders();
  document.getElementById('orders').innerHTML = orders.map(o => `<div style="border:1px solid #ddd;padding:8px;margin:6px"><strong>Order ${o.id}</strong> total: ${o.total} status:${o.status} payment:${o.paymentStatus || 'n/a'}<pre>${JSON.stringify(o.items,null,2)}</pre></div>`).join('') || '<em>No orders</em>';

  const comms = await fetchCommissions();
  document.getElementById('commissions').innerHTML = comms.map(c => `<div style="border:1px solid #ddd;padding:8px;margin:6px"><strong>${c.id}</strong> order:${c.orderId} vendor:${c.vendorId} amount:${c.amount} status:${c.status} ${c.status!=='paid' ? `<button onclick="payCommission('${c.id}')">Mark Paid</button>` : ''}</div>`).join('') || '<em>No commissions</em>';

  const payouts = await fetchPayouts();
  document.getElementById('payouts').innerHTML = payouts.map(p => `<div style="border:1px solid #ddd;padding:8px;margin:6px"><strong>${p.id}</strong> vendor:${p.vendorId} amount:${p.amount} status:${p.status}</div>`).join('') || '<em>No payouts</em>';
}

document.getElementById('setToken').addEventListener('click', () => {
  const t = document.getElementById('token').value.trim();
  if (!t) return alert('Set token first (example: Bearer <token>)');
  state.token = t;
  refreshAll();
});

// expose for inline onclick
window.approveVendor = approveVendor;
window.payCommission = payCommission;

// initial load (no auth)
refreshAll();
