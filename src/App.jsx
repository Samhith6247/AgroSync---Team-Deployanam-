import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { WorkflowDashboard, createWorkflowOrder, fetchApprovedHarvests } from './workflow.jsx';

const navLinks = [
  ['Marketplace', 'marketplace'],
  ['Membership', 'membership'],
  ['Agri-Mart', 'agri-mart'],
  ['Vending', 'vending'],
  ['Sustainability', 'sustainability'],
  ['About', 'about'],
];
const roleNames = ['Farmer', 'Mandal Operator', 'Consumer', 'Delivery Agent'];
const slug = (value) => value.toLowerCase().replaceAll(' ', '-');
const roleRoute = (value) => ({ 'Mandal Operator': 'operator', 'Delivery Agent': 'delivery' }[value] || slug(value));
const money = (value) => `₹${value}`;

function readBasket() {
  try {
    return JSON.parse(localStorage.getItem('agrosync-basket') || '[]');
  } catch {
    return [];
  }
}

function Header({ route, basketCount, user, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const userRole = user?.app_metadata?.role || user?.user_metadata?.role;
  const dashboardLink = userRole ? `#dashboard-${roleRoute(userRole)}` : '#signin';

  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="AgroSync home">
        <span className="brand-mark">
          <img src="/agrosync-logo.png" alt="" />
        </span>
        <span>AgroSync</span>
      </a>
      <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
        ☰
      </button>
      <nav className={menuOpen ? 'nav open' : 'nav'}>
        {navLinks.map(([label, path]) => (
          <a key={path} className={route === path ? 'active' : ''} href={`#${path}`} onClick={() => setMenuOpen(false)}>
            {label}
          </a>
        ))}
      </nav>
      <div className="head-actions">
        <a className="cart-link" href="#basket" aria-label={`Basket${basketCount ? `, ${basketCount} items` : ''}`}>
          ♧{basketCount > 0 && <sup>{basketCount}</sup>}
        </a>
        {user ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <a className="button" style={{ padding: '6px 12px', fontSize: '0.85rem' }} href={dashboardLink}>
              {userRole || 'Dashboard'}
            </a>
            <button className="text-button" onClick={onSignOut} style={{ cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        ) : (
          <a className="sign-in" href="#signin">
            Sign in
          </a>
        )}
      </div>
    </header>
  );
}

function Card({ icon, title, children, href, className = '' }) {
  return (
    <article className={`card ${className}`}>
      {icon && <div className="card-icon">{icon}</div>}
      <h3>{title}</h3>
      <p>{children}</p>
      {href && <a className="card-link" href={href}>Open {title} interface →</a>}
    </article>
  );
}

function Home() {
  const roles = [
    ['🌱', 'Farmer', 'List your harvest, see what the Mandal accepted, and watch what your crop is selling for.'],
    ['▤', 'Mandal Operator', 'Receive lots, grade and store produce, and keep the mart and every machine stocked.'],
    ['🧺', 'Consumer', 'Shop graded produce, join a family membership, and rate what you received.'],
    ['♧', 'Delivery Agent', 'Pick up drops available on your route and log each handover.'],
  ];
  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow gold-text">Pilot · Madanapalli Mandal, AP</div>
          <h1>Innovating Agriculture. Empowering Farmers.</h1>
          <p>
            Farmers lose income to middlemen and spoilage while families struggle to find fresh produce. AgroSync links the farm, the Mandal Agri-Mart and your doorstep — with AI to guide every step.
          </p>
          <div className="actions">
            <a className="button gold-button" href="#marketplace">Shop fresh produce →</a>
            <a className="button outline-button" href="#signup">I’m a farmer</a>
            <a className="button outline-button" href="#signup">Partner with us</a>
          </div>
        </div>
      </section>
      <section className="section">
        <h2>How AgroSync works</h2>
        <p className="lead">A transparent chain from field to plate — and back to the field.</p>
        <div className="flow">
          {['Farmer', 'Listing', 'Collection', 'Quality check', 'AI grading', 'Inventory', 'Marketplace', 'Delivery', 'Vermicompost'].map((step, i) => (
            <span key={step}>
              <b>{i + 1}</b> {step}
            </span>
          ))}
        </div>
      </section>
      <section className="section tint">
        <h2>Smart agriculture, built in</h2>
        <div className="grid four feature-grid">
          <Card icon="↗" title="Live insights">Clear pricing, crop demand and practical guidance.</Card>
          <Card icon="♧" title="AI assistance">Smarter grading and recommendations at every step.</Card>
          <Card icon="⌕" title="Quality checks">Consistent produce grading at the Mandal hub.</Card>
          <Card icon="♻" title="Zero waste">Unsold produce can return to the soil as compost.</Card>
        </div>
      </section>
      <section className="section">
        <h2>Four interfaces, one ecosystem</h2>
        <p className="lead">Choose your view of AgroSync.</p>
        <div className="grid four role-grid">
          {roles.map(([icon, title, desc]) => (
            <Card key={title} icon={icon} title={title} href={`#dashboard-${roleRoute(title)}`}>
              {desc}
            </Card>
          ))}
        </div>
      </section>
      <section className="section tint">
        <h2>Fresh from the farm</h2>
        <p className="lead">Graded at the Mandal. Ready for your table.</p>
        <div className="actions top-gap">
          <a className="button primary-button" href="#marketplace">Browse the marketplace →</a>
          <a className="button" href="#membership">Explore membership</a>
        </div>
      </section>
    </>
  );
}

function PageHero({ eyebrow, title, children }) {
  return (
    <section className="page-hero">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {children && <p className="lead">{children}</p>}
    </section>
  );
}

function ProductCard({ product, onAdd }) {
  const src = product.imageUrl || (product.img?.startsWith('http')
    ? product.img
    : `https://images.unsplash.com/${product.img || 'photo-1546094096-0df4bcaaa337'}?auto=format&fit=crop&w=700&q=85`);

  return (
    <article className="card product-card">
      <div className="product-image">
        <img src={src} alt={product.name} />
      </div>
      <div className="product-body">
        <div className="product-title">
          <h3>{product.name}</h3>
          <span className="grade">Grade {product.grade}</span>
        </div>
        <p className="small">{product.farmer}</p>
        <p className="small">⌖ {product.village} · Harvest {product.date}</p>
        <div className="price-row">
          <div>
            <strong>{money(product.price)}<small>/kg</small></strong>
            <p className="small">{product.qty} kg available</p>
          </div>
          <button className="add-button" onClick={() => onAdd(product)}>Add</button>
        </div>
      </div>
    </article>
  );
}

function Marketplace({ addToBasket }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Browse produce');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [grade, setGrade] = useState('Any');
  const [maxPrice, setMaxPrice] = useState(100);
  const [stockOnly, setStockOnly] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('id', { ascending: true });

        if (error) console.error('Error fetching existing produce:', error.message);
        let approvedHarvests = [];
        try {
          approvedHarvests = await fetchApprovedHarvests();
        } catch (harvestError) {
          console.error('Error fetching approved harvests:', harvestError.message);
        }
        const harvestProducts = approvedHarvests.map((lot) => ({
          id: `harvest-${lot.id}`,
          harvestId: lot.id,
          name: lot.crop_name,
          farmer: lot.farmer_name,
          village: lot.village,
          date: lot.harvest_date,
          price: Number(lot.approved_price),
          qty: Number(lot.approved_quantity_kg),
          category: lot.category,
          grade: lot.grade,
          imageUrl: lot.photo_url,
        }));
        setProducts([...(data || []), ...harvestProducts]);
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
    const channel = supabase
      .channel('agrosync-marketplace-harvests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'harvest_listings' }, fetchProducts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => products.filter((p) =>
    (!query || `${p.name} ${p.farmer} ${p.village}`.toLowerCase().includes(query.toLowerCase())) &&
    (category === 'All' || p.category === category) &&
    (grade === 'Any' || p.grade === grade) &&
    p.price <= maxPrice &&
    (!stockOnly || p.qty > 0)
  ), [products, query, category, grade, maxPrice, stockOnly]);

  return (
    <>
      <PageHero eyebrow="Marketplace" title="Fresh from the farm, graded at the Mandal">
        Every listing is quality-checked at the Mandal Agri-Mart before it reaches you.
      </PageHero>
      <section className="content">
        <div className="tabs">
          <button className={tab === 'Browse produce' ? 'selected' : ''} onClick={() => setTab('Browse produce')}>Browse produce</button>
          <button className={tab === 'Reviews' ? 'selected' : ''} onClick={() => setTab('Reviews')}>Reviews</button>
        </div>
        {tab === 'Reviews' ? (
          <div className="grid three">
            <Card title="★★★★★ Fresh and delicious">The tomatoes arrived same day and tasted like they came straight from the farm.</Card>
            <Card title="★★★★★ Great quality">Every vegetable was carefully graded and packed.</Card>
            <Card title="★★★★☆ Easy local shopping">I love knowing which farmer grew my food.</Card>
          </div>
        ) : (
          <div className="market-layout">
            <aside className="filters">
              <label className="search-full">
                Search
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tomato, farmer, village..." />
              </label>
              <label>
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>All</option>
                  <option>Fruits</option>
                  <option>Vegetables</option>
                  <option>Grains</option>
                  <option>Pulses</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Quality grade
                <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                  <option>Any</option>
                  <option>A</option>
                  <option>B</option>
                  <option>C</option>
                </select>
              </label>
              <label className="search-full">
                Max price: ₹{maxPrice}
                <input type="range" min="10" max="100" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} />
              </label>
              <label className="check search-full">
                <input type="checkbox" checked={stockOnly} onChange={(e) => setStockOnly(e.target.checked)} /> In stock only
              </label>
            </aside>
            <div>
              <p className="listings-head">{loading ? 'Loading live produce...' : `${filtered.length} listings`}</p>
              <div className="product-grid">
                {filtered.map((p) => (
                  <ProductCard key={p.id || p.name} product={p} onAdd={addToBasket} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function Membership() {
  const benefits = [
    ['Membership Price', '₹299'],
    ['Validity', '18 Months'],
    ['Membership', 'Single Member Only'],
    ['Discount on Eligible Produce', '5% on fruits & vegetables'],
    ['Special Festival Offers', 'Sankranti, Ugadi, Dasara etc.'],
    ['Reward Points', 'On every purchase'],
    ['Fresh & Direct from Farmers', '✓'],
    ['Online Ordering', 'Through Mandal Mart / Online Platform'],
  ];
  return (
    <>
      <PageHero eyebrow="Membership" title="A little more value in every basket">
        Join the AgroSync Green Card and enjoy affordable fresh food and member rewards.
      </PageHero>
      <section className="content">
        <div className="membership-card">
          <div className="membership-intro">
            <div>
              <div className="eyebrow">AgroSync Green Card</div>
              <h2>Affordable · Long-term · More Value</h2>
              <p className="lead">One simple membership for your household’s everyday produce.</p>
            </div>
            <div className="green-card">
              <small>AgroSync Green Card</small>
              <strong>₹299</strong>
              <span>18 months · Single member</span>
            </div>
          </div>
          <div className="benefit-table">
            {benefits.map(([label, value]) => (
              <div className="benefit-row" key={label}>
                <b>{label}</b>
                <span>{value}</span>
              </div>
            ))}
          </div>
          <button className="button primary-button centered" onClick={() => alert('Demo only — connect a backend to activate membership checkout.')}>
            Choose Green Card →
          </button>
        </div>
      </section>
    </>
  );
}

function AgriMart() {
  const steps = [
    ['▧', 'Collection', 'Scheduled pickups and farmer drop-offs.'],
    ['⚖', 'Weighing', 'Received quantities verified on certified scales.'],
    ['⌕', 'Grading', 'AI-assisted Grade A/B/C, confirmed by an operator.'],
    ['▤', 'Storage', 'Cold rooms and racks with batch & expiry tracking.'],
    ['▱', 'Local sales', 'In-store shopping with Gold member discounts.'],
    ['♧', 'Distribution', 'Online orders, vending restock and route partners.'],
  ];
  return (
    <section className="section">
      <div className="grid three">
        {steps.map(([icon, title, desc], i) => (
          <article className="card step-card" key={title}>
            <div className="step-icon">
              <b>{i + 1}</b>
              <span>{icon}</span>
            </div>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Vending() {
  const [tab, setTab] = useState('Machines & menu');
  const menus = [
    ['🧃', 'Fruit juices', 'Mango, mosambi, watermelon'],
    ['🥕', 'Vegetable juices', 'Carrot-beet, cucumber-mint'],
    ['🍉', 'Fruit salads', 'Seasonal mixed bowls'],
  ];
  const machines = [
    ['Madanapalli Bus Stand', 'VM-MDP-01', '4.2°C', 'Mango Juice', '18 left', 'Carrot-Beet Juice', '6 left', 'Fruit Salad Bowl', '12 left', 'Online'],
    ['Govt. Hospital Gate', 'VM-MDP-02', '3.8°C', 'Mosambi Juice', '22 left', 'Cucumber-Mint Juice', '3 left', 'Fruit Salad Bowl', '9 left', 'Online'],
    ['BT College Campus', 'VM-MDP-03', '7.9°C', 'Watermelon Juice', 'Out of stock', 'Fruit Salad Bowl', '2 left', '', '', 'Maintenance'],
  ];
  return (
    <section className="content">
      <div className="tabs">
        <button className={tab === 'Machines & menu' ? 'selected' : ''} onClick={() => setTab('Machines & menu')}>Machines & menu</button>
        <button className={tab === 'Reviews' ? 'selected' : ''} onClick={() => setTab('Reviews')}>Reviews</button>
      </div>
      {tab === 'Reviews' ? (
        <p className="lead">Fresh drinks, close to home. Reviews are coming soon.</p>
      ) : (
        <>
          <div className="grid three">
            {menus.map(([emoji, title, desc]) => (
              <article className="card menu-card" key={title}>
                <span>{emoji}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              </article>
            ))}
          </div>
          <h2 className="subheading">Find a machine</h2>
          <div className="grid three">
            {machines.map((m) => (
              <article className="card machine-card" key={m[1]}>
                <span className={m[9] === 'Online' ? 'status' : 'status warning'}>{m[9]}</span>
                {m[0]}
                <p className="small">{m[1]}</p>
                <p className="machine-temp">Chilled at {m[2]}</p>
                {[3, 5, 7].map((i) => (
                  <div className="machine-row" key={i}>
                    <span>{m[i]}</span>
                    <span>{m[i + 1]}</span>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Sustainability() {
  const steps = ['Segregation', 'Suitable organic waste', 'Vermicompost beds', 'Curing & packing', 'Back to farmers'];
  return (
    <>
      <PageHero eyebrow="Sustainability" title="Nothing good goes to waste">
        Unsold or damaged produce that’s unfit for sale is segregated and, where suitable, turned into vermicompost.
      </PageHero>
      <section className="content">
        <div className="flow green-flow">
          {steps.map((step, i) => (
            <span key={step}>
              {step}
              {i < steps.length - 1 && <b> → </b>}
            </span>
          ))}
        </div>
        <div className="grid three top-gap">
          <Card title="Segregation first">Plastics, packaging and non-compostables are separated at source.</Card>
          <Card title="Tracked inputs">Every kilogram sent to compost is logged against its batch.</Card>
          <Card title="Closing the loop">Finished compost can be offered back to partner farmers.</Card>
        </div>
      </section>
    </>
  );
}

function About() {
  return (
    <>
      <PageHero eyebrow="About" title="A fairer, fresher food system — starting in Madanapalli">
        AgroSync is an AI-powered decision-support and farm-to-consumer platform.
      </PageHero>
      <section className="content">
        <div className="grid two">
          <Card title="The problem">Small farmers sell with little price visibility, long middleman chains and high post-harvest loss. Consumers pay more for produce that is less fresh.</Card>
          <Card title="Our solution">A Mandal-level hub for collection and grading, an online marketplace, community delivery, healthy vending and vermicomposting — tied together with AI insights.</Card>
          <Card title="Vision">Every Mandal with a transparent, data-driven, zero-waste local food economy.</Card>
          <Card title="Mission">Raise farmer income, cut avoidable food waste and make fresh produce accessible to every household.</Card>
          <Card title="Team">Team details coming soon.</Card>
        </div>
      </section>
    </>
  );
}

function Basket({ items, setItems, fulfillment, setFulfillment, onToast, user, setRoute }) {
  const [deliveryAddress, setDeliveryAddress] = useState(user?.user_metadata?.address || '');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const subtotal = items.reduce((sum, item) => sum + item.price * item.count, 0);
  const delivery = fulfillment === 'collect' ? 0 : 20;
  const canCheckout = (user?.app_metadata?.role || user?.user_metadata?.role) === 'Consumer';
  const itemKey = (item) => item.harvestId || item.id || item.name;
  const changeCount = (key, delta) =>
    setItems((current) =>
      current
        .map((i) => (itemKey(i) === key ? { ...i, count: i.count + delta } : i))
        .filter((i) => i.count > 0)
    );

  return (
    <>
      <PageHero eyebrow="Checkout" title="Your basket" />
      <section className="content">
        <div className="checkout-layout">
          <div className="card basket-card">
            {items.length ? (
              items.map((item) => (
                <div className="basket-row" key={item.harvestId || item.id || item.name}>
                  <div>
                    <b>{item.name}</b>
                    <p className="small">{money(item.price)}/kg</p>
                  </div>
                  <div className="quantity">
                    <button aria-label={`Remove one kg of ${item.name}`} onClick={() => changeCount(itemKey(item), -1)}>−</button>
                    <span>{item.count} kg</span>
                    <button aria-label={`Add one kg of ${item.name}`} onClick={() => changeCount(itemKey(item), 1)}>+</button>
                  </div>
                  <button className="text-button" onClick={() => setItems((current) => current.filter((i) => itemKey(i) !== itemKey(item)))}>
                    Remove
                  </button>
                  <b>{money(item.price * item.count)}</b>
                </div>
              ))
            ) : (
              <div className="basket-empty">
                Your basket is empty. <a href="#marketplace">Browse produce</a>
              </div>
            )}
          </div>
          <aside className="card summary-card">
            <h3>Fulfilment</h3>
            <label>
              <input type="radio" checked={fulfillment === 'delivery'} onChange={() => setFulfillment('delivery')} /> Community delivery (₹20)
            </label>
            <label>
              <input type="radio" checked={fulfillment === 'collect'} onChange={() => setFulfillment('collect')} /> Collect at Mandal Agri-Mart (free)
            </label>
            {fulfillment === 'delivery' && (
              <label className="wf-address-label">
                Delivery address
                <textarea rows="3" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="House, street, village or area" required />
              </label>
            )}
            <div className="summary-line"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="summary-line"><span>Member discount</span><span>−₹0</span></div>
            <div className="summary-line"><span>Delivery</span><span>{money(items.length ? delivery : 0)}</span></div>
            <div className="summary-total"><b>Total</b><b>{money(items.length ? subtotal + delivery : 0)}</b></div>
            <p className="small">Members save on eligible produce. <a href="#membership">See plans</a></p>
            <button
              className="button primary-button full-button"
              disabled={!items.length || placing || !canCheckout || (fulfillment === 'delivery' && !deliveryAddress.trim())}
              onClick={async () => {
                if (!canCheckout) {
                  onToast(user ? 'Use a Consumer account to place this order.' : 'Sign in as a consumer before placing an order.');
                  if (!user) setRoute('signin');
                  return;
                }
                setPlacing(true);
                setError('');
                try {
                  await createWorkflowOrder({ user, items, fulfillment, deliveryAddress: deliveryAddress.trim() });
                  setItems([]);
                  onToast(fulfillment === 'delivery' ? 'Order placed and added to the delivery queue.' : 'Order placed for Mandal collection.');
                  setRoute('dashboard-consumer');
                } catch (orderError) {
                  setError(orderError.message || 'Could not place your order. Please try again.');
                } finally {
                  setPlacing(false);
                }
              }}
            >
              {placing ? 'Placing order...' : 'Place order'}
            </button>
            {!canCheckout && <p className="wf-error">{user ? 'Only Consumer accounts can submit orders.' : <>Sign in as a consumer to submit your order. <a href="#signin">Sign in</a></>}</p>}
            {error && <p className="wf-error" role="alert">{error}</p>}
          </aside>
        </div>
      </section>
    </>
  );
}

function Auth({ signup, onToast, setRoute }) {
  const [role, setRole] = useState('Farmer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role: role }
          }
        });

        if (error) throw error;

        onToast('Account created successfully!');
        setRoute(`dashboard-${roleRoute(role)}`);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        const userRole = data.user?.app_metadata?.role || data.user?.user_metadata?.role || 'Farmer';
        onToast('Signed in successfully!');
        setRoute(`dashboard-${roleRoute(userRole)}`);
      }
    } catch (err) {
      alert(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-wrap">
      <h1>{signup ? 'Create your AgroSync account' : 'Sign in to AgroSync'}</h1>
      <p className="lead">
        {signup ? 'Choose your interface and sign up with your email.' : 'Use your email to open your dashboard.'}
      </p>
      <form onSubmit={handleAuth}>
        {signup && (
          <div className="role-select">
            {(signup ? ['Farmer', 'Consumer'] : roleNames).map((r) => (
              <button
                className={role === r ? 'selected' : ''}
                key={r}
                type="button"
                onClick={() => setRole(r)}
              >
                {r}
              </button>
            ))}
          </div>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <button className="button primary-button full-button" disabled={loading}>
          {loading ? 'Please wait...' : signup ? 'Sign up' : 'Sign in'}
        </button>
      </form>
      <p className="auth-switch">
        <a href={signup ? '#signin' : '#signup'}>
          {signup ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </a>
      </p>
    </section>
  );
}

function Dashboard({ route, user, onToast, setRoute }) {
  return <WorkflowDashboard route={route} user={user} onToast={onToast} onNavigate={setRoute} />;
}

export default function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || 'home');
  const [items, setItems] = useState(readBasket);
  const [fulfillment, setFulfillment] = useState('delivery');
  const [toast, setToast] = useState('');
  const [user, setUser] = useState(null);

  const basketCount = items.reduce((sum, item) => sum + item.count, 0);
  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  };
  const go = (next) => {
    location.hash = next;
    setRoute(next);
  };

  const addToBasket = (product) => {
    setItems((current) => {
      const key = product.harvestId || product.id || product.name;
      const existing = current.find((i) => (i.harvestId || i.id || i.name) === key);
      return existing
        ? current.map((i) => ((i.harvestId || i.id || i.name) === key ? { ...i, count: i.count + 1 } : i))
        : [...current, { ...product, count: 1 }];
    });
    notify(`${product.name} added to your basket`);
  };

  useEffect(() => {
    const sync = () => setRoute(location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    localStorage.setItem('agrosync-basket', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    notify('Signed out successfully');
    go('home');
  };

  let page;
  if (route === 'home') page = <Home />;
  else if (route === 'marketplace') page = <Marketplace addToBasket={addToBasket} />;
  else if (route === 'membership') page = <Membership />;
  else if (route === 'agri-mart') page = <AgriMart />;
  else if (route === 'vending') page = <Vending />;
  else if (route === 'sustainability') page = <Sustainability />;
  else if (route === 'about') page = <About />;
  else if (route === 'basket')
    page = (
        <Basket
        items={items}
        setItems={setItems}
        fulfillment={fulfillment}
        setFulfillment={setFulfillment}
        onToast={notify}
          user={user}
          setRoute={go}
      />
    );
  else if (route === 'signin' || route === 'signup')
    page = <Auth signup={route === 'signup'} onToast={notify} setRoute={go} />;
  else if (route.startsWith('dashboard-'))
    page = <Dashboard route={route} user={user} onToast={notify} setRoute={go} />;
  else page = <Home />;

  return (
    <>
      <Header route={route} basketCount={basketCount} user={user} onSignOut={handleSignOut} />
      <main>{page}</main>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
