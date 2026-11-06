import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const roleForRoute = (route) => ({
  'dashboard-farmer': 'Farmer',
  'dashboard-operator': 'Mandal Operator',
  'dashboard-consumer': 'Consumer',
  'dashboard-delivery': 'Delivery Agent',
}[route] || 'Farmer');

const messageOf = (error) => error?.message || 'Something went wrong. Please try again.';
const dateToday = () => new Date().toISOString().slice(0, 10);
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export async function fetchApprovedHarvests() {
  const { data, error } = await supabase
    .from('harvest_listings')
    .select('*')
    .eq('status', 'approved')
    .gt('approved_quantity_kg', 0)
    .order('reviewed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createWorkflowOrder({ user, items, fulfillment, deliveryAddress }) {
  const payload = items.map((item) => ({
    harvest_id: item.harvestId || null,
    product_name: item.name,
    farmer_name: item.farmer || 'AgroSync partner farmer',
    quantity_kg: Number(item.count),
    unit_price: Number(item.price),
  }));
  const { data, error } = await supabase.rpc('place_agrosync_order', {
    p_customer_name: user.user_metadata?.full_name || user.email || 'AgroSync customer',
    p_delivery_address: fulfillment === 'delivery' ? deliveryAddress : '',
    p_fulfillment: fulfillment,
    p_items: payload,
  });
  if (error) throw error;
  return data;
}

function Status({ value }) {
  const label = String(value || 'pending').replaceAll('_', ' ');
  return <span className={`wf-status wf-status-${value || 'pending'}`}>{label}</span>;
}

function Empty({ children }) {
  return <div className="wf-empty">{children}</div>;
}

function SignInPrompt({ role }) {
  return (
    <section className="content">
      <div className="wf-panel wf-auth-prompt">
        <h2>Sign in to open your {role.toLowerCase()} workspace</h2>
        <p>Your records and actions are tied to your AgroSync account.</p>
        <a className="button primary-button" href="#signin">Sign in</a>
      </div>
    </section>
  );
}

function FarmerWorkspace({ user, onToast }) {
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    crop_name: '', category: 'Vegetables', variety: '', quantity_kg: '', expected_price: '',
    village: '', harvest_date: dateToday(), pickup_date: '', quality_notes: '', photo_url: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('harvest_listings')
      .select('*')
      .eq('farmer_id', user.id)
      .order('created_at', { ascending: false });
    if (queryError) setError(messageOf(queryError));
    else setHarvests(data || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('harvest_listings').insert({
      farmer_id: user.id,
      farmer_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Farmer',
      crop_name: form.crop_name.trim(),
      category: form.category,
      variety: form.variety.trim(),
      quantity_kg: Number(form.quantity_kg),
      expected_price: Number(form.expected_price),
      village: form.village.trim(),
      harvest_date: form.harvest_date,
      pickup_date: form.pickup_date || null,
      quality_notes: form.quality_notes.trim(),
      photo_url: form.photo_url.trim() || null,
      status: 'pending',
    });
    if (insertError) {
      setError(messageOf(insertError));
    } else {
      setForm({ crop_name: '', category: 'Vegetables', variety: '', quantity_kg: '', expected_price: '', village: '', harvest_date: dateToday(), pickup_date: '', quality_notes: '', photo_url: '' });
      onToast('Harvest submitted for Mandal review.');
      await load();
    }
    setSaving(false);
  };

  return (
    <>
      <section className="page-hero">
        <div className="eyebrow">Farmer workspace</div>
        <h1>My harvests</h1>
        <p className="lead">Submit crop and pickup details. The Mandal operator reviews each lot before it appears in the marketplace.</p>
      </section>
      <section className="content wf-layout">
        <form className="wf-panel wf-form" onSubmit={submit}>
          <div className="wf-panel-heading"><div><div className="eyebrow">New listing</div><h2>Harvest details</h2></div></div>
          <div className="wf-fields">
            <label>Crop name<input name="crop_name" value={form.crop_name} onChange={update} placeholder="e.g. Tomato" required /></label>
            <label>Category<select name="category" value={form.category} onChange={update}><option>Vegetables</option><option>Fruits</option><option>Grains</option><option>Pulses</option><option>Other</option></select></label>
            <label>Variety<input name="variety" value={form.variety} onChange={update} placeholder="e.g. Hybrid / local variety" /></label>
            <label>Available quantity (kg)<input name="quantity_kg" type="number" min="1" step="0.1" value={form.quantity_kg} onChange={update} required /></label>
            <label>Expected price per kg (₹)<input name="expected_price" type="number" min="0.01" step="0.01" value={form.expected_price} onChange={update} required /></label>
            <label>Village / locality<input name="village" value={form.village} onChange={update} required /></label>
            <label>Harvest date<input name="harvest_date" type="date" value={form.harvest_date} onChange={update} required /></label>
            <label>Preferred pickup date<input name="pickup_date" type="date" value={form.pickup_date} onChange={update} /></label>
            <label className="wf-wide">Quality, packing, or handling notes<textarea name="quality_notes" rows="3" value={form.quality_notes} onChange={update} placeholder="Ripeness, size, packing, or other details" /></label>
            <label className="wf-wide">Crop photo URL (optional)<input name="photo_url" type="url" value={form.photo_url} onChange={update} placeholder="https://..." /></label>
          </div>
          {error && <p className="wf-error" role="alert">{error}</p>}
          <button className="button primary-button" disabled={saving}>{saving ? 'Submitting...' : 'Submit harvest for review'}</button>
        </form>
        <section className="wf-panel">
          <div className="wf-panel-heading"><div><div className="eyebrow">Your submissions</div><h2>Review status</h2></div><button className="wf-refresh" type="button" onClick={load} title="Refresh harvest status">↻</button></div>
          {loading ? <Empty>Loading your harvests...</Empty> : error && !harvests.length ? <p className="wf-error">{error}</p> : harvests.length ? (
            <div className="wf-list">{harvests.map((lot) => (
              <article className="wf-record" key={lot.id}>
                <div className="wf-record-top"><div><h3>{lot.crop_name}</h3><p>{lot.variety || 'Variety not specified'} · {lot.quantity_kg} kg</p></div><Status value={lot.status} /></div>
                <div className="wf-meta"><span>{lot.village}</span><span>Harvested {lot.harvest_date}</span><span>Expected {money(lot.expected_price)}/kg</span></div>
                {lot.status === 'approved' && <p className="wf-success">Approved: {lot.approved_quantity_kg} kg at {money(lot.approved_price)}/kg · Grade {lot.grade}</p>}
                {lot.status === 'rejected' && <p className="wf-error">Operator note: {lot.review_note || 'Please contact the Mandal operator.'}</p>}
              </article>
            ))}</div>
          ) : <Empty>No harvests submitted yet.</Empty>}
        </section>
      </section>
    </>
  );
}

function OperatorWorkspace({ user, onToast }) {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [review, setReview] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase.from('harvest_listings').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    if (queryError) setError(messageOf(queryError));
    else setLots(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const valueFor = (lot, key, fallback) => review[lot.id]?.[key] ?? lot[fallback];
  const setValue = (lot, key, value) => setReview((current) => ({ ...current, [lot.id]: { ...current[lot.id], [key]: value } }));
  const decide = async (lot, status) => {
    setBusyId(lot.id);
    setError('');
    const fields = status === 'approved' ? {
      status,
      grade: valueFor(lot, 'grade', 'grade') || 'A',
      approved_price: Number(valueFor(lot, 'approved_price', 'expected_price')),
      approved_quantity_kg: Number(valueFor(lot, 'approved_quantity_kg', 'quantity_kg')),
      review_note: valueFor(lot, 'review_note', 'review_note') || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    } : {
      status,
      review_note: valueFor(lot, 'review_note', 'review_note') || 'Please contact the Mandal operator for details.',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };
    const { data, error: updateError } = await supabase.from('harvest_listings').update(fields).eq('id', lot.id).eq('status', 'pending').select('id').maybeSingle();
    if (updateError) setError(messageOf(updateError));
    else if (!data) setError('This harvest was already reviewed. Refresh the queue.');
    else {
      onToast(status === 'approved' ? 'Approved harvest is now in the marketplace.' : 'Harvest returned to the farmer.');
      await load();
    }
    setBusyId('');
  };

  return (
    <>
      <section className="page-hero"><div className="eyebrow">Mandal Operator workspace</div><h1>Harvest review queue</h1><p className="lead">Check each lot, set the accepted grade, quantity, and price, then approve it for the marketplace.</p></section>
      <section className="content">
        <div className="wf-panel">
          <div className="wf-panel-heading"><div><div className="eyebrow">Pending lots</div><h2>{lots.length} awaiting review</h2></div><button className="wf-refresh" type="button" onClick={load} title="Refresh review queue">↻</button></div>
          {error && <p className="wf-error" role="alert">{error}</p>}
          {loading ? <Empty>Loading submissions...</Empty> : lots.length ? <div className="wf-list">{lots.map((lot) => (
            <article className="wf-record" key={lot.id}>
              <div className="wf-record-top"><div><h3>{lot.crop_name} {lot.variety ? `· ${lot.variety}` : ''}</h3><p>Submitted by {lot.farmer_name} · {lot.village}</p></div><Status value={lot.status} /></div>
              {lot.photo_url && <img className="wf-harvest-photo" src={lot.photo_url} alt={`${lot.crop_name} harvest`} />}
              <div className="wf-meta"><span>{lot.category}</span><span>{lot.quantity_kg} kg offered</span><span>Expected {money(lot.expected_price)}/kg</span><span>Harvest date {lot.harvest_date}</span></div>
              {lot.quality_notes && <p className="wf-notes">{lot.quality_notes}</p>}
              <div className="wf-review-fields">
                <label>Grade<select value={valueFor(lot, 'grade', 'grade') || 'A'} onChange={(e) => setValue(lot, 'grade', e.target.value)}><option>A</option><option>B</option><option>C</option></select></label>
                <label>Accepted quantity (kg)<input type="number" min="0.1" max={lot.quantity_kg} step="0.1" value={valueFor(lot, 'approved_quantity_kg', 'quantity_kg')} onChange={(e) => setValue(lot, 'approved_quantity_kg', e.target.value)} /></label>
                <label>Marketplace price (₹/kg)<input type="number" min="0.01" step="0.01" value={valueFor(lot, 'approved_price', 'expected_price')} onChange={(e) => setValue(lot, 'approved_price', e.target.value)} /></label>
                <label className="wf-wide">Operator note<input value={valueFor(lot, 'review_note', 'review_note') || ''} onChange={(e) => setValue(lot, 'review_note', e.target.value)} placeholder="Optional note for the farmer" /></label>
              </div>
              <div className="wf-actions"><button className="button primary-button" disabled={busyId === lot.id} onClick={() => decide(lot, 'approved')}>{busyId === lot.id ? 'Saving...' : 'Approve to marketplace'}</button><button className="button wf-danger-button" disabled={busyId === lot.id} onClick={() => decide(lot, 'rejected')}>Return to farmer</button></div>
            </article>
          ))}</div> : <Empty>No harvests are waiting for review.</Empty>}
        </div>
      </section>
    </>
  );
}

function ConsumerWorkspace({ user, onNavigate }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('orders').select('*, order_items(*)').eq('consumer_id', user.id).order('created_at', { ascending: false });
    if (queryError) setError(messageOf(queryError));
    else { setError(''); setOrders(data || []); }
  }, [user.id]);
  useEffect(() => {
    load();
    const channel = supabase.channel(`agrosync-consumer-orders-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `consumer_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, user.id]);
  return (
    <>
      <section className="page-hero"><div className="eyebrow">Consumer workspace</div><h1>Your orders</h1><p className="lead">Shop Mandal-approved produce, keep items in your basket, and follow each delivery.</p></section>
      <section className="content">
        <div className="wf-panel wf-consumer-actions"><div><div className="eyebrow">Fresh from local farmers</div><h2>Browse approved harvests</h2><p>Operator-approved lots appear in the marketplace with their final grade, price, and available quantity.</p></div><div className="wf-actions"><a className="button primary-button" href="#marketplace">Shop marketplace</a><a className="button" href="#basket">Open basket</a></div></div>
        <div className="wf-panel top-gap"><div className="wf-panel-heading"><div><div className="eyebrow">Order history</div><h2>Recent orders</h2></div></div>
          {error && <p className="wf-error">{error}</p>}
          {!orders.length ? <Empty>Your orders will appear here after checkout.</Empty> : <div className="wf-list">{orders.map((order) => (
            <article className="wf-record" key={order.id}><div className="wf-record-top"><div><h3>Order {String(order.id).slice(0, 8).toUpperCase()}</h3><p>{new Date(order.created_at).toLocaleString()} · {order.fulfillment === 'delivery' ? 'Community delivery' : 'Mandal Agri-Mart collection'}</p></div><Status value={order.status} /></div><div className="wf-meta"><span>Total {money(order.total_amount)}</span>{order.delivery_address && <span>{order.delivery_address}</span>}</div><p className="wf-notes">{(order.order_items || []).map((item) => `${item.product_name} · ${item.quantity_kg} kg`).join('  |  ')}</p></article>
          ))}</div>}
        </div>
      </section>
    </>
  );
}

function DeliveryWorkspace({ user, onToast }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase.from('orders').select('*, order_items(*)').eq('fulfillment', 'delivery').in('status', ['placed', 'accepted', 'picked_up']).order('created_at', { ascending: true });
    if (queryError) setError(messageOf(queryError));
    else setOrders(data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const channel = supabase.channel('agrosync-delivery-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const act = async (order, nextStatus) => {
    setBusyId(order.id);
    setError('');
    const rpc = order.assigned_agent_id && order.assigned_agent_id !== user.id ? null :
      order.status === 'placed' && !order.assigned_agent_id
        ? supabase.rpc('claim_delivery_order', { p_order_id: order.id })
        : supabase.rpc('update_delivery_order', { p_order_id: order.id, p_status: nextStatus });
    if (!rpc) {
      setError('This order is already assigned to another agent. Refresh the queue.');
    } else {
      const { error: actionError } = await rpc;
      if (actionError) setError(messageOf(actionError));
      else { onToast(nextStatus === 'delivered' ? 'Order marked delivered.' : order.status === 'placed' ? 'Delivery accepted.' : 'Delivery status updated.'); await load(); }
    }
    setBusyId('');
  };

  return (
    <>
      <section className="page-hero"><div className="eyebrow">Delivery Agent workspace</div><h1>Delivery queue</h1><p className="lead">Community-delivery orders appear here after consumer checkout. Claim a drop and update its handover status.</p></section>
      <section className="content"><div className="wf-panel"><div className="wf-panel-heading"><div><div className="eyebrow">Orders to deliver</div><h2>{orders.length} active orders</h2></div><button className="wf-refresh" type="button" onClick={load} title="Refresh delivery queue">↻</button></div>
        {error && <p className="wf-error" role="alert">{error}</p>}
        {loading ? <Empty>Loading delivery queue...</Empty> : orders.length ? <div className="wf-list">{orders.map((order) => {
          const own = order.assigned_agent_id === user.id;
          const unassigned = !order.assigned_agent_id;
          const next = order.status === 'accepted' ? 'picked_up' : 'delivered';
          return <article className="wf-record" key={order.id}><div className="wf-record-top"><div><h3>Order {String(order.id).slice(0, 8).toUpperCase()}</h3><p>{order.consumer_name} · {new Date(order.created_at).toLocaleString()}</p></div><Status value={order.status} /></div><div className="wf-meta"><span>{order.delivery_address || 'Address not provided'}</span><span>Total {money(order.total_amount)}</span></div><p className="wf-notes">{(order.order_items || []).map((item) => `${item.product_name} · ${item.quantity_kg} kg`).join('  |  ')}</p><div className="wf-actions">{unassigned ? <button className="button primary-button" disabled={busyId === order.id} onClick={() => act(order, 'accepted')}>{busyId === order.id ? 'Claiming...' : 'Accept delivery'}</button> : own && <button className="button primary-button" disabled={busyId === order.id} onClick={() => act(order, next)}>{busyId === order.id ? 'Updating...' : next === 'picked_up' ? 'Mark picked up' : 'Mark delivered'}</button>}{!unassigned && !own && <p className="wf-muted">Assigned to another agent</p>}</div></article>;
        })}</div> : <Empty>No delivery orders yet. Orders placed with community delivery will show up here.</Empty>}
      </div></section>
    </>
  );
}

export function WorkflowDashboard({ route, user, onToast, onNavigate }) {
  const routeRole = roleForRoute(route);
  const currentRole = user?.app_metadata?.role || user?.user_metadata?.role || routeRole;
  if (!user) return <SignInPrompt role={routeRole} />;
  if (currentRole === 'Farmer') return <FarmerWorkspace user={user} onToast={onToast} />;
  if (currentRole === 'Mandal Operator') return <OperatorWorkspace user={user} onToast={onToast} />;
  if (currentRole === 'Consumer') return <ConsumerWorkspace user={user} onNavigate={onNavigate} />;
  if (currentRole === 'Delivery Agent') return <DeliveryWorkspace user={user} onToast={onToast} />;
  return <SignInPrompt role={routeRole} />;
}
