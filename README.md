
# Pogoda-AirportPL ✈️☀️

Lekka i nowoczesna aplikacja desktopowa dostarczająca precyzyjne dane pogodowe bezpośrednio z polskich lotnisk (depesze METAR). Zaprojektowana tak, aby nie zajmować miejsca na ekranie i oferować natychmiastowy wgląd w warunki atmosferyczne.

<img width="1032" height="226" alt="1" src="https://github.com/user-attachments/assets/9baa3ee0-7625-43d5-bc71-0deaaf0c26be" />

## 🚀 Główne możliwości

*   **Precyzyjne dane lotnicze**: Aplikacja korzysta z oficjalnych depesz METAR, co gwarantuje najwyższą dokładność parametrów pogodowych.
*   **Kompaktowy interfejs**: Minimalistyczny pasek pogodowy, który można swobodnie przesuwać po ekranie.
*   **Tryb "Zwiń"**: Możliwość ukrycia szczegółowych danych i pozostawienia jedynie kluczowej ikonki pogody, aby zaoszczędzić miejsce na pulpicie.

## 📊 Źródło danych i parametry

*   **Skąd dane?**: Aplikacja pobiera dane bezpośrednio z serwerów danych lotniczych (METAR), które są standardem w lotnictwie cywilnym.
*   **Wyświetlane parametry**:
    *   **Temperatura**: Aktualna temperatura powietrza.
    *   **Wiatr**: Prędkość wiatru wraz z dynamiczną strzałką wskazującą kierunek (zgodnie z różą wiatrów).
    *   **Wilgotność**: Aktualna wilgotność powietrza.
    *   **Ciśnienie**: Ciśnienie atmosferyczne (QNH).
    *   **Zjawiska**: Opisy stanów pogody (np. deszcz, mgła, burza).
*   **Czas odświeżania**: Dane są automatycznie sprawdzane i aktualizowane co **30 minut**, zgodnie z typowym cyklem publikacji depesz METAR.

## 🌐 Brak połączenia i stabilność
*   Aplikacja posiada inteligentny system cache oraz autoodzyskiwania. W przypadku problemów:
    *   **Automatyczne próby**: Aplikacja podejmuje do 3 prób odświeżenia z rosnącym czasem oczekiwania (5s, 10s, 15s), co daje systemowi czas na połączenie z siecią po wybudzeniu.
    *   **Detekcja wybudzenia**: Program automatycznie odświeża dane po wykryciu wybudzenia komputera z uśpienia.
    *   **Sygnał Online**: Natychmiastowa aktualizacja po przywróceniu dostępu do internetu.
    *   **Dane archiwalne**: W razie permanentnego braku sieci wyświetla ostatnie pomyślnie pobrane dane (wyblakły interfejs + komunikat).
    *   **Ręczne odświeżanie**: Zawsze możesz kliknąć PPM na pasek i wybrać 'Odśwież dane'.

## 🛠️ Funkcje użytkowe

*   **Wybór lotniska**: 
    *   Kliknięcie zielonej ikonki pinezki (widoczna po lewej stronie, nad strzałką) otwiera interaktywne menu.
    *   Możliwość wyboru spośród części polskich lotnisk pogrupowanych miastami (np. EPKK Kraków, EPWA Warszawa-Chopin, EPMO Modlin).
    *   Wybór jest zapamiętywany po ponownym uruchomieniu aplikacji.
       
 <img width="494" height="477" alt="2" src="https://github.com/user-attachments/assets/07ce1ea2-4425-43d2-bb8d-3af3f218e0b2" />

 # UWAGA!
Skaner online Virus Total fałszywie pokazuje zagrożenie jako:

Trapmine pokazał "Malicious.high.ml.score"?
Dopiski takie jak ".ml" lub "score" oznaczają, że silnik antywirusowy nie znalazł konkretnego wirusa, ale jego Machine Learning (Sztuczna Inteligencja) uznał, że plik "wygląda podejrzanie".

# Dlaczego aplikacja "wygląda podejrzanie" dla AI?
Brak podpisu cyfrowego: Twoja aplikacja nie jest podpisana certyfikatem deweloperskim (który kosztuje kilkaset dolarów rocznie). Dla antywirusów każdy plik .exe niewiadomego pochodzenia, który nie jest powszechnie znany, jest z definicji "podejrzany".

Charakterystyka Tauri: Aplikacje Tauri łączą w sobie kod Rust (skompilowany do kodu maszynowego) oraz silnik przeglądarki. Niektóre agresywne algorytmy antywirusowe mylą taki sposób działania z wirusami typu "loader".

# Pobieranie danych z sieci: 
Program łączy się z zewnętrznym serwerem, aby pobrać pogodę. Dla algorytmu ML "nieznany plik .exe, który od razu chce łączyć się z internetem" może zapalić czerwoną lampkę.

# Podsumowanie:
Plik jest czysty. Gdyby był naprawdę zainfekowany, wynik wynosiłby co najmniej 15-20/72, a Microsoft Defender natychmiast skasowałby go z dysku po próbie uruchomienia.
Trapmine jest znany wśród programistów z tego, że bardzo często flaguje nowo skompilowane, niepodpisane aplikacje. 

# Uruchamianie przy każdym starcie komputera:

Skopiuj exe do dowolnego folderu.
Kliknij na plik exe prawym przyciskiem myszki i z menu wybierz
"Wyślij do/Pulpit (utwórz skrót)"

Naciśnij Win + R

Wpisz:

shell:startup

i naciśnij OK

Otworzy się folder Autostartu.

Skopiuj tam skrót do swojego pliku .exe 
czyli Pogoda-AirportPL.exe.lnk (nie sam plik exe, tylko skrót).

Program będzie uruchamiał się automatycznie po zalogowaniu.
