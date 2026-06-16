"""Flask application factory and entry point.

Konfiguruje i zwraca aplikację Flask z włączonym CORS oraz
podłączonym połączeniem do Neo4j. Blueprinty dla tras są
rejestrowane tutaj.

Uruchamianie lokalne:
    python main.py
"""

from flask import Flask
from flask_cors import CORS
from db import db
from routes.tracks import tracks_bp
from routes.tags import tags_bp


def create_app():
    """Tworzy i konfiguruje instancję Flask.

    Zwraca skonfigurowaną aplikację. Funkcja wykonuje minimalne
    bootstrapowanie (CORS, połączenie do bazy, rejestracja blueprintów).
    """
    app = Flask(__name__)
    
    # Włączenie CORS pozwala na zapytania z przeglądarki (SPA)
    CORS(app)

    # Inicjalizacja połączenia z Neo4j
    db.connect()

    # Rejestracja naszych endpointów
    app.register_blueprint(tracks_bp)
    app.register_blueprint(tags_bp)

    return app


app = create_app()


if __name__ == '__main__':
    # Uruchamiamy serwer lokalnie na porcie 5000 (debug OK dla devel)
    app.run(debug=True, host='0.0.0.0', port=5000)