### Graph-Based-Music-Recommender

Konrad Ciężadło

---

# Dokumentacja
Szczegółowa dokumentacja projektu oraz architektury kodu znajduje się w katalogu `docs/`.

---

# Uruchomienie lokalne

### Server

Przed uruchomieniem backendu; katalog `server/` musi zawierać plik **`.env`**.

```
cd server
uv run python main.py
```

### Client

```
cd client
python -m http.server 8000
```

Serwis jest dostępny w przeglądarce pod adresem: http://127.0.0.1:8000
