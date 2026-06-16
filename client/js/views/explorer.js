/**
 * Explorer view (Discover by Tags).
 *
 * Umożliwia iteracyjne wybieranie tagów (rząd po rzędzie), pobiera
 * sugestie powiązanych tagów i filtruje utwory po wybranych tagach oraz roku.
 */
import * as api from '../api.js';

const TAGS_PER_ROW = 6;

let state = {
	selectedTags: [],
	year_min: 1950,
	year_max: 2022,
	tagOrigins: {},
};

/**
 * Renderuje widok eksploratora tagów i inicjalizuje pierwszy (popular) rząd.
 */
export async function renderExplorer(){
	const intro = document.getElementById('intro-text');
	const top = document.getElementById('content-top');
	const middle = document.getElementById('content-middle');
	const list = document.getElementById('content-list');

	// Reset selected tags and origins when the Explorer view is (re)rendered
	state.selectedTags = [];
	state.tagOrigins = {};

	intro.innerHTML = `
		<h2>What's the vibe?</h2>
		<p class="muted">Mix and match tags to discover the perfect set of songs for your mood.</p>
	`;

		top.innerHTML = `
			<div class="tags-stack" id="tags-stack">
				<div class="tags-row" id="popular-tags" data-row="0">Loading tags…</div>
			</div>
		`;

	middle.innerHTML = `
		<div class="year-range">
			<div class="range-controls">
				<div class="number-control year-input" data-target="min">
					<button class="nav-btn small dec" data-target="min">-</button>
					<input type="number" id="year-min" class="value" min="1900" max="2022" value="${state.year_min}" />
					<button class="nav-btn small inc" data-target="min">+</button>
				</div>
				<div class="separator">—</div>
				<div class="number-control year-input" data-target="max">
					<button class="nav-btn small dec" data-target="max">-</button>
					<input type="number" id="year-max" class="value" min="1900" max="2022" value="${state.year_max}" />
					<button class="nav-btn small inc" data-target="max">+</button>
				</div>
				<button id="reset-tags" class="tag-pill">Reset</button>
			</div>
		</div>
	`;

	list.innerHTML = `<div class="results-placeholder">Select tags to see songs...</div>`;

	attachExplorerHandlers();
	loadPopularTags();
}

/**
 * Pobiera najpopularniejsze tagi i tworzy pierwszy rząd przycisków.
 */
async function loadPopularTags(){
	const tags = await api.getPopularTags();
	const stack = document.getElementById('tags-stack');
	stack.innerHTML = '';
	if(!tags || !tags.length){
		const row = document.createElement('div');
		row.className = 'tags-row';
		row.textContent = 'No tags';
		stack.appendChild(row);
		return;
	}
	// show top N popular tags as the first row
	const topTags = tags.slice(0, TAGS_PER_ROW);
	createTagRow(topTags, 0);
}

/**
 * Obsługuje zaznaczanie/odznaczanie taga.
 * Zapisuje informację o `tagOrigins` aby tylko instancja taga w źródłowym rzędzie była podświetlona.
 */
async function toggleTag(tag, btn){
	const idx = state.selectedTags.indexOf(tag);
	const row = btn.closest('.tags-row');
	const rowIndex = row && row.dataset && row.dataset.row ? parseInt(row.dataset.row,10) : 0;
	if(idx === -1){
		state.selectedTags.push(tag);
		state.tagOrigins[tag] = rowIndex;
	}else{
		state.selectedTags.splice(idx,1);
		delete state.tagOrigins[tag];
	}
	// fetch next suggestions based on the full selected set
	if(state.selectedTags.length > 0){
		updateRelatedTags();
	}
	fetchTracksForTags();
	highlightSelectedButtons();
}

/**
 * Pobiera powiązane tagi dla aktualnego zestawu `state.selectedTags` i tworzy nowy rząd sugestii.
 */
async function updateRelatedTags(){
	if(state.selectedTags.length === 0) return;
	const related = await api.getRelatedTags(state.selectedTags);
	if(!related || !related.length){
		// show an empty suggestions row
		createTagRow([], document.getElementById('tags-stack').children.length);
		return;
	}
	// API returns objects with related_tag and frequency; map to uniform shape
	const suggestions = related.map(r => {
		if(typeof r === 'string') return { tag_name: r, popularity: 0 };
		return { tag_name: r.related_tag || r.tag || r.name, popularity: r.frequency || r.popularity || 0 };
	}).filter(t => !state.selectedTags.includes(t.tag_name));
	const next = suggestions.slice(0, TAGS_PER_ROW);
	createTagRow(next, document.getElementById('tags-stack').children.length);
}

/**
 * Tworzy nowy rząd przycisków z listą tagów.
 * @param {Array} items - elementy tagów (obiekty z tag_name/popularity)
 * @param {number} rowIndex - indeks rzędu (0..n)
 */
function createTagRow(items, rowIndex){
	const stack = document.getElementById('tags-stack');
	const row = document.createElement('div');
	row.className = 'tags-row';
	row.dataset.row = String(rowIndex);
	if(!items || items.length === 0){
		row.classList.add('no-suggestions');
		row.textContent = 'No suggestions';
		stack.appendChild(row);
		// mark previous rows inactive
		Array.from(stack.children).forEach(r=>{ if(r !== row) r.classList.add('inactive-row'); });
		return row;
	}
	items.forEach(it=>{
		const tagName = it.tag_name || it.related_tag || String(it);
		const btn = document.createElement('button');
		btn.className = 'tag-pill';
		btn.dataset.tag = tagName;
		btn.textContent = tagName;
		const count = document.createElement('span');
		count.className = 'count';
		count.textContent = it.popularity || '';
		btn.appendChild(count);
		btn.addEventListener('click', ()=> toggleTag(tagName, btn));
		row.appendChild(btn);
	});
	stack.appendChild(row);
	// mark previous rows inactive
	Array.from(stack.children).forEach(r=>{ if(r !== row) r.classList.add('inactive-row'); else r.classList.remove('inactive-row'); });
	highlightSelectedButtons();
	return row;
}

/**
 * Podświetla tylko te przyciski `.tag-pill`, które odpowiadają zapamiętanym origins.
 */
function highlightSelectedButtons(){
	const all = document.querySelectorAll('.tag-pill');
	all.forEach(b=>{
		const tag = b.dataset.tag;
		const row = b.closest('.tags-row');
		const rowIndex = row && row.dataset && row.dataset.row ? parseInt(row.dataset.row,10) : 0;
		if(state.tagOrigins[tag] === rowIndex) b.classList.add('selected');
		else b.classList.remove('selected');
	});
}

/**
 * Resetuje wybór tagów (przywraca tylko pierwszy rząd popularnych tagów).
 */
function resetExplorer(){
	state.selectedTags = [];
	state.tagOrigins = {};
	const stack = document.getElementById('tags-stack');
	if(stack) stack.innerHTML = '';
	document.getElementById('content-list').innerHTML = `<div class="results-placeholder">Select tags to see songs...</div>`;
	loadPopularTags();
	// keep year range intact; only reset tag selection per spec
}

/**
 * Pobiera utwory dopasowane do `state.selectedTags` i zakresu lat i renderuje wyniki.
 */
async function fetchTracksForTags(){
	const list = document.getElementById('content-list');
	if(state.selectedTags.length === 0){ list.innerHTML = `<div class="results-placeholder">Select tags to see songs...</div>`; return; }
	const tracks = await api.getTracksByTags(state.selectedTags, state.year_min, state.year_max, 100);
	if(!tracks || tracks.length === 0){ list.innerHTML = `<div class="results-placeholder">No tracks found</div>`; return; }
	list.innerHTML = `<div class="results-table">${tracks.map(t=>`<div class="row track-row"><div class="title"><strong>${escapeHtml(t.title)}</strong><div class="tags">${(t.tags||[]).map(tt=>`<span class="tag">${escapeHtml(tt)}</span>`).join('')}</div></div><div class="artist">${escapeHtml(t.artist)}</div><div class="year">${escapeHtml(t.year)}</div><div class="match">-</div><div class="actions"><a class="spotify-link" href="https://open.spotify.com/track/${encodeURIComponent(t.spotify_id)}" target="_blank">Open</a></div></div>`).join('')}</div>`;
}

function attachExplorerHandlers(){
	const yMin = document.getElementById('year-min');
	const yMax = document.getElementById('year-max');
		const resetBtn = document.getElementById('reset-tags');

	function sync(){
		let a = parseInt(yMin.value,10) || state.year_min;
		let b = parseInt(yMax.value,10) || state.year_max;
		if(a > b){ const tmp = a; a = b; b = tmp; }
		state.year_min = a; state.year_max = b;
		fetchTracksForTags();
	}

	// +/- buttons for number inputs
	document.querySelectorAll('.range-controls .nav-btn.small').forEach(btn=>{
		const target = btn.dataset.target === 'max' ? 'year-max' : 'year-min';
		btn.addEventListener('click', ()=>{
			const el = document.getElementById(target);
			let v = parseInt(el.value,10) || 0;
			if(btn.classList.contains('inc')) v++; else v = v-1;
			const min = parseInt(el.min || '0',10);
			const max = parseInt(el.max || '9999',10);
			el.value = Math.max(min, Math.min(max, v));
			sync();
		});
	});

	yMin.addEventListener('input', sync);
	yMax.addEventListener('input', sync);

		if(resetBtn) resetBtn.addEventListener('click', resetExplorer);
}

function escapeHtml(s){ if(!s && s!==0) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

