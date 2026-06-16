"""Neo4j connection helper.

Moduł dostarcza klasy `Neo4jConnection` upraszczającej zarządzanie
połączeniem do bazy Neo4j oraz wykonywanie zapytań odczytu.

Konfiguracja (URI, user, password) jest ładowana z pliku `.env`
przez `python-dotenv` i pobierana z `os.environ`.

Przykład użycia:
    from db import db
    rows = db.execute_read('MATCH (n) RETURN n LIMIT 10')
"""

import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Ładujemy zmienne z pliku .env
load_dotenv()


class Neo4jConnection:
    """Wrapper dla Neo4j driver.

    Zapewnia prosty interfejs do:
    - inicjalizacji połączenia (`connect`),
    - zamykania (`close`),
    - wykonywania zapytań odczytu (`execute_read`).

    Używamy tutaj `execute_read` na sesji, co jest zgodne z
    rekomendacjami Neo4j dla operacji odczytu.
    """

    def __init__(self):
        self.driver = None

    def connect(self):
        """Inicjalizuje połączenie (`self.driver`) na podstawie zmiennych środowiskowych.

        Oczekiwane zmienne środowiskowe:
        - NEO4J_URI
        - NEO4J_USERNAME
        - NEO4J_PASSWORD

        Jeśli brak wymaganych wartości, metoda wypisuje ostrzeżenie i nic nie robi.
        """
        uri = os.environ.get("NEO4J_URI")
        user = os.environ.get("NEO4J_USERNAME")
        password = os.environ.get("NEO4J_PASSWORD")
        
        if not uri or not password:
            print("OSTRZEŻENIE: Brak danych logowania do Neo4j w pliku .env!")
            return

        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        """Zamyka aktywny driver, jeśli istnieje."""
        if self.driver is not None:
            self.driver.close()

    def execute_read(self, query, parameters=None):
        """Wykonuje zapytanie odczytu i zwraca listę wyników.

        Args:
            query (str): cypher query
            parameters (dict|None): opcjonalne parametry dla zapytania

        Returns:
            list[dict]: lista rekordów zwróconych przez Neo4j (każdy rekord jako słownik)
        """
        with self.driver.session() as session:
            result = session.execute_read(lambda tx: tx.run(query, parameters).data())
            return result

db = Neo4jConnection()