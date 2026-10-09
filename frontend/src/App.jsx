import React, { useEffect, useMemo, useState } from "react";
import { Search, Play, Plus, Check, Flame, Compass, Bookmark, Newspaper, UserRound, X, Star, Clock3, Menu, ExternalLink, ChevronRight, Sparkles, ShieldCheck } from "lucide-react";
import { starterAnime, newsItems } from "./data.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const getImage = (item) => item?.images?.jpg?.large_image_url || item?.images?.jpg?.image_url || item?.image || "";
function normalize(item) {
  return {
    ...item,
    title: item.title_english || item.title || "Untitled anime",
    image: getImage(item),
    genres: item.genres?.map((g) => typeof g === "string" ? g : g.name) || [],
    year: item.year || item.aired?.prop?.from?.year || "—",
    synopsis: item.synopsis || "No synopsis is available yet.",
    type: item.type || "Anime",
    episodes: item.episodes ?? "—"
  };
}

export default function App() {
  const [anime, setAnime] = useState(starterAnime);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const [tab, setTab] = useState("Home");
  const [selected, setSelected] = useState(null);
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem("animepride-watchlist") || "[]"); } catch { return []; }
  });
  const [apiStatus, setApiStatus] = useState("Connecting to online catalogue…");
  const [remoteSearch, setRemoteSearch] = useState([]);
  const [remoteMessage, setRemoteMessage] = useState("");
  const [playerOpen, setPlayerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => { localStorage.setItem("animepride-watchlist", JSON.stringify(watchlist)); }, [watchlist]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/anime/top?limit=12`)
      .then((r) => { if (!r.ok) throw new Error("API offline"); return r.json(); })
      .then((data) => {
        if (!cancelled && data.items?.length) {
          setAnime(data.items.map(normalize));
          setApiStatus("Connected to online anime metadata");
        }
      })
      .catch(() => { if (!cancelled) setApiStatus("Using starter catalogue — start backend for online data"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setRemoteSearch([]); setRemoteMessage(""); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/anime/search?q=${encodeURIComponent(query.trim())}&limit=12`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json();
        setRemoteSearch((data.items || []).map(normalize));
        setRemoteMessage("");
      } catch (error) {
        if (error.name !== "AbortError") { setRemoteSearch([]); setRemoteMessage("Online search is unavailable. Showing the local catalogue."); }
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const genres = useMemo(() => ["All", ...new Set(anime.flatMap((a) => a.genres || []))].slice(0, 9), [anime]);
  const visibleAnime = useMemo(() => {
    const source = query.trim().length >= 2 && remoteSearch.length ? remoteSearch : anime;
    return source.filter((item) => {
      const q = query.toLowerCase();
      const matchText = (item.title || "").toLowerCase().includes(q) ||
        (item.synopsis || "").toLowerCase().includes(q) ||
        (item.genres || []).some((g) => g.toLowerCase().includes(q));
      const matchGenre = genre === "All" || (item.genres || []).some((g) => g.toLowerCase() === genre.toLowerCase());
      const matchTab = tab !== "Watchlist" || watchlist.includes(String(item.mal_id));
      return matchText && matchGenre && matchTab;
    });
  }, [anime, query, genre, tab, watchlist, remoteSearch]);

  const toggleWatchlist = (item) => {
    const id = String(item.mal_id);
    setWatchlist((old) => old.includes(id) ? old.filter((x) => x !== id) : [...old, id]);
  };
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  const navItems = [{ name: "Home", icon: Compass }, { name: "Explore", icon: Search }, { name: "Watchlist", icon: Bookmark }, { name: "News", icon: Newspaper }];

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#home" onClick={() => setTab("Home")}><span className="brand-mark"><Flame size={23} fill="currentColor" /></span><span>ANIME<span className="brand-red">PRIDE</span></span></a>
      <button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu ? <X /> : <Menu />}</button>
      <nav className={`main-nav ${mobileMenu ? "open" : ""}`}>
        {navItems.map(({ name, icon: Icon }) => <button key={name} className={`nav-link ${tab === name ? "active" : ""}`} onClick={() => {
          setTab(name); setMobileMenu(false);
          if (name === "News") scrollTo("news");
          else if (name === "Explore" || name === "Watchlist") scrollTo("library");
          else window.scrollTo({ top: 0, behavior: "smooth" });
        }}><Icon size={16} />{name}</button>)}
      </nav>
      <div className="top-actions"><button className="icon-button" aria-label="Account preview" onClick={() => setAccountOpen(true)}><UserRound size={19} /></button><button className="login-button" onClick={() => setAccountOpen(true)}>Sign in</button></div>
    </header>

    <main>
      <section className="hero" id="home">
        <div className="hero-image" /><div className="hero-shade" />
        <div className="hero-content">
          <div className="eyebrow"><span className="live-dot" /> YOUR NEXT ANIME OBSESSION</div>
          <h1>Stories that<br />set your soul <span>on fire.</span></h1>
          <p>Discover unforgettable worlds, legendary heroes, and stories worth staying up for.</p>
          <div className="hero-actions"><button className="button button-primary" onClick={() => { setTab("Explore"); scrollTo("library"); }}><Compass size={17} />Explore anime</button><button className="button button-ghost" onClick={() => setSelected(anime[0])}><Play size={17} />Discover a title</button></div>
          <div className="hero-meta"><span><Sparkles size={15} /> Curated discoveries</span><span><ShieldCheck size={15} /> Fan-focused catalogue</span></div>
        </div>
        <div className="hero-stamp"><span>ANIMEPRIDE</span><b>AP / 001</b></div>
      </section>

      <section className="quick-stats content-width">
        <div><span className="stat-icon"><Flame size={18} /></span><span><b>Find your next favorite</b><small>Explore stories across genres</small></span></div>
        <div><span className="stat-icon"><Bookmark size={18} /></span><span><b>Your personal collection</b><small>Save titles to this browser</small></span></div>
        <div><span className="stat-icon"><ExternalLink size={18} /></span><span><b>Online catalogue</b><small>{apiStatus}</small></span></div>
      </section>

      <section className="content-section content-width" id="library">
        <div className="section-heading"><div><p className="section-kicker">THE DISCOVERY ROOM</p><h2>{tab === "Watchlist" ? "Your watchlist" : tab === "Explore" ? "Explore anime" : "Popular right now"}<span className="red-period">.</span></h2></div><button className="text-button" onClick={() => { setTab("Explore"); setGenre("All"); setQuery(""); }}>View all <ChevronRight size={16} /></button></div>
        <label className="search-field"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles, stories, or genres…" aria-label="Search anime" />{query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}<kbd>SEARCH</kbd></label>
        {remoteMessage && <p className="inline-message">{remoteMessage}</p>}
        <div className="genre-row" aria-label="Genre filters">{genres.map((g) => <button key={g} className={`genre-chip ${genre === g ? "selected" : ""}`} onClick={() => setGenre(g)}>{g}</button>)}</div>
        <div className="anime-grid">{visibleAnime.map((item, index) => {
          const saved = watchlist.includes(String(item.mal_id));
          return <article className="anime-card" key={item.mal_id || item.title}>
            <button className="poster-button" onClick={() => setSelected(item)} aria-label={`View ${item.title} details`}>
              <div className={`poster-fallback fallback-${index % 6}`} />
              {item.image && <img className="poster-image" src={item.image} alt={`${item.title} cover`} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
              <span className="poster-gradient" /><span className="poster-type">{item.type || "ANIME"}</span><span className="poster-open"><Play size={18} fill="currentColor" /></span><span className="poster-title">{item.title}</span>
            </button>
            <div className="card-info"><div className="card-meta"><span>{item.year || "Discover"}</span><span className="rating"><Star size={13} fill="currentColor" />{item.score || "—"}</span></div><h3><button onClick={() => setSelected(item)}>{item.title}</button></h3><p>{(item.genres || []).slice(0, 3).join(" · ") || item.type || "Anime"}</p><button className={`save-button ${saved ? "saved" : ""}`} onClick={() => toggleWatchlist(item)}>{saved ? <Check size={15} /> : <Plus size={15} />}{saved ? "Saved" : "Watchlist"}</button></div>
          </article>;
        })}</div>
        {visibleAnime.length === 0 && <div className="empty-state"><Search size={27} /><h3>No titles found</h3><p>Try another title or switch back to Explore.</p><button className="button button-primary" onClick={() => { setQuery(""); setGenre("All"); setTab("Explore"); }}>Reset filters</button></div>}
      </section>

      <section className="featured-strip"><div className="featured-art"><div className="featured-art-ring" /><span>次の章</span></div><div className="featured-copy"><p className="section-kicker">YOUR NEXT CHAPTER</p><h2>Every legend<br />starts with a <span>first episode.</span></h2><p>Build your watchlist, explore new worlds, and make every watch session count.</p><button className="button button-primary" onClick={() => { setTab("Explore"); scrollTo("library"); }}>Find your next story <ChevronRight size={17} /></button></div></section>

      <section className="content-section content-width news-section" id="news"><div className="section-heading"><div><p className="section-kicker">FROM THE ANIME UNIVERSE</p><h2>Fresh discoveries<span className="red-period">.</span></h2></div><span className="muted-label"><Newspaper size={15} /> EDITORIAL</span></div><div className="news-grid">{newsItems.map((item) => <article className="news-card" key={item.title}><span className="news-tag">{item.tag}</span><h3>{item.title}</h3><p>{item.description}</p><span className="news-arrow"><ChevronRight size={18} /></span></article>)}</div><p className="attribution">Anime metadata may be provided by Jikan API. Animepride is an independent fan project and is not affiliated with anime studios or rights holders.</p></section>
    </main>

    <footer className="footer"><a className="brand" href="#home"><span className="brand-mark"><Flame size={21} fill="currentColor" /></span><span>ANIME<span className="brand-red">PRIDE</span></span></a><p>Discover stories. Find your people. Keep exploring.</p><span>© {new Date().getFullYear()} Animepride · Fan discovery demo</span></footer>

    {selected && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><section className="detail-modal" role="dialog" aria-modal="true" aria-label={`${selected.title} details`}><button className="modal-close icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X /></button><div className="detail-cover">{selected.image && <img src={selected.image} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />}<div className="detail-cover-shade" /><div className="detail-title"><span className="section-kicker">ANIME DETAILS</span><h2>{selected.title}</h2><div className="detail-tags"><span>{selected.year}</span><span>{selected.type}</span><span><Star size={13} fill="currentColor" />{selected.score || "Not rated"}</span></div></div></div><div className="detail-body"><p>{selected.synopsis}</p><div className="detail-genres">{(selected.genres || []).map((g) => <span key={g}>{g}</span>)}</div><div className="detail-facts"><span><b>Episodes</b>{selected.episodes ?? "Unknown"}</span><span><b>Release year</b>{selected.year || "Unknown"}</span><span><b>Type</b>{selected.type || "Anime"}</span></div><div className="detail-actions"><button className="button button-primary" onClick={() => { setSelected(null); setPlayerOpen(true); }}><Play size={17} fill="currentColor" />Open demo player</button><button className="button button-ghost" onClick={() => toggleWatchlist(selected)}>{watchlist.includes(String(selected.mal_id)) ? <Check size={17} /> : <Plus size={17} />}Watchlist</button></div><p className="demo-note">Playback is a demo. Add a video you own or are authorized to stream before publishing.</p></div></section></div>}

    {playerOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPlayerOpen(false); }}><section className="player-modal" role="dialog" aria-modal="true" aria-label="Demo video player"><button className="modal-close icon-button" onClick={() => setPlayerOpen(false)} aria-label="Close player"><X /></button><p className="section-kicker">ANIMEPRIDE PLAYER · DEMO</p><h2>Video player preview</h2><video controls playsInline src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4">Your browser does not support HTML video.</video><p className="demo-note">This is a sample video, not an anime episode. Replace it with an authorized video URL.</p></section></div>}

    {accountOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setAccountOpen(false); }}><section className="account-modal" role="dialog" aria-modal="true" aria-label="Account feature preview"><button className="modal-close icon-button" onClick={() => setAccountOpen(false)} aria-label="Close account preview"><X /></button><span className="account-icon"><UserRound size={25} /></span><p className="section-kicker">MEMBER EXPERIENCE</p><h2>Make Animepride yours.</h2><p>Accounts, cloud-synced watchlists, ratings, and saved viewing progress are planned for a later backend stage.</p><div className="account-demo-list"><span><Check size={15} /> Personal watchlists in this browser</span><span><Clock3 size={15} /> Continue watching — upcoming</span><span><Star size={15} /> Ratings and reviews — upcoming</span></div><button className="button button-primary full-width" onClick={() => setAccountOpen(false)}>Got it</button><p className="demo-note">Sign-in is not active in this demo. No password is requested or stored.</p></section></div>}
  </div>;
}
