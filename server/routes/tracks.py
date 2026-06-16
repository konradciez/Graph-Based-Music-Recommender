"""Routes (endpoints) related to tracks and recommendations.

Ten moduł udostępnia trzy główne endpointy:
- GET /tracks/search?q=...&search_by=title|artist  — autocomplete / search
- GET /tracks/<spotify_id>                      — szczegóły pojedynczego utworu (seed)
- GET /tracks/<spotify_id>/recommendations      — rekomendacje oparte na tagach i filtrach

Parametry filtrowania rekomendacji:
- energy_tolerance (float, 0.0-1.0)
- year_tolerance (int)
- artist_match (bool, 'true' w URL)
"""

from flask import Blueprint, request, jsonify
from db import db

tracks_bp = Blueprint('tracks', __name__)

# 1. AUTOCOMPLETE DLA SEARCH BOX
@tracks_bp.route('/tracks/search', methods=['GET'])
def search_tracks():
    """Search endpoint used by frontend autocomplete.

    Query params:
        q (str): zapytanie — minimum 3 znaki
        search_by (str): 'title' (domyślnie) lub 'artist'

    Returns JSON list of objects: {spotify_id, title, artist}
    """
    # 1. Pobieramy parametr 'q' z adresu URL (np. ?q=mr.)
    query_string = request.args.get('q', '').strip()
    search_by = request.args.get('search_by', 'title').strip().lower()

    # Zwracamy pustą listę, jeśli wpisano mniej niż 3 znaki (oszczędność bazy)
    if len(query_string) < 3:
        return jsonify([]), 200

    if search_by == 'title':
        cypher_query = """
        MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist)
        WHERE toLower(t.name) CONTAINS toLower($q)
        RETURN 
            t.spotify_id AS spotify_id,
            t.name AS title,
            coalesce(a.artist, a.name) AS artist
        ORDER BY t.name ASC
        LIMIT 10
        """
    elif search_by == 'artist':
        cypher_query = """
        MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist)
        WHERE toLower(coalesce(a.artist, a.name)) CONTAINS toLower($q)
        RETURN 
            t.spotify_id AS spotify_id,
            t.name AS title,
            coalesce(a.artist, a.name) AS artist
        ORDER BY t.name ASC
        LIMIT 10
        """
    else:
        return jsonify({"error": "Nieobsługiwany parametr search_by"}), 400

    try:
        # 2. Wykonujemy zapytanie, przekazując parametr bezpieczeństwa $q
        records = db.execute_read(cypher_query, {"q": query_string})
        
        # Flask automatycznie konwertuje listę słowników z Neo4j na czysty JSON
        return jsonify(records), 200
        
    except Exception as e:
        print(f"Błąd bazy danych: {e}")
        return jsonify({"error": "Wystąpił błąd podczas wyszukiwania"}), 500
    

# 2. ZWRÓCENIE DANYCH WYBRANEJ PIOSENKI (SEED)
@tracks_bp.route('/tracks/<spotify_id>', methods=['GET'])
def get_track_details(spotify_id):
    """Zwraca szczegóły pojedynczego utworu (seed) wraz z tagami.

    Path param:
        spotify_id (str): identyfikator utworu w Spotify

    Zwracany JSON: { title, artist, year, tags, spotify_id }
    """
    cypher_query = """
    MATCH (seed:Track {spotify_id: $spotify_id})
    MATCH (seed)-[:PERFORMED_BY]->(a:Artist)
    // Używamy OPTIONAL MATCH, by nie wyrzuciło błędu, jeśli piosenka cudem nie ma tagów
    OPTIONAL MATCH (seed)-[:HAS_TAG]->(t:Tag)
    RETURN 
        seed.name AS title, 
        coalesce(a.artist, a.name) AS artist, 
        seed.year AS year, 
        collect(coalesce(t.tag, t.name)) AS tags, 
        seed.spotify_id AS spotify_id
    """
    try:
        records = db.execute_read(cypher_query, {"spotify_id": spotify_id})
        if not records:
            return jsonify({"error": "Nie znaleziono utworu o podanym ID"}), 404
            
        # Zwracamy pierwszy (i jedyny) element, by frontend dostał od razu obiekt, a nie listę
        return jsonify(records[0]), 200
    except Exception as e:
        print(f"Błąd bazy danych: {e}")
        return jsonify({"error": "Wystąpił błąd podczas pobierania danych"}), 500
    
# 3. GŁÓWNY SILNIK REKOMENDACJI (DYNAMICZNY)
@tracks_bp.route('/tracks/<spotify_id>/recommendations', methods=['GET'])
def get_recommendations(spotify_id):
    """Generuje rekomendacje na podstawie taga/seeda z opcjonalnymi filtrami.

    Query params:
        energy_tolerance (float): tolerancja energii, spodziewane 0.0-1.0
        year_tolerance (int): tolerancja w latach
        artist_match (bool): 'true' aby ograniczyć do tego samego artysty
        limit (int): maksymalna liczba wyników

    Zwraca listę rekomendacji z informacją o liczbie współdzielonych tagów.
    """
    # Pobieranie i parsowanie parametrów URL (Filtry)
    energy_tolerance = request.args.get('energy_tolerance', type=float)
    year_tolerance = request.args.get('year_tolerance', type=int)
    # Zwraca True jeśli przekazano w URL 'artist_match=true'
    artist_match = request.args.get('artist_match', default='false').lower() == 'true'
    limit = request.args.get('limit', default=10, type=int)

    # Parametry bezpiecznie przekazywane do bazy Neo4j
    params = {
        "spotify_id": spotify_id,
        "limit": limit
    }

    # KROK A: Dynamiczne budowanie struktury grafu (MATCH)
    if artist_match:
        # Wersja wymuszająca tego samego artystę (zamknięcie pętli przez artist_node)
        match_clause = """
        MATCH (seed:Track {spotify_id: $spotify_id})-[:PERFORMED_BY]->(artist_node:Artist)
        MATCH (seed)-[:HAS_TAG]->(seedTag:Tag)
        WITH seed, artist_node, count(seedTag) AS total_seed_tags
        MATCH (seed)-[:HAS_TAG]->(sharedTag:Tag)<-[:HAS_TAG]-(recom:Track)
        MATCH (recom)-[:PERFORMED_BY]->(artist_node)
        """
    else:
        # Standardowa wersja (dowolny artysta)
        match_clause = """
        MATCH (seed:Track {spotify_id: $spotify_id})-[:HAS_TAG]->(seedTag:Tag)
        WITH seed, count(seedTag) AS total_seed_tags
        MATCH (seed)-[:HAS_TAG]->(sharedTag:Tag)<-[:HAS_TAG]-(recom:Track)
        MATCH (recom)-[:PERFORMED_BY]->(artist_node:Artist)
        """

    # KROK B: Dynamiczne budowanie filtrów (WHERE)
    where_clauses = ["seed.spotify_id <> recom.spotify_id"]

    if energy_tolerance is not None:
        where_clauses.extend([
            "recom.energy >= seed.energy - $energy_tol",
            "recom.energy <= seed.energy + $energy_tol",
            "recom.danceability >= seed.danceability - $energy_tol",
            "recom.danceability <= seed.danceability + $energy_tol"
        ])
        params["energy_tol"] = energy_tolerance

    if year_tolerance is not None:
        where_clauses.extend([
            "recom.year >= seed.year - $year_tol",
            "recom.year <= seed.year + $year_tol"
        ])
        params["year_tol"] = year_tolerance

    # Sklejanie warunków WHERE (łączymy je za pomocą AND)
    where_clause_str = "WHERE " + "\n  AND ".join(where_clauses)

    # KROK C: Złożenie całości w jedno zapytanie
    cypher_query = f"""
    {match_clause}
    {where_clause_str}
    RETURN 
        recom.name AS title, 
        coalesce(artist_node.artist, artist_node.name) AS artist,
        recom.year AS year,
        total_seed_tags AS seed_tags_count,
        count(sharedTag) AS shared_tags_count,
        collect(coalesce(sharedTag.tag, sharedTag.name)) AS shared_tags,
        recom.spotify_id AS spotify_id
    ORDER BY shared_tags_count DESC
    LIMIT $limit
    """

    try:
        # Wykonujemy złożone zapytanie
        records = db.execute_read(cypher_query, params)
        return jsonify(records), 200
    except Exception as e:
        print(f"Błąd bazy danych (Rekomendacje): {e}")
        return jsonify({"error": "Wystąpił błąd podczas generowania rekomendacji"}), 500

