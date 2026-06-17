/**
 * Recommender view.
 *
 * Renderuje UI do wybierania seed-track i wyświetlania rekomendacji.
 * Eksportuje `renderRecommender()` które wstawia markup do kontenerów
 * zdefiniowanych w `index.html` oraz podłącza event-handlery.
 */
import * as api from '../api.js';

let state = {
	search_by: 'title',
	seed: null,
};

/**
 * Renderuje widok Recommender i podłącza handlery.
 */
export async function renderRecommender(){
	const intro = document.getElementById('intro-text');
	const top = document.getElementById('content-top');
	const middle = document.getElementById('content-middle');
	const list = document.getElementById('content-list');

	intro.innerHTML = `
		<h2>Find your next favorite song.</h2>
		<p class="muted">Start with a track you love and let us find the perfect match.</p>
	`;

	top.innerHTML = `
		<div class="search-row">
			<div class="search-switch">
				<button class="nav-btn switch-btn ${state.search_by === 'title' ? 'active' : ''}" data-by="title">Title</button>
				<button class="nav-btn switch-btn ${state.search_by === 'artist' ? 'active' : ''}" data-by="artist">Artist</button>
			</div>
			<div class="search-box">
				<input id="search-input" placeholder="Search title or artist" autocomplete="off" />
				<button id="search-go" class="go-btn">→</button>
				<div id="suggestions" class="suggestions"></div>
			</div>
		</div>
	`;

	middle.innerHTML = `
		<div class="filters">
			<div class="filter-item">
				<label><input id="energy-match" type="checkbox" /> Energy Match</label>
				<div class="number-control" data-role="energy" data-min="0" data-max="100"><button class="nav-btn small dec">-</button><span class="suffix">±</span><span class="value">10</span><span class="suffix">%</span><button class="nav-btn small inc">+</button></div>
			</div>
			<div class="filter-item">
				<label><input id="year-match" type="checkbox" /> Year Match</label>
				<div class="number-control" data-role="year" data-min="0"><button class="nav-btn small dec">-</button><span class="suffix">±</span><span class="value">3</span><button class="nav-btn small inc">+</button></div>
			</div>
			<div class="filter-item artist-only">
				<label><input id="only-artist" type="checkbox" /> Only THIS Artist</label>
			</div>
		</div>
	`;

	list.innerHTML = `<div class="results-placeholder">Search to see results...</div>`;

	attachRecommenderHandlers();
}

function debounce(fn, wait=250){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait);} }

/**
 * Przywiązuje event handlery do elementów w widoku Recommender.
 * Obsługuje: search autocomplete, przyciski +/- przy filtrach oraz przełącznik Title/Artist.
 */
function attachRecommenderHandlers(){
	const input = document.getElementById('search-input');
	const suggestions = document.getElementById('suggestions');
	const go = document.getElementById('search-go');

	document.querySelectorAll('.switch-btn').forEach(b=>{
		b.addEventListener('click', ()=> {
			document.querySelectorAll('.switch-btn').forEach(x=>x.classList.remove('active'));
			b.classList.add('active');
			state.search_by = b.dataset.by;
		});
	});

	input.addEventListener('input', debounce(async ()=>{
		const q = input.value.trim();
		if(q.length < 3){ suggestions.innerHTML = ''; return; }
		const items = await api.searchTracks(q, state.search_by);
		suggestions.innerHTML = items.map(it=>`<div class="suggestion" data-id="${it.spotify_id}">${escapeHtml(it.title)} <span class="muted">${escapeHtml(it.artist)}</span></div>`).join('');
		suggestions.querySelectorAll('.suggestion').forEach(s=>{
			s.addEventListener('click', ()=> selectSuggestion(s.dataset.id));
		});
	}, 200));

	go.addEventListener('click', ()=>{
		const q = input.value.trim();
		if(q.length < 1) return;
		api.searchTracks(q, state.search_by).then(items=>{
			if(items && items.length) selectSuggestion(items[0].spotify_id);
		});
	});

	document.querySelectorAll('.number-control').forEach(ctrl=>{
		const valSpan = ctrl.querySelector('.value');
		const min = parseInt(ctrl.dataset.min || '0', 10);
		const max = ctrl.dataset.max ? parseInt(ctrl.dataset.max, 10) : Infinity;
		ctrl.querySelectorAll('.inc, .dec').forEach(btn=>{
			btn.addEventListener('click', ()=>{
				let v = parseInt(valSpan.textContent) || 0;
				if(btn.classList.contains('inc')) v++;
				else v = v-1;
				if(!Number.isFinite(max)) v = Math.max(min, v);
				else v = Math.max(min, Math.min(max, v));
				valSpan.textContent = v;
			});
		});
	});
}

/**
 * Wywoływane po wybraniu sugestii z listy.
 * Czyści pole wyszukiwania, pobiera dane seed-track i żąda rekomendacji.
 * @param {string} spotify_id
 */
async function selectSuggestion(spotify_id){
	document.getElementById('suggestions').innerHTML = '';
	const input = document.getElementById('search-input');
	if(input){ input.value = ''; if(typeof input.blur === 'function') input.blur(); }
	const seed = await api.getTrack(spotify_id);
	if(!seed) return;
	state.seed = seed;

	const energyChecked = document.getElementById('energy-match').checked;
	const yearChecked = document.getElementById('year-match').checked;
	const onlyArtist = document.getElementById('only-artist').checked;
	const vals = Array.from(document.querySelectorAll('.filter-item .number-control .value')).map(v=>parseInt(v.textContent)||0);
	const opts = {};
	if(energyChecked) opts.energy_tolerance = Math.max(0, Math.min(1, vals[0] / 100));
	if(yearChecked) opts.year_tolerance = vals[1];
	if(onlyArtist) opts.artist_match = true;

	const recs = await api.getRecommendations(spotify_id, opts);
	renderSeedAndResults(seed, recs || []);
}

/**
 * Renderuje seed (wybrany utwór) oraz listę rekomendacji poniżej.
 * @param {Object} seed
 * @param {Array} recs
 */
function renderSeedAndResults(seed, recs){
	const list = document.getElementById('content-list');
	const seedHtml = `
		<div class="results-table">
			<div class="row seed-row">
				<div class="col title"><strong>${escapeHtml(seed.title)}</strong><div class="tags">${(seed.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div></div>
				<div class="col artist">${escapeHtml(seed.artist)}</div>
				<div class="col year">${escapeHtml(seed.year)}</div>
				<div class="col match">-</div>
				<div class="col actions"><a class="spotify-link" href="https://open.spotify.com/track/${encodeURIComponent(seed.spotify_id)}" target="_blank">Open</a></div>
			</div>
		</div>
	`;

	const recsHtml = (recs||[]).map(r=>{
		const percent = (r.seed_tags_count && r.shared_tags_count) ? Math.round((r.shared_tags_count / r.seed_tags_count)*100) : '-';
		return `<div class="row rec-row">
			<div class="title"><strong>${escapeHtml(r.title)}</strong>
				<div class="tags">${(r.shared_tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
			</div>
			<div class="artist">${escapeHtml(r.artist)}</div>
			<div class="year">${escapeHtml(r.year)}</div>
			<div class="match">${percent}%</div>
			<div class="actions"><a class="spotify-link" href="https://open.spotify.com/track/${encodeURIComponent(r.spotify_id)}" target="_blank">Open</a></div>
		</div>`;
	}).join('');

	list.innerHTML = seedHtml + `<div class="results-table recommendations">${recsHtml}</div>`;
}

function escapeHtml(s){ if(!s && s!==0) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

