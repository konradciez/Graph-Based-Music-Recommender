/**
 * API client wrapper
 *
 * Małe API pomocnicze do wywołań endpointów backendu. Wszystkie funkcje
 * zwracają Promise z parsowanym JSON-em lub `null`/`[]` przy błędach.
 */
const API_BASE = window.__API_BASE__ || 'http://127.0.0.1:5000';

async function getJSON(url){
	try{
		const res = await fetch(url);
		if(!res.ok) return null;
		return await res.json();
	}catch(e){
		console.error('API fetch error', e);
		return null;
	}
}

/**
 * Search tracks by query.
 * @param {string} q - query string (min 3 chars)
 * @param {string} [search_by='title'] - 'title' or 'artist'
 * @returns {Promise<Array>} list of tracks: { spotify_id, title, artist }
 */
export async function searchTracks(q, search_by='title'){
	if(!q || q.length < 3) return [];
	const params = new URLSearchParams({ q, search_by });
	return await getJSON(`${API_BASE}/tracks/search?${params}`) || [];
}

/**
 * Get single track details by spotify_id.
 * @param {string} spotify_id
 * @returns {Promise<Object|null>} track object or null
 */
export async function getTrack(spotify_id){
	if(!spotify_id) return null;
	return await getJSON(`${API_BASE}/tracks/${encodeURIComponent(spotify_id)}`);
}

/**
 * Get recommendations for a seed track.
 * @param {string} spotify_id
 * @param {Object} opts - options: { energy_tolerance: float(0-1), year_tolerance: int, artist_match: bool, limit: int }
 * @returns {Promise<Array>} list of recommendation objects
 */
export async function getRecommendations(spotify_id, opts={}){
	if(!spotify_id) return [];
	const params = new URLSearchParams();
	if(opts.energy_tolerance != null) params.set('energy_tolerance', opts.energy_tolerance);
	if(opts.year_tolerance != null) params.set('year_tolerance', opts.year_tolerance);
	if(opts.artist_match) params.set('artist_match', 'true');
	if(opts.limit) params.set('limit', opts.limit);
	return await getJSON(`${API_BASE}/tracks/${encodeURIComponent(spotify_id)}/recommendations?${params}`) || [];
}

/**
 * Get popular tags used by explorer.
 * @returns {Promise<Array<{tag_name:string,popularity:number}>>}
 */
export async function getPopularTags(){
	return await getJSON(`${API_BASE}/tags/popular`) || [];
}

/**
 * Get related tags for a list of selected tags.
 * @param {Array<string>} tags
 * @returns {Promise<Array<{related_tag:string,frequency:number}>>}
 */
export async function getRelatedTags(tags){
	if(!tags || tags.length === 0) return [];
	const params = new URLSearchParams({ tags: tags.join(',') });
	return await getJSON(`${API_BASE}/tags/related?${params}`) || [];
}

/**
 * Get tracks that match all provided tags and optional year range.
 * @param {Array<string>} tags
 * @param {number|null} year_min
 * @param {number|null} year_max
 * @param {number} [limit=50]
 * @returns {Promise<Array>} list of track objects
 */
export async function getTracksByTags(tags, year_min, year_max, limit=50){
	if(!tags || tags.length === 0) return [];
	const params = new URLSearchParams({ tags: tags.join(',') });
	if(year_min != null) params.set('year_min', year_min);
	if(year_max != null) params.set('year_max', year_max);
	if(limit) params.set('limit', limit);
	return await getJSON(`${API_BASE}/tracks?${params}`) || [];
}

export default {
	searchTracks, getTrack, getRecommendations, getPopularTags, getRelatedTags, getTracksByTags
};
