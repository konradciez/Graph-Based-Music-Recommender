"""Endpoints dla eksploratora tagów i filtrowania utworów.

Udostępnia:
- GET /tags/popular  — listę najpopularniejszych tagów
- GET /tags/related  — listę tagów powiązanych z wybranym zestawem tagów
- GET /tracks        — filtrowanie utworów po tagach i roku (używane przez explorer)
"""

from flask import Blueprint, request, jsonify
from db import db


tags_bp = Blueprint('tags', __name__)

# 4. EKSPLORATOR TAGÓW - Inicjalizacja
@tags_bp.route('/tags/popular', methods=['GET'])
def get_popular_tags():
    """Zwraca listę najpopularniejszych tagów.

    Response: lista obiektów { tag_name, popularity }
    """
    cypher_query = """
    MATCH (t:Tag)<-[:HAS_TAG]-(:Track)
    RETURN 
        coalesce(t.tag, t.name) AS tag_name, 
        count(*) AS popularity
    ORDER BY popularity DESC
    LIMIT 20
    """
    try:
        records = db.execute_read(cypher_query)
        return jsonify(records), 200
    except Exception as e:
        print(f"Błąd bazy danych (Popularne Tagi): {e}")
        return jsonify({"error": "Wystąpił błąd podczas pobierania tagów"}), 500


# 5. EKSPLORATOR TAGÓW - Powiązane tagi
@tags_bp.route('/tags/related', methods=['GET'])
def get_related_tags():
    """Zwraca tagi powiązane z podanym zbiorem tagów.

    Query params:
        tags (str): przecinkowo oddzielona lista tagów (np. 'rock,indie')

    Response: lista obiektów { related_tag, frequency }
    """
    # Pobieramy tagi z URL (np. ?tags=rock,alternative) i zamieniamy na listę
    tags_param = request.args.get('tags', '')
    if not tags_param:
        return jsonify({"error": "Parametr 'tags' jest wymagany"}), 400
        
    selected_tags = [t.strip() for t in tags_param.split(',') if t.strip()]

    cypher_query = """
    MATCH (tr:Track)
    WHERE all(t IN $selected_tags WHERE exists {
        MATCH (tr)-[:HAS_TAG]->(tagNode:Tag)
        WHERE tagNode.tag = t OR tagNode.name = t
    })
    MATCH (tr)-[:HAS_TAG]->(relatedNode:Tag)
    WITH coalesce(relatedNode.tag, relatedNode.name) AS related_tag, $selected_tags AS selected_tags
    WHERE NOT related_tag IN selected_tags
    RETURN 
        related_tag, 
        count(*) AS frequency
    ORDER BY frequency DESC
    LIMIT 15
    """
    try:
        records = db.execute_read(cypher_query, {"selected_tags": selected_tags})
        return jsonify(records), 200
    except Exception as e:
        print(f"Błąd bazy danych (Powiązane Tagi): {e}")
        return jsonify({"error": "Wystąpił błąd podczas pobierania powiązanych tagów"}), 500



# 6. WYSZUKIWANIE PIOSENEK PO TAGACH I ROKU
@tags_bp.route('/tracks', methods=['GET'])
def filter_tracks():
    """Filtruje utwory po zadanych tagach oraz opcjonalnym zakresie lat.

    Query params:
        tags (str): wymagane, przecinkowo oddzielona lista tagów
        year_min (int): opcjonalnie - minimalny rok
        year_max (int): opcjonalnie - maksymalny rok
        limit (int): maksymalna liczba wyników

    Response: lista obiektów { title, artist, year, tags, spotify_id }
    """
    # Pobieranie i walidacja parametrów
    tags_param = request.args.get('tags', '')
    year_min = request.args.get('year_min', type=int)
    year_max = request.args.get('year_max', type=int)
    limit = request.args.get('limit', default=20, type=int)

    if not tags_param:
        return jsonify({"error": "Parametr 'tags' jest wymagany (np. ?tags=rock)"}), 400

    selected_tags = [t.strip() for t in tags_param.split(',') if t.strip()]
    
    # Inicjalizacja parametrów dla bazy Neo4j
    params = {
        "selected_tags": selected_tags,
        "limit": limit
    }

    # Dynamiczne budowanie warunków rocznikowych
    year_clauses = ""
    if year_min is not None:
        year_clauses += " AND tr.year >= $year_min"
        params["year_min"] = year_min
    if year_max is not None:
        year_clauses += " AND tr.year <= $year_max"
        params["year_max"] = year_max

    # Składanie zapytania. Zwróć uwagę na podwójne {{ }} przy exists!
    cypher_query = f"""
    MATCH (tr:Track)-[:PERFORMED_BY]->(a:Artist)
    WHERE all(t IN $selected_tags WHERE exists {{
        MATCH (tr)-[:HAS_TAG]->(tagNode:Tag)
        WHERE tagNode.tag = t OR tagNode.name = t
    }})
    {year_clauses}
    MATCH (tr)-[:HAS_TAG]->(allTags:Tag)
    RETURN 
        tr.name AS title,
        coalesce(a.artist, a.name) AS artist,
        tr.year AS year,
        collect(coalesce(allTags.tag, allTags.name)) AS tags,
        tr.spotify_id AS spotify_id
    ORDER BY tr.year DESC
    LIMIT $limit
    """
    try:
        records = db.execute_read(cypher_query, params)
        return jsonify(records), 200
    except Exception as e:
        print(f"Błąd bazy danych (Filtrowanie piosenek): {e}")
        return jsonify({"error": "Wystąpił błąd podczas wyszukiwania utworów"}), 500