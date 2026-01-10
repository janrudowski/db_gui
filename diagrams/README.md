# Diagramy UML - DB GUI

Ten katalog zawiera diagramy UML dokumentujące architekturę i funkcjonalność aplikacji DB GUI.

## Spis Diagramów

### 1. Diagram Przypadków Użycia
**Plik:** `01-przypadki-uzycia.puml`

Przedstawia wszystkie przypadki użycia aplikacji z perspektywy użytkownika:
- Zarządzanie połączeniami z bazami danych
- Przeglądanie struktury bazy (schematy, tabele, kolumny)
- Operacje na danych (CRUD)
- Edytor SQL
- Zarządzanie strukturą bazy
- Obsługa transakcji
- Eksport danych

### 2. Diagram Aktywności - Połączenie z Bazą
**Plik:** `02-aktywnosc-polaczenie.puml`

Przedstawia proces nawiązywania połączenia z bazą danych:
- Tworzenie nowego połączenia
- Testowanie połączenia
- Zapisywanie konfiguracji
- Nawiązywanie aktywnego połączenia

### 3. Diagram Aktywności - Wykonanie Zapytania SQL
**Plik:** `03-aktywnosc-zapytanie-sql.puml`

Przedstawia przepływ wykonania zapytania SQL:
- Pisanie/edycja zapytania
- Wykonanie zapytania
- Obsługa wyników i błędów
- Zapisywanie w historii

### 4. Diagram Aktywności - Edycja Danych
**Plik:** `04-aktywnosc-edycja-danych.puml`

Przedstawia operacje na danych w DataGrid:
- Filtrowanie i sortowanie
- Edycja komórek
- Dodawanie/usuwanie wierszy
- Eksport danych

### 5. Diagram Komponentów
**Plik:** `05-komponenty.puml`

Przedstawia architekturę komponentów aplikacji:
- Warstwa prezentacji (Vue.js)
- Store (Pinia)
- Most Tauri (IPC)
- Warstwa backendu (Rust)

### 6. Diagram Sekwencji - Wykonanie Zapytania
**Plik:** `06-sekwencja-wykonanie-zapytania.puml`

Przedstawia sekwencję komunikacji przy wykonaniu zapytania SQL:
- Interakcja frontend-backend
- Komunikacja z bazą danych
- Obsługa wyników i błędów

### 7. Diagram Sekwencji - Transakcje
**Plik:** `07-sekwencja-transakcja.puml`

Przedstawia zarządzanie transakcjami:
- Rozpoczęcie transakcji (BEGIN)
- Zatwierdzenie (COMMIT)
- Wycofanie (ROLLBACK)

### 8. Diagram Klas - Backend (Rust)
**Plik:** `08-klasy-backend.puml`

Przedstawia strukturę klas backendowych:
- Stan aplikacji (AppState)
- Trait DbConnection i implementacje
- Modele danych

### 9. Diagram Klas - Frontend (TypeScript)
**Plik:** `09-klasy-frontend.puml`

Przedstawia strukturę klas frontendowych:
- Store'y Pinia
- Typy danych
- Komponenty widoków

### 10. Diagram Stanów Aplikacji
**Plik:** `10-stanow-aplikacji.puml`

Przedstawia stany aplikacji i przejścia między nimi:
- Uruchamianie
- Ekran połączeń
- Widok bazy danych
- Obsługa błędów

### 11. Diagram Wdrożenia
**Plik:** `11-wdrozenie.puml`

Przedstawia architekturę wdrożeniową:
- Struktura aplikacji Tauri
- Połączenia z bazami danych
- Przechowywanie danych

## Generowanie Diagramów

Diagramy są w formacie PlantUML. Aby wygenerować obrazy:

### Online
Użyj [PlantUML Online Server](http://www.plantuml.com/plantuml/uml/)

### Lokalnie
```bash
# Instalacja PlantUML (macOS)
brew install plantuml

# Generowanie wszystkich diagramów do PNG
plantuml -tpng diagrams/*.puml

# Generowanie do SVG
plantuml -tsvg diagrams/*.puml
```

### VS Code
Zainstaluj rozszerzenie "PlantUML" i użyj `Alt+D` do podglądu.

## Stos Technologiczny

- **Frontend:** Vue 3, TypeScript, Pinia, PrimeVue, Monaco Editor
- **Backend:** Rust, Tauri 2.x, sqlx
- **Bazy danych:** PostgreSQL, MySQL, SQLite
- **Bezpieczeństwo:** Tauri Stronghold (szyfrowane hasła)
