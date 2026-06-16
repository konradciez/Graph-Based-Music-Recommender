/**
 * App entry: simple client-side router for two views.
 *
 * Rejestruje nasłuch na przyciskach widoku i renderuje domyślnie Recommender.
 */
import { renderRecommender } from './views/recommender.js';
import { renderExplorer } from './views/explorer.js';

function setActiveButton(activeBtn) {
	document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
	activeBtn.classList.add('active');
}

function init() {
	const navRecommender = document.getElementById('nav-recommender');
	const navExplorer = document.getElementById('nav-explorer');

	navRecommender.addEventListener('click', () => {
		setActiveButton(navRecommender);
		renderRecommender();
	});

	navExplorer.addEventListener('click', () => {
		setActiveButton(navExplorer);
		renderExplorer();
	});

	// initial view
	renderRecommender();
}

window.addEventListener('DOMContentLoaded', init);
