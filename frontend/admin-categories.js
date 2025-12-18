async function api(path, method='GET', body=null, token=null){
  const headers = {};
  if (body) headers['Content-Type']='application/json';
  if (token) headers['Authorization']=token;
  const res = await fetch(path, { method, headers, body: body?JSON.stringify(body):undefined });
  return res;
}

async function loadCats(){
  const res = await api('/api/categories');
  const cats = await res.json();
  const container = document.getElementById('cats');
  container.innerHTML = '';
  cats.forEach(c => {
    const div = document.createElement('div');
    div.className='item';
    div.innerHTML = `
      <strong>${c.name}</strong> (id: ${c.id}) <div>${c.icon||''} ${c.description||''}</div>
      <div class="row"><div class="col"><input placeholder="New name" value="${c.name}" data-id="${c.id}" class="editName" /></div>
      <div class="col"><input placeholder="Commission" value="${c.commissionRate||''}" data-id="${c.id}" class="editCommission" /></div></div>
      <div class="row"><div class="col"><textarea data-id="${c.id}" class="editDesc">${c.description||''}</textarea></div>
      <div style="width:240px"><button class="saveCat" data-id="${c.id}">Save</button> <button class="delCat" data-id="${c.id}">Delete</button></div></div>
      <div><strong>Niches</strong><div id="niches_${c.id}">Loading...</div>
      <input placeholder="Niche name" id="newn_${c.id}" /> <button class="addNiche" data-id="${c.id}">Add Niche</button>
      </div>
    `;
    container.appendChild(div);
  });
  // attach handlers
  document.querySelectorAll('.saveCat').forEach(b=>b.onclick=saveCat);
  document.querySelectorAll('.delCat').forEach(b=>b.onclick=delCat);
  document.querySelectorAll('.addNiche').forEach(b=>b.onclick=addNiche);
  // load niches per category
  cats.forEach(c=>loadNiches(c.id));
}

async function loadNiches(catId){
  const res = await api(`/api/categories/${catId}/niches`);
  const list = await res.json();
  const el = document.getElementById('niches_'+catId);
  el.innerHTML = '';
  list.forEach(n=>{
    const d = document.createElement('div');
    d.textContent = n.name + ' ('+n.id+')';
    const del = document.createElement('button'); del.textContent='Delete'; del.onclick=()=>delNiche(n.id);
    d.appendChild(del);
    el.appendChild(d);
  });
}

async function saveCat(e){
  const id = e.target.dataset.id;
  const token = document.getElementById('token').value;
  const name = document.querySelector(`.editName[data-id=\"${id}\"]`).value;
  const commission = parseFloat(document.querySelector(`.editCommission[data-id=\"${id}\"]`).value||'0');
  const desc = document.querySelector(`.editDesc[data-id=\"${id}\"]`).value;
  const res = await api(`/api/admin/categories/${id}`, 'PUT', { name, description: desc, commissionRate: commission }, token);
  if (res.ok) { alert('Saved'); loadCats(); } else alert('Failed');
}

async function delCat(e){
  const id = e.target.dataset.id;
  const token = document.getElementById('token').value;
  if (!confirm('Delete category '+id+'?')) return;
  const res = await api(`/api/admin/categories/${id}`, 'DELETE', null, token);
  if (res.ok) loadCats(); else alert('Failed');
}

async function addNiche(e){
  const id = e.target.dataset.id;
  const token = document.getElementById('token').value;
  const name = document.getElementById('newn_'+id).value;
  const res = await api(`/api/admin/categories/${id}/niches`, 'POST', { name }, token);
  if (res.ok) { loadNiches(id); document.getElementById('newn_'+id).value=''; } else alert('Failed');
}

async function delNiche(nid){
  const token = document.getElementById('token').value;
  if (!confirm('Delete niche '+nid+'?')) return;
  const res = await api(`/api/admin/niches/${nid}`, 'DELETE', null, token);
  if (res.ok) { document.getElementById('refresh').click(); } else alert('Failed');
}

document.getElementById('createCat').onclick=async ()=>{
  const token = document.getElementById('token').value;
  const name = document.getElementById('catName').value;
  const id = document.getElementById('catId').value || undefined;
  const icon = document.getElementById('catIcon').value || undefined;
  const commission = parseFloat(document.getElementById('catCommission').value||'0.1');
  const desc = document.getElementById('catDesc').value;
  const res = await api('/api/admin/categories','POST',{ id, name, description: desc, icon, commissionRate: commission }, token);
  if (res.ok) { alert('Created'); loadCats(); } else alert('Failed to create');
}

document.getElementById('refresh').onclick = loadCats;

// initial
loadCats();
