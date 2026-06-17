### Graph-Based-Music-Recommender

Konrad Ciężadło

Na podstawie zbioru: https://www.kaggle.com/datasets/undefinenull/million-song-dataset-spotify-lastfm

---

# Dokumentacja
Szczegółowa dokumentacja projektu oraz architektury kodu znajduje się w katalogu `docs/`.

---

# Uruchomienie lokalne

### Wymagania

- Python 3.12+
- Narzędzie `uv`
- Plik `.env`

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
