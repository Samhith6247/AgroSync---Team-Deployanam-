const agrosyncDemoBaseRender = render;
const agrosyncDemoBaseBind = bind;
const agrosyncDemoSeedProducts = [...products];
const agrosyncDemoHarvestKey = 'agrosync-demo-harvests';
const agrosyncDemoOrdersKey = 'agrosync-demo-orders';
const agrosyncDemoUserKey = 'agrosync-demo-user';

function agrosyncDemoRead(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function agrosyncDemoWrite(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function agrosyncDemoHarvests() { return agrosyncDemoRead(agrosyncDemoHarvestKey); }
function agrosyncDemoOrders() { return agrosyncDemoRead(agrosyncDemoOrdersKey); }
function agrosyncDemoId() { return globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function agrosyncDemoMoney(value) { return `₹${Number(value || 0).toLocaleString('en-IN')}`; }
function agrosyncDemoStatus(value) { return `<span class="wf-status wf-status-${h(value)}">${h(String(value || 'pending').replaceAll('_', ' '))}</span>`; }
function agrosyncDemoStatusName(value) { return String(value || '').replaceAll('_', ' '); }
function agrosyncDemoProduct(lot) {
  return {
    id: `demo-harvest-${lot.id}`,
    harvestId: lot.id,
    name: lot.crop_name,
    farmer: lot.farmer_name,
    village: lot.village,
    date: lot.harvest_date,
    price: Number(lot.approved_price),
    qty: Number(lot.approved_quantity_kg),
    category: lot.category,
    grade: lot.grade,
    img: 'photo-1546094096-0df4bcaaa337',
    imageUrl: lot.photo_url || '',
  };
}

window.dashboard = function (r) {
  const lots = agrosyncDemoHarvests();
  const orders = agrosyncDemoOrders();
  const user = agrosyncDemoRead(agrosyncDemoUserKey, {});
  const activeLots = lots.filter((lot) => lot.farmer_email === user.email);
  const ownOrders = orders.filter((order) => order.consumer_email === user.email);

  if (r === 'Farmer') {
    const records = activeLots.length ? activeLots.map((lot) => `<article class="wf-record"><div class="wf-record-top"><div><h3>${h(lot.crop_name)} · ${h(lot.variety || 'Local variety')}</h3><p>${h(lot.quantity_kg)} kg offered · ${h(lot.village)}</p></div>${agrosyncDemoStatus(lot.status)}</div><div class="wf-meta"><span>Harvest ${h(lot.harvest_date)}</span><span>Expected ${agrosyncDemoMoney(lot.expected_price)}/kg</span></div>${lot.status === 'approved' ? `<p class="wf-success">Approved for marketplace: ${lot.approved_quantity_kg} kg · Grade ${h(lot.grade)} · ${agrosyncDemoMoney(lot.approved_price)}/kg</p>` : ''}${lot.status === 'rejected' ? `<p class="wf-error">Operator note: ${h(lot.review_note || 'Contact the Mandal operator.')}</p>` : ''}</article>`).join('') : '<div class="wf-empty">No harvests submitted yet.</div>';
    return `<section class="page-hero"><div class="eyebrow">Farmer interface</div><h1>My harvests</h1><p class="sub">Submit crop details for Mandal review. Approved harvests move to the marketplace.</p></section><section class="content wf-layout"><form class="card wf-panel" id="wf-harvest-form"><div class="eyebrow">New listing</div><h2>Harvest details</h2><div class="wf-fields"><label>Crop name<input class="field" name="crop_name" required placeholder="e.g. Tomato"></label><label>Category<select class="field" name="category"><option>Vegetables</option><option>Fruits</option><option>Grains</option><option>Pulses</option><option>Other</option></select></label><label>Variety<input class="field" name="variety" placeholder="Local or hybrid variety"></label><label>Quantity (kg)<input class="field" name="quantity_kg" type="number" min="1" step="0.1" required></label><label>Expected price (₹/kg)<input class="field" name="expected_price" type="number" min="0.01" step="0.01" required></label><label>Village / locality<input class="field" name="village" required></label><label>Harvest date<input class="field" name="harvest_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Preferred pickup date<input class="field" name="pickup_date" type="date"></label><label class="wf-wide">Quality or packing notes<textarea class="field" name="quality_notes" rows="3" placeholder="Ripeness, size, packing details"></textarea></label><label class="wf-wide">Photo URL (optional)<input class="field" name="photo_url" type="url" placeholder="https://..."></label></div><button class="btn primary" type="submit">Submit harvest for review</button><p class="wf-demo-note">Demo records are saved in this browser.</p></form><section class="card wf-panel"><div class="eyebrow">Your submissions</div><h2>Review status</h2><div class="wf-list">${records}</div></section></section>`;
  }

  if (r === 'Mandal Operator') {
    const pending = lots.filter((lot) => lot.status === 'pending');
    const records = pending.length ? pending.map((lot) => `<article class="wf-record"><div class="wf-record-top"><div><h3>${h(lot.crop_name)} · ${h(lot.variety || 'Variety not specified')}</h3><p>Submitted by ${h(lot.farmer_name)} · ${h(lot.village)}</p></div>${agrosyncDemoStatus(lot.status)}</div>${lot.photo_url ? `<img class="wf-harvest-photo" src="${h(lot.photo_url)}" alt="${h(lot.crop_name)} harvest">` : ''}<div class="wf-meta"><span>${h(lot.category)}</span><span>${h(lot.quantity_kg)} kg offered</span><span>${agrosyncDemoMoney(lot.expected_price)}/kg requested</span><span>Harvest ${h(lot.harvest_date)}</span></div>${lot.quality_notes ? `<p class="wf-notes">${h(lot.quality_notes)}</p>` : ''}<div class="wf-review-fields"><label>Grade<select class="field" id="wf-grade-${lot.id}"><option>A</option><option>B</option><option>C</option></select></label><label>Accepted quantity (kg)<input class="field" id="wf-qty-${lot.id}" type="number" min="0.1" max="${Number(lot.quantity_kg)}" step="0.1" value="${Number(lot.quantity_kg)}"></label><label>Marketplace price (₹/kg)<input class="field" id="wf-price-${lot.id}" type="number" min="0.01" step="0.01" value="${Number(lot.expected_price)}"></label><label class="wf-wide">Note to farmer<input class="field" id="wf-note-${lot.id}" placeholder="Optional review note"></label></div><div class="wf-actions"><button class="btn primary" data-wf-approve="${lot.id}">Approve to marketplace</button><button class="btn wf-demo-danger" data-wf-reject="${lot.id}">Return to farmer</button></div></article>`).join('') : '<div class="wf-empty">No harvests are waiting for review.</div>';
    return `<section class="page-hero"><div class="eyebrow">Mandal Operator interface</div><h1>Harvest review queue</h1><p class="sub">Check each lot, set its grade, accepted quantity, and marketplace price.</p></section><section class="content"><div class="card wf-panel"><div class="wf-panel-heading"><div class="eyebrow">Pending lots</div><strong>${pending.length} awaiting review</strong></div>${records}</div></section>`;
  }

  if (r === 'Consumer') {
    const records = ownOrders.length ? ownOrders.map((order) => `<article class="wf-record"><div class="wf-record-top"><div><h3>Order ${h(order.id.slice(-8).toUpperCase())}</h3><p>${h(new Date(order.created_at).toLocaleString())} · ${order.fulfillment === 'delivery' ? 'Community delivery' : 'Mandal Agri-Mart collection'}</p></div>${agrosyncDemoStatus(order.status)}</div><div class="wf-meta"><span>Total ${agrosyncDemoMoney(order.total_amount)}</span>${order.delivery_address ? `<span>${h(order.delivery_address)}</span>` : ''}</div><p class="wf-notes">${order.items.map((item) => `${h(item.name)} · ${item.count} kg`).join(' | ')}</p></article>`).join('') : '<div class="wf-empty">Your orders will show here after checkout.</div>';
    return `<section class="page-hero"><div class="eyebrow">Consumer interface</div><h1>Shop local harvests</h1><p class="sub">Only Mandal-approved lots are listed here. Add produce to your basket and follow delivery status.</p></section><section class="content"><div class="card wf-panel wf-consumer-actions"><div><div class="eyebrow">Fresh from local farmers</div><h2>Marketplace</h2><p>Browse the approved harvests, or review the orders you have already placed.</p></div><div class="wf-actions"><a class="btn primary" href="#marketplace">Shop produce</a><a class="btn" href="#basket">Open basket</a></div></div><div class="card wf-panel top-gap"><div class="eyebrow">Order history</div><h2>Recent orders</h2>${records}</div></section>`;
  }

  const active = orders.filter((order) => order.fulfillment === 'delivery' && ['placed', 'accepted', 'picked_up'].includes(order.status));
  const records = active.length ? active.map((order) => {
    const own = order.assigned_agent === user.email;
    const action = order.status === 'placed' ? 'Accept delivery' : order.status === 'accepted' ? 'Mark picked up' : 'Mark delivered';
    return `<article class="wf-record"><div class="wf-record-top"><div><h3>Order ${h(order.id.slice(-8).toUpperCase())}</h3><p>${h(order.consumer_name)} · ${h(new Date(order.created_at).toLocaleString())}</p></div>${agrosyncDemoStatus(order.status)}</div><div class="wf-meta"><span>${h(order.delivery_address)}</span><span>${agrosyncDemoMoney(order.total_amount)}</span></div><p class="wf-notes">${order.items.map((item) => `${h(item.name)} · ${item.count} kg`).join(' | ')}</p>${own || !order.assigned_agent ? `<button class="btn primary" data-wf-agent="${order.id}">${action}</button>` : '<p class="wf-muted">Claimed by another agent</p>'}</article>`;
  }).join('') : '<div class="wf-empty">No community-delivery orders are waiting. Orders placed by consumers will appear here.</div>';
  return `<section class="page-hero"><div class="eyebrow">Delivery Agent interface</div><h1>Delivery queue</h1><p class="sub">Community-delivery orders appear here after checkout. Claim the order and update each handover.</p></section><section class="content"><div class="card wf-panel"><div class="wf-panel-heading"><div><div class="eyebrow">Orders to deliver</div><h2>${active.length} active orders</h2></div><button class="wf-refresh" id="wf-refresh" title="Refresh queue">↻</button></div>${records}</div></section>`;
};

window.auth = function (signup = false) {
  return `<section class="form-wrap"><h1>${signup ? 'Create your AgroSync account' : 'Sign in to AgroSync'}</h1><p class="sub">Choose a role to preview its workspace in this browser demo.</p><form class="form" id="auth-form" data-signup="${signup}"><div class="role-select">${['Farmer','Mandal Operator','Consumer','Delivery Agent'].map((r) => `<button type="button" class="role-option ${role === r ? 'selected' : ''}" data-role="${r}">${r}</button>`).join('')}</div><label>Email<input class="field" type="email" name="email" value="${h(agrosyncDemoRead(agrosyncDemoUserKey,{}).email || '')}" required></label><label>Password<input class="field" type="password" name="password" required minlength="6"></label><button class="btn primary wide">${signup ? 'Create demo account' : 'Open role workspace'}</button></form><div class="form-center" style="margin-top:15px"><a href="${signup ? '#signin' : '#signup'}" style="color:var(--green2)">${signup ? 'Already have an account? Sign in' : 'New here? Create an account'}</a></div><p class="wf-demo-note">This standalone page is a shared browser demo. It does not authenticate with Supabase.</p></section>`;
};

window.basketPage = function () {
  const subtotal = basket.reduce((sum, item) => sum + Number(item.price) * item.count, 0);
  const delivery = fulfil === 'collect' ? 0 : 20;
  const address = localStorage.getItem('agrosync-demo-address') || '';
  const rows = basket.length ? basket.map((item) => `<div class="list-row" style="align-items:center"><div><b>${h(item.name)}</b><div class="small">${agrosyncDemoMoney(item.price)}/kg · ${h(item.farmer || 'AgroSync partner farmer')}</div></div><div style="display:flex;gap:9px;align-items:center"><button class="btn" data-qty="${h(item.name)}" data-delta="-1">−</button>${item.count} kg<button class="btn" data-qty="${h(item.name)}" data-delta="1">+</button><button class="btn" data-remove="${h(item.name)}">Remove</button></div><b>${agrosyncDemoMoney(item.price * item.count)}</b></div>`).join('') : '<div class="basket-empty">Your basket is empty. <a href="#marketplace">Browse produce</a></div>';
  return `${headerHero('Checkout','Your basket','Orders with community delivery go to the delivery agent queue.')}<section class="content"><div class="split"><div class="card">${rows}</div><aside class="card summary"><h3>Fulfilment</h3><label class="checks"><input type="radio" name="fulfil" value="delivery" ${fulfil === 'delivery' ? 'checked' : ''}> Community delivery (₹20)</label><label class="checks"><input type="radio" name="fulfil" value="collect" ${fulfil === 'collect' ? 'checked' : ''}> Collect at Mandal Agri-Mart (free)</label>${fulfil === 'delivery' ? `<label class="wf-address-label">Delivery address<textarea id="wf-address" class="field" rows="3" required placeholder="House, street, village or area">${h(address)}</textarea></label>` : ''}<div class="list-row"><span>Subtotal</span><span>${agrosyncDemoMoney(subtotal)}</span></div><div class="list-row"><span>Delivery</span><span>${agrosyncDemoMoney(basket.length ? delivery : 0)}</span></div><div class="summary-total">Total <span style="float:right">${agrosyncDemoMoney(basket.length ? subtotal + delivery : 0)}</span></div><button class="btn primary wide" id="order" ${basket.length ? '' : 'disabled'}>Place order</button><p class="wf-demo-note">Demo orders are visible to the agent role in this browser.</p></aside></div></section>`;
};

window.bind = function () {
  agrosyncDemoBaseBind();
  const categorySelect = document.querySelector('#category');
  if (categorySelect) ['Grains', 'Pulses', 'Other'].forEach((value) => {
    if (![...categorySelect.options].some((option) => option.value === value)) {
      categorySelect.add(new Option(value, value, false, category === value));
    }
  });
  const gradeSelect = document.querySelector('#grade');
  if (gradeSelect && ![...gradeSelect.options].some((option) => option.value === 'C')) {
    gradeSelect.add(new Option('C', 'C', false, grade === 'C'));
  }
  const form = document.querySelector('#auth-form');
  if (form) form.onsubmit = (event) => {
    event.preventDefault();
    const email = new FormData(form).get('email').trim();
    agrosyncDemoWrite(agrosyncDemoUserKey, { email, role });
    notify('Demo role opened');
    location.hash = `#dashboard-${({ 'Farmer':'farmer', 'Mandal Operator':'operator', 'Consumer':'consumer', 'Delivery Agent':'delivery' })[role]}`;
  };

  const harvestForm = document.querySelector('#wf-harvest-form');
  if (harvestForm) harvestForm.onsubmit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(harvestForm).entries());
    const user = agrosyncDemoRead(agrosyncDemoUserKey, {});
    const current = agrosyncDemoHarvests();
    current.unshift({
      id: agrosyncDemoId(), farmer_email: user.email || 'farmer@demo.local',
      farmer_name: user.email?.split('@')[0] || 'Demo farmer', crop_name: values.crop_name.trim(),
      category: values.category, variety: values.variety.trim(), quantity_kg: Number(values.quantity_kg),
      expected_price: Number(values.expected_price), village: values.village.trim(), harvest_date: values.harvest_date,
      pickup_date: values.pickup_date, quality_notes: values.quality_notes.trim(), photo_url: values.photo_url.trim(),
      status: 'pending', created_at: new Date().toISOString(),
    });
    agrosyncDemoWrite(agrosyncDemoHarvestKey, current);
    notify('Harvest sent to Mandal Operator review.');
    render();
  };

  document.querySelectorAll('[data-wf-approve]').forEach((button) => { button.onclick = () => {
    const id = button.dataset.wfApprove;
    const lots = agrosyncDemoHarvests();
    const lot = lots.find((item) => item.id === id);
    if (!lot) return;
    const quantity = Number(document.querySelector(`#wf-qty-${id}`).value);
    const price = Number(document.querySelector(`#wf-price-${id}`).value);
    if (!(quantity > 0 && quantity <= lot.quantity_kg && price > 0)) { notify('Enter a valid accepted quantity and price.'); return; }
    lot.status = 'approved'; lot.grade = document.querySelector(`#wf-grade-${id}`).value;
    lot.approved_quantity_kg = quantity; lot.approved_price = price;
    lot.review_note = document.querySelector(`#wf-note-${id}`).value.trim();
    lot.reviewed_at = new Date().toISOString();
    agrosyncDemoWrite(agrosyncDemoHarvestKey, lots);
    notify('Approved. Harvest is now listed in the marketplace.'); render();
  }; });

  document.querySelectorAll('[data-wf-reject]').forEach((button) => { button.onclick = () => {
    const id = button.dataset.wfReject;
    const lots = agrosyncDemoHarvests();
    const lot = lots.find((item) => item.id === id);
    if (!lot) return;
    lot.status = 'rejected'; lot.review_note = document.querySelector(`#wf-note-${id}`).value.trim() || 'Please contact the Mandal operator.';
    lot.reviewed_at = new Date().toISOString();
    agrosyncDemoWrite(agrosyncDemoHarvestKey, lots);
    notify('Harvest returned to the farmer.'); render();
  }; });

  document.querySelectorAll('[data-wf-agent]').forEach((button) => { button.onclick = () => {
    const orders = agrosyncDemoOrders();
    const order = orders.find((item) => item.id === button.dataset.wfAgent);
    if (!order) return;
    const user = agrosyncDemoRead(agrosyncDemoUserKey, {});
    if (order.status === 'placed') { order.assigned_agent = user.email || 'agent@demo.local'; order.status = 'accepted'; }
    else if (order.assigned_agent === (user.email || 'agent@demo.local') && order.status === 'accepted') order.status = 'picked_up';
    else if (order.assigned_agent === (user.email || 'agent@demo.local') && order.status === 'picked_up') order.status = 'delivered';
    else { notify('This order is assigned to another agent.'); return; }
    order.updated_at = new Date().toISOString(); agrosyncDemoWrite(agrosyncDemoOrdersKey, orders);
    notify(`Order ${agrosyncDemoStatusName(order.status)}.`); render();
  }; });

  const orderButton = document.querySelector('#order');
  if (orderButton) orderButton.onclick = () => {
    if (!basket.length) return;
    const user = agrosyncDemoRead(agrosyncDemoUserKey, {});
    const address = document.querySelector('#wf-address')?.value.trim() || '';
    if (fulfil === 'delivery' && !address) { notify('Enter the delivery address first.'); return; }
    if (!user.email || user.role !== 'Consumer') { notify('Open the Consumer role before placing an order.'); location.hash = '#signin'; return; }
    const lots = agrosyncDemoHarvests();
    for (const item of basket) {
      if (!item.harvestId) continue;
      const lot = lots.find((candidate) => candidate.id === item.harvestId && candidate.status === 'approved');
      if (!lot || Number(lot.approved_quantity_kg) < item.count) { notify(`${item.name} no longer has enough stock. Refresh the marketplace.`); return; }
    }
    const subtotal = basket.reduce((sum, item) => sum + Number(item.price) * item.count, 0);
    const orders = agrosyncDemoOrders();
    orders.unshift({ id: agrosyncDemoId(), consumer_email: user.email, consumer_name: user.email.split('@')[0], delivery_address: fulfil === 'delivery' ? address : '', fulfillment: fulfil, status: 'placed', assigned_agent: '', subtotal, delivery_fee: fulfil === 'delivery' ? 20 : 0, total_amount: subtotal + (fulfil === 'delivery' ? 20 : 0), items: basket.map((item) => ({ name: item.name, farmer: item.farmer, count: item.count, price: Number(item.price), harvestId: item.harvestId || null })), created_at: new Date().toISOString() });
    agrosyncDemoWrite(agrosyncDemoOrdersKey, orders);
    basket.forEach((item) => {
      if (!item.harvestId) return;
      const lot = lots.find((candidate) => candidate.id === item.harvestId);
      if (lot) lot.approved_quantity_kg = Number(lot.approved_quantity_kg) - item.count;
    });
    agrosyncDemoWrite(agrosyncDemoHarvestKey, lots);
    basket = []; saveCart(); notify('Order placed and sent to the delivery queue.'); location.hash = '#dashboard-consumer';
  };

  const refresh = document.querySelector('#wf-refresh');
  if (refresh) refresh.onclick = () => render();
};

window.render = function () {
  const approved = agrosyncDemoHarvests().filter((lot) => lot.status === 'approved' && Number(lot.approved_quantity_kg) > 0).map(agrosyncDemoProduct);
  products = [...agrosyncDemoSeedProducts, ...approved];
  agrosyncDemoBaseRender();
};

render();
