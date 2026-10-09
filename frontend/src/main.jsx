import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Search, Play, Plus, Check, Menu, X, UserRound, LogOut, ShieldCheck, Sparkles, Clock3, Star, Heart, Film, Flame, Newspaper, ChevronRight, LoaderCircle } from 'lucide-react'
import './styles.css'

const api = async (path, options={}) => {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Something went wrong')
  return data
}
const sampleImages = [
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1601850494422-3cf14624b0b3?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1614583225154-5fcells?auto=format&fit=crop&w=900&q=80',
]
const fallback = (a, i=0) => a.image_url || `https://placehold.co/600x850/15151e/f04452?text=${encodeURIComponent(a.title || 'Animepride')}`
function App() {
  const [user,setUser] = useState(null)
  const [anime,setAnime] = useState([])
  const [news,setNews] = useState([])
  const [query,setQuery] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [selected,setSelected] = useState(null)
  const [watchlist,setWatchlist] = useState([])
  const [progress,setProgress] = useState([])
  const [reviews,setReviews] = useState([])
  const [episodes,setEpisodes] = useState([])
  const [activeEpisode,setActiveEpisode] = useState(null)
  const [episodeForm,setEpisodeForm] = useState({anime_id:'',episode_number:1,title:'',video_url:'',video_type:'mp4',duration_seconds:0,is_published:true})
  const [tab,setTab] = useState('home')
  const [authMode,setAuthMode] = useState('')
  const [authForm,setAuthForm] = useState({email:'',username:'',password:''})
  const [notice,setNotice] = useState('')
  const [mobileOpen,setMobileOpen] = useState(false)
  const [adminStats,setAdminStats] = useState(null)
  const [adminAnime,setAdminAnime] = useState([])
  const [adminNews,setAdminNews] = useState([])
  const [adminUsers,setAdminUsers] = useState([])
  const [animeForm,setAnimeForm] = useState({title:'',synopsis:'',image_url:'',genres:'Action',year:new Date().getFullYear(),status:'Ongoing',video_url:'',video_type:'mp4',is_published:true})
  const [newsForm,setNewsForm] = useState({title:'',excerpt:'',image_url:'',source_url:'',is_published:true})
  const [reviewForm,setReviewForm] = useState({rating:8,body:''})

  async function loadHome() {
    setBusy(true); setError('')
    try {
      const [featured, articles] = await Promise.all([api('/anime/featured'),api('/news')])
      setAnime(featured.data || []); setNews(articles || [])
    } catch(e) { setError(e.message) } finally { setBusy(false) }
  }
  async function refreshUser() {
    try {
      const me = await api('/auth/me'); setUser(me)
      const [w,p] = await Promise.all([api('/me/watchlist'),api('/me/progress')])
      setWatchlist(w); setProgress(p)
    } catch { setUser(null); setWatchlist([]); setProgress([]) }
  }
  useEffect(() => { loadHome(); refreshUser() }, [])
  useEffect(() => {
    if (user?.role === 'admin' && tab === 'admin') loadAdmin()
  }, [user,tab])
  async function loadAdmin() {
    try {
      const [stats,a,n,u] = await Promise.all([api('/admin/overview'),api('/admin/anime'),api('/admin/news'),api('/admin/users')])
      setAdminStats(stats); setAdminAnime(a); setAdminNews(n); setAdminUsers(u)
    } catch(e) { setNotice(e.message) }
  }
  async function search() {
    if (!query.trim()) return loadHome()
    setBusy(true); setError('')
    try { const result = await api(`/anime/search?q=${encodeURIComponent(query.trim())}`); setAnime(result.data || []); setTab('search') }
    catch(e) { setError(e.message); setAnime([]) } finally { setBusy(false) }
  }
  async function authSubmit(e) {
    e.preventDefault(); setNotice('')
    try {
      const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login'
      const payload = authMode === 'register' ? authForm : {email:authForm.email,password:authForm.password}
      const me = await api(endpoint,{method:'POST',body:JSON.stringify(payload)})
      setUser(me); setAuthMode(''); setAuthForm({email:'',username:'',password:''}); await refreshUser()
      setNotice(`Welcome ${me.username}!`)
    } catch(e) { setNotice(e.message) }
  }
  async function logout() {
    try { await api('/auth/logout',{method:'POST'}); setUser(null); setWatchlist([]); setProgress([]); setTab('home'); setNotice('Signed out.') }
    catch(e) { setNotice(e.message) }
  }
  async function openDetails(a) {
    setSelected(a); setReviews([]); setEpisodes([]); setActiveEpisode(null); setReviewForm({rating:8,body:''})
    if (a.id) {
      try { const [r, ep] = await Promise.all([api(`/anime/${a.id}/reviews`), api(`/anime/${a.id}/episodes`)]); setReviews(r); setEpisodes(ep); setActiveEpisode(ep[0] || null) } catch {}
    }
  }
  async function toggleWatchlist(a) {
    if (!user) { setAuthMode('login'); return }
    if (!a.id) { setNotice('This result is external metadata. Open it through a catalogue entry to save it.'); return }
    try {
      const has = watchlist.some(x => x.id === a.id)
      if (has) { await api(`/me/watchlist/${a.id}`,{method:'DELETE'}); setWatchlist(watchlist.filter(x=>x.id!==a.id)) }
      else { await api(`/me/watchlist/${a.id}`,{method:'POST'}); setWatchlist([...watchlist,a]) }
      setNotice(has ? 'Removed from your watchlist.' : 'Added to your watchlist.')
    } catch(e) { setNotice(e.message) }
  }
  async function submitReview(e) {
    e.preventDefault()
    if (!selected?.id) return setNotice('Reviews are available for catalogue titles only.')
    try {
      await api(`/anime/${selected.id}/reviews`,{method:'POST',body:JSON.stringify(reviewForm)})
      setReviews(await api(`/anime/${selected.id}/reviews`)); setNotice('Review saved.')
    } catch(e) { setNotice(e.message) }
  }
  async function saveAnime(e) {
    e.preventDefault()
    try {
      await api('/admin/anime',{method:'POST',body:JSON.stringify(animeForm)})
      setAnimeForm({title:'',synopsis:'',image_url:'',genres:'Action',year:new Date().getFullYear(),status:'Ongoing',video_url:'',video_type:'mp4',is_published:true})
      await loadAdmin(); setNotice('Anime added to catalogue.')
    } catch(e) { setNotice(e.message) }
  }
  async function saveNews(e) {
    e.preventDefault()
    try { await api('/admin/news',{method:'POST',body:JSON.stringify(newsForm)}); setNewsForm({title:'',excerpt:'',image_url:'',source_url:'',is_published:true}); await loadAdmin(); setNotice('News published.') }
    catch(e) { setNotice(e.message) }
  }
  async function deleteAnime(id) { if(!confirm('Delete this catalogue entry?')) return; try { await api(`/admin/anime/${id}`,{method:'DELETE'}); await loadAdmin(); setNotice('Anime deleted.') } catch(e){setNotice(e.message)} }
  async function deleteNews(id) { if(!confirm('Delete this news post?')) return; try { await api(`/admin/news/${id}`,{method:'DELETE'}); await loadAdmin(); setNotice('News deleted.')} catch(e){setNotice(e.message)} }
  async function setUserStatus(u, active) {
    try { await api(`/admin/users/${u.id}/status?active=${active}`,{method:'PUT'}); await loadAdmin() } catch(e) { setNotice(e.message) }
  }
  const displayed = useMemo(() => anime, [anime])
  const nav = [{id:'home',label:'Discover',icon:Sparkles},{id:'watchlist',label:'My List',icon:Heart},{id:'continue',label:'Continue Watching',icon:Clock3},{id:'news',label:'News',icon:Newspaper}]
  return <div className="app-shell">
    <header className="topbar">
      <button className="mobile-menu icon-btn" onClick={()=>setMobileOpen(!mobileOpen)} aria-label="Open menu">{mobileOpen?<X/>:<Menu/>}</button>
      <button className="brand" onClick={()=>{setTab('home');loadHome()}}><span className="brand-mark">A<span>+</span></span><span>ANIME<span className="red">PRIDE</span><small>YOUR NEXT OBSESSION</small></span></button>
      <nav className={mobileOpen?'nav-links open':'nav-links'}>
        {nav.map(n=><button key={n.id} className={tab===n.id?'nav-item active':'nav-item'} onClick={()=>{setTab(n.id);setMobileOpen(false)}}><n.icon size={16}/>{n.label}</button>)}
        {user?.role==='admin'&&<button className={tab==='admin'?'nav-item active':'nav-item'} onClick={()=>{setTab('admin');setMobileOpen(false)}}><ShieldCheck size={16}/>Admin</button>}
      </nav>
      <form className="search-box" onSubmit={e=>{e.preventDefault();search()}}><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search anime..." aria-label="Search anime"/><button type="submit">GO</button></form>
      {user ? <div className="user-area"><span className="avatar">{user.username.slice(0,1).toUpperCase()}</span><span className="username">{user.username}</span><button className="icon-btn" onClick={logout} title="Sign out"><LogOut size={17}/></button></div> : <button className="sign-in" onClick={()=>setAuthMode('login')}><UserRound size={16}/> Sign in</button>}
    </header>

    {notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
    {error&&<div className="notice error">{error}<button onClick={()=>setError('')}><X size={15}/></button></div>}

    {tab==='admin'&&user?.role==='admin' ? <main className="page admin-page">
      <div className="section-heading"><div><span className="eyebrow">CONTROL ROOM</span><h1>Admin dashboard</h1><p>Manage catalogue entries, news and community access.</p></div><button className="outline-btn" onClick={loadAdmin}>Refresh</button></div>
      <div className="stats-grid">{[['Users',adminStats?.users],['Catalogue titles',adminStats?.anime],['Reviews',adminStats?.reviews],['News posts',adminStats?.news]].map(([label,val])=><div className="stat-card" key={label}><span>{label}</span><strong>{val??'—'}</strong></div>)}</div>
      <div className="admin-grid">
        <section className="panel"><h2>Add catalogue title</h2><p className="muted">Only add video URLs you have the rights to distribute. Video URL must use HTTPS.</p>
          <form className="stack-form" onSubmit={saveAnime}>
            <label>Title<input required value={animeForm.title} onChange={e=>setAnimeForm({...animeForm,title:e.target.value})}/></label>
            <label>Poster image URL<input value={animeForm.image_url} onChange={e=>setAnimeForm({...animeForm,image_url:e.target.value})} placeholder="https://..."/></label>
            <label>Genres (comma-separated)<input value={animeForm.genres} onChange={e=>setAnimeForm({...animeForm,genres:e.target.value})}/></label>
            <label>Synopsis<textarea value={animeForm.synopsis} onChange={e=>setAnimeForm({...animeForm,synopsis:e.target.value})}/></label>
            <div className="form-row"><label>Year<input type="number" value={animeForm.year} onChange={e=>setAnimeForm({...animeForm,year:Number(e.target.value)})}/></label><label>Status<select value={animeForm.status} onChange={e=>setAnimeForm({...animeForm,status:e.target.value})}><option>Ongoing</option><option>Completed</option><option>Upcoming</option><option>Unknown</option></select></label></div>
            <label>Authorized video URL<input value={animeForm.video_url} onChange={e=>setAnimeForm({...animeForm,video_url:e.target.value})} placeholder="https://your-cdn.example/video.mp4"/></label>
            <label>Video format<select value={animeForm.video_type} onChange={e=>setAnimeForm({...animeForm,video_type:e.target.value})}><option value="mp4">MP4</option><option value="hls">HLS (.m3u8)</option></select></label>
            <button className="primary-btn" type="submit">Add anime</button>
          </form>
        </section>
        <section className="panel"><h2>Publish news</h2><form className="stack-form" onSubmit={saveNews}>
          <label>Headline<input required value={newsForm.title} onChange={e=>setNewsForm({...newsForm,title:e.target.value})}/></label>
          <label>Image URL<input value={newsForm.image_url} onChange={e=>setNewsForm({...newsForm,image_url:e.target.value})}/></label>
          <label>Excerpt<textarea value={newsForm.excerpt} onChange={e=>setNewsForm({...newsForm,excerpt:e.target.value})}/></label>
          <label>Source URL<input value={newsForm.source_url} onChange={e=>setNewsForm({...newsForm,source_url:e.target.value})}/></label>
          <button className="primary-btn" type="submit">Publish article</button>
        </form></section>
      </div>
      <section className="panel"><h2>Add episode to catalogue title</h2><p className="muted">Choose an existing local catalogue ID from the list below. Only use video URLs you are authorized to distribute.</p><form className="stack-form" onSubmit={async e=>{e.preventDefault();try{const payload={...episodeForm,anime_id:Number(episodeForm.anime_id),episode_number:Number(episodeForm.episode_number),duration_seconds:Number(episodeForm.duration_seconds)};await api(`/admin/anime/${payload.anime_id}/episodes`,{method:'POST',body:JSON.stringify(payload)});setEpisodeForm({...episodeForm,episode_number:Number(episodeForm.episode_number)+1,title:'',video_url:''});setNotice('Episode added.');}catch(err){setNotice(err.message)}}}><label>Anime catalogue ID<input required type="number" min="1" value={episodeForm.anime_id} onChange={e=>setEpisodeForm({...episodeForm,anime_id:e.target.value})}/></label><label>Episode number<input required type="number" min="1" value={episodeForm.episode_number} onChange={e=>setEpisodeForm({...episodeForm,episode_number:e.target.value})}/></label><label>Episode title<input value={episodeForm.title} onChange={e=>setEpisodeForm({...episodeForm,title:e.target.value})}/></label><label>Authorized HTTPS video URL<input required value={episodeForm.video_url} onChange={e=>setEpisodeForm({...episodeForm,video_url:e.target.value})} placeholder="https://your-cdn.example/episode-1.mp4"/></label><div className="form-row"><label>Format<select value={episodeForm.video_type} onChange={e=>setEpisodeForm({...episodeForm,video_type:e.target.value})}><option value="mp4">MP4</option><option value="hls">HLS</option></select></label><label>Duration (seconds)<input type="number" min="0" value={episodeForm.duration_seconds} onChange={e=>setEpisodeForm({...episodeForm,duration_seconds:e.target.value})}/></label></div><button className="primary-btn" type="submit">Add episode</button></form></section>
      <section className="panel table-panel"><h2>Catalogue management</h2><div className="admin-table">{adminAnime.map(a=><div className="table-row" key={a.id}><img src={fallback(a)} alt=""/><div><strong>{a.title}</strong><small>{a.genres.join(' · ')}</small></div><span className="status-pill">{a.is_published?'Published':'Draft'}</span><button className="danger-btn" onClick={()=>deleteAnime(a.id)}>Delete</button></div>)}</div></section>
      <section className="panel table-panel"><h2>Community accounts</h2><div className="admin-table">{adminUsers.map(u=><div className="table-row" key={u.id}><span className="avatar">{u.username[0].toUpperCase()}</span><div><strong>{u.username}</strong><small>{u.email} · {u.role}</small></div><span className="status-pill">{u.is_active?'Active':'Disabled'}</span><button className="outline-btn" onClick={()=>setUserStatus(u,!u.is_active)}>{u.is_active?'Disable':'Enable'}</button></div>)}</div></section>
      <section className="panel table-panel"><h2>News posts</h2>{adminNews.map(n=><div className="table-row" key={n.id}><div><strong>{n.title}</strong><small>{n.excerpt}</small></div><button className="danger-btn" onClick={()=>deleteNews(n.id)}>Delete</button></div>)}</section>
    </main> : <>
      {tab==='home'&&<section className="hero">
        <div className="hero-backdrop"></div><div className="hero-content"><div className="eyebrow"><Flame size={14}/> THE ANIME UNIVERSE, REIMAGINED</div><h1>FIND YOUR<br/><span>MAIN CHARACTER</span><br/>MOMENT.</h1><p>Discover your next obsession. Explore iconic worlds, uncover hidden gems, and build a watchlist that is unmistakably yours.</p><div className="hero-actions"><button className="primary-btn" onClick={()=>document.getElementById('catalogue')?.scrollIntoView({behavior:'smooth'})}><Play size={17} fill="currentColor"/> Explore anime</button><button className="outline-btn" onClick={()=>setTab('watchlist')}><Heart size={16}/> My watchlist</button></div><div className="hero-metrics"><div><strong>DISCOVER</strong><small>Worlds beyond worlds</small></div><div><strong>COLLECT</strong><small>Your next favourites</small></div><div><strong>CONNECT</strong><small>Anime community</small></div></div></div>
        <div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="hero-glyph">A<span>+</span></div><div className="hero-vertical">BEYOND THE FRAME</div><div className="hero-sticker">NEW<br/>WORLDS<br/><b>AWAIT</b></div></div>
      </section>}
      <main className="page">
        {tab==='home'&&<div className="feature-strip"><div><span className="feature-icon"><Sparkles size={20}/></span><div><strong>Discover more</strong><small>Explore anime from metadata sources</small></div></div><div><span className="feature-icon"><Heart size={20}/></span><div><strong>Make it yours</strong><small>Keep your favourites close</small></div></div><div><span className="feature-icon"><ShieldCheck size={20}/></span><div><strong>Community first</strong><small>Your profile, your watchlist</small></div></div></div>}
        {(tab==='home'||tab==='search')&&<section id="catalogue" className="catalogue-section">
          <div className="section-heading"><div><span className="eyebrow">{tab==='search'?'SEARCH RESULTS':'CURATED FOR YOUR NEXT BINGE'}</span><h2>{tab==='search'?`Results for “${query}”`:'Trending across the anime universe'}</h2><p>{tab==='search'?'Titles from the local catalogue or public anime metadata.':'Find a new favourite, revisit a classic, or explore something unexpected.'}</p></div><button className="text-btn" onClick={()=>{setQuery('');setTab('home');loadHome()}}>View all <ChevronRight size={16}/></button></div>
          {busy?<div className="loading"><LoaderCircle className="spin"/> Finding your next anime...</div>:displayed.length?<div className="anime-grid">{displayed.map((a,i)=><AnimeCard key={`${a.id||a.external_mal_id||a.title}-${i}`} anime={a} index={i} onOpen={openDetails} onSave={toggleWatchlist} saved={watchlist.some(w=>w.id===a.id)}/>)}</div>:<div className="empty"><Film size={28}/><h3>No titles found yet</h3><p>Try another search, or check back when the metadata service is available.</p><button className="outline-btn" onClick={loadHome}>Reload catalogue</button></div>}
        </section>}
        {tab==='watchlist'&&<section className="catalogue-section"><div className="section-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h2>My watchlist</h2><p>Keep the stories you want to return to in one place.</p></div></div>{!user?<div className="empty"><Heart size={30}/><h3>Your list is waiting</h3><p>Sign in to save anime across sessions.</p><button className="primary-btn" onClick={()=>setAuthMode('login')}>Sign in</button></div>:watchlist.length?<div className="anime-grid">{watchlist.map((a,i)=><AnimeCard key={a.id} anime={a} index={i} onOpen={openDetails} onSave={toggleWatchlist} saved/>)}</div>:<div className="empty"><Heart size={30}/><h3>No saved titles yet</h3><p>Explore the catalogue and press the heart on a title you like.</p><button className="outline-btn" onClick={()=>setTab('home')}>Discover anime</button></div>}</section>}
        {tab==='continue'&&<section className="catalogue-section"><div className="section-heading"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Continue watching</h2><p>Playback progress is saved when a catalogue video is available.</p></div></div>{!user?<div className="empty"><Clock3 size={30}/><h3>Sign in to sync progress</h3><button className="primary-btn" onClick={()=>setAuthMode('login')}>Sign in</button></div>:progress.length?<div className="anime-grid">{progress.map((p,i)=><AnimeCard key={p.anime_id} anime={p.anime} index={i} onOpen={openDetails} progress={p}/>)}</div>:<div className="empty"><Clock3 size={30}/><h3>Nothing in progress</h3><p>Start a licensed video from a catalogue title to see it here.</p></div>}</section>}
        {tab==='news'&&<section className="catalogue-section"><div className="section-heading"><div><span className="eyebrow">THE LATEST FROM THE COMMUNITY</span><h2>Anime news & stories</h2><p>Editorial updates published by Animepride administrators.</p></div></div>{news.length?<div className="news-grid">{news.map(n=><article className="news-card" key={n.id}>{n.image_url&&<img src={n.image_url} alt="" loading="lazy"/>}<div><span className="eyebrow">ANIMEPRIDE EDITORIAL</span><h3>{n.title}</h3><p>{n.excerpt}</p>{n.source_url&&<a href={n.source_url} target="_blank" rel="noreferrer">Read source <ChevronRight size={15}/></a>}</div></article>)}</div>:<div className="empty"><Newspaper size={30}/><h3>No news published yet</h3><p>Editorial posts will appear here when an admin publishes them.</p></div>}</section>}
        <footer className="footer"><div className="brand mini"><span className="brand-mark">A<span>+</span></span><span>ANIME<span className="red">PRIDE</span><small>YOUR NEXT OBSESSION</small></span></div><p>Discover responsibly. Support the creators behind the stories you love.</p><span>© {new Date().getFullYear()} Animepride</span></footer>
      </main>
    </>}
    {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="detail-modal" onClick={e=>e.stopPropagation()}><button className="modal-close icon-btn" onClick={()=>setSelected(null)}><X/></button><div className="detail-cover" style={{backgroundImage:`linear-gradient(90deg,#101017 0%,rgba(16,16,23,.55) 65%,rgba(16,16,23,.1)),url("${fallback(selected)}")`}}></div><div className="detail-content"><span className="eyebrow">ANIME DETAILS</span><h2>{selected.title}</h2><div className="meta-line"><span><Star size={14}/> {selected.score?selected.score:'Discover'}</span><span>{selected.year||'Year unavailable'}</span><span>{selected.status||'Metadata'}</span></div><p>{selected.synopsis||'Synopsis is not available for this title yet.'}</p><div className="genre-list">{(selected.genres||[]).map(g=><span key={g}>{g}</span>)}</div><div className="hero-actions"><button className="primary-btn" onClick={()=>toggleWatchlist(selected)}>{watchlist.some(w=>w.id===selected.id)?<Check size={16}/>:<Plus size={16}/>} {watchlist.some(w=>w.id===selected.id)?'In your list':'Add to watchlist'}</button>{selected.video_url&&<button className="outline-btn" onClick={()=>document.getElementById('anime-video')?.scrollIntoView({behavior:'smooth'})}><Play size={16}/> Play video</button>}</div>
      {(activeEpisode?.video_url||selected.video_url)&&<div className="video-box">{episodes.length>0&&<div className="episode-list"><h3>Episodes</h3>{episodes.map(ep=><button key={ep.id} className={activeEpisode?.id===ep.id?'episode-row active':'episode-row'} onClick={()=>setActiveEpisode(ep)}><span>EP {ep.episode_number}</span><strong>{ep.title||`Episode ${ep.episode_number}`}</strong><Play size={14}/></button>)}</div>}<video id="anime-video" controls playsInline preload="metadata" src={activeEpisode?.video_url||selected.video_url} onTimeUpdate={async e=>{if(user&&selected.id&&Math.floor(e.currentTarget.currentTime)%15===0){try{await api(`/me/progress/${selected.id}`,{method:'PUT',body:JSON.stringify({position_seconds:Math.floor(e.currentTarget.currentTime),duration_seconds:Math.floor(e.currentTarget.duration||0)})})}catch{}}}}/><small>Only play video sources you are authorized to access and distribute.</small></div>}
      {selected.id&&<section className="review-section"><h3>Community reviews</h3>{user?<form className="review-form" onSubmit={submitReview}><label>Rating (1–10)<select value={reviewForm.rating} onChange={e=>setReviewForm({...reviewForm,rating:Number(e.target.value)})}>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><textarea placeholder="Share a respectful review..." value={reviewForm.body} onChange={e=>setReviewForm({...reviewForm,body:e.target.value})}/><button className="primary-btn" type="submit">Save review</button></form>:<p className="muted">Sign in to write a review.</p>}{reviews.map(r=><div className="review-item" key={r.id}><strong>{r.username} <span>· {r.rating}/10</span></strong><p>{r.body}</p></div>)}</section>}
      </div></div></div>}
    {authMode&&<div className="modal-backdrop" onClick={()=>setAuthMode('')}><div className="auth-modal" onClick={e=>e.stopPropagation()}><button className="modal-close icon-btn" onClick={()=>setAuthMode('')}><X/></button><div className="brand"><span className="brand-mark">A<span>+</span></span><span>ANIME<span className="red">PRIDE</span><small>YOUR NEXT OBSESSION</small></span></div><h2>{authMode==='register'?'Join the universe':'Welcome back'}</h2><p>{authMode==='register'?'Create your account to save favourites and join the conversation.':'Sign in to continue your anime journey.'}</p><form className="stack-form" onSubmit={authSubmit}>{authMode==='register'&&<label>Username<input required minLength="3" maxLength="40" value={authForm.username} onChange={e=>setAuthForm({...authForm,username:e.target.value})}/></label>}<label>Email<input required type="email" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})}/></label><label>Password<input required type="password" minLength={authMode==='register'?10:1} value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})}/>{authMode==='register'&&<small>Use at least 10 characters.</small>}</label><button className="primary-btn" type="submit">{authMode==='register'?'Create account':'Sign in'}</button></form><p className="switch-auth">{authMode==='register'?'Already have an account?':'New to Animepride?'} <button onClick={()=>setAuthMode(authMode==='register'?'login':'register')}>{authMode==='register'?'Sign in':'Create account'}</button></p><small className="muted">Password reset and email verification require an email provider integration before public launch.</small></div></div>}
  </div>
}
function AnimeCard({anime,index,onOpen,onSave,saved,progress}) {
  return <article className="anime-card">
    <button className="poster-btn" onClick={()=>onOpen(anime)} aria-label={`Open ${anime.title}`}>
      <img src={fallback(anime,index)} alt={`${anime.title} poster`} loading="lazy" onError={e=>{e.currentTarget.src=`https://placehold.co/600x850/15151e/f04452?text=${encodeURIComponent(anime.title||'Anime')}`}}/>
      <span className="poster-overlay"><span className="play-circle"><Play fill="currentColor" size={19}/></span><span>VIEW DETAILS</span></span>
      <span className="poster-badge">{anime.status||'FEATURED'}</span>
      {progress&&<span className="progress-bar"><i style={{width:`${Math.min(100,Math.round((progress.position_seconds/Math.max(1,progress.duration_seconds))*100))}%`}}/></span>}
    </button>
    <div className="card-info"><div><h3>{anime.title}</h3><p>{(anime.genres||[]).slice(0,2).join(' · ')||'Anime discovery'}</p></div><button className={saved?'save-btn saved':'save-btn'} onClick={()=>onSave?.(anime)} aria-label="Toggle watchlist">{saved?<Check size={17}/>:<Plus size={17}/>}</button></div>
    <div className="card-bottom"><span>{anime.year||'Explore'}</span><span className="card-tag"><Star size={12}/> {anime.score||'ANIME'}</span></div>
  </article>
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
