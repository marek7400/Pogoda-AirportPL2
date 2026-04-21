#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use serde::{Serialize, Deserialize};
use regex::Regex;

#[derive(Serialize, Deserialize, Debug)]
pub struct WeatherData {
    pub wind: Option<String>,
    pub temperature: Option<String>,
    pub humidity: Option<String>,
    pub pressure: Option<String>,
    pub wind_dir: Option<i64>,
    pub phenomena: Option<String>,
    pub icon: String,
    pub is_day: bool,
    pub timestamp: String,
}

#[tauri::command]
fn get_weather(icao_code: String) -> Result<WeatherData, String> {
    let icao_upper = icao_code.to_uppercase();
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("PogodaAirportPL-Widget/1.0")
        .build()
        .map_err(|e| format!("Błąd klienta: {}", e))?;

    // 1. Try Official METAR for specific ICAO
    let metar_url = format!("https://aviationweather.gov/api/data/metar?ids={}&format=json", icao_upper);
    if let Ok(response) = client.get(&metar_url).send() {
        if let Ok(json) = response.json::<serde_json::Value>() {
            if let Some(arr) = json.as_array() {
                if !arr.is_empty() {
                    return process_metar_data(arr.get(0).unwrap());
                }
            }
        }
    }

    // 2. If missing, find NEAREST METAR (Radial search)
    if let Some(coords) = get_airport_coords(&icao_upper) {
        let radial_url = format!(
            "https://aviationweather.gov/api/data/metar?radial={},{},50&format=json",
            coords.0, coords.1
        );
        if let Ok(response) = client.get(&radial_url).send() {
            if let Ok(json) = response.json::<serde_json::Value>() {
                if let Some(arr) = json.as_array() {
                    if !arr.is_empty() {
                        // Find the one with shortest distance if available, or just the first
                        return process_metar_data(arr.get(0).unwrap());
                    }
                }
            }
        }
    }

    // 3. Last Fallback: Open-Meteo
    let coords = get_airport_coords(&icao_upper).ok_or_else(|| format!("Nie znaleziono lotniska: {}", icao_upper))?;
    let fallback_url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code,is_day",
        coords.0, coords.1
    );

    let fb_response = client.get(fallback_url).send().map_err(|e| format!("Błąd połączenia (OM): {}", e))?;
    let fb_json: serde_json::Value = fb_response.json().map_err(|e| format!("Błąd formatu (OM): {}", e))?;
    
    process_fallback_data(fb_json)
}

fn get_airport_coords(icao: &str) -> Option<(f64, f64)> {
    match icao {
        "EPWA" => Some((52.1657, 20.9671)), "EPKK" => Some((50.0777, 19.7848)),
        "EPGD" => Some((54.3775, 18.4661)), "EPKT" => Some((50.4743, 19.08)),
        "EPWR" => Some((51.1027, 16.8858)), "EPPO" => Some((52.4211, 16.8263)),
        "EPBY" => Some((53.0964, 17.9772)), "EPRZ" => Some((50.11, 22.019)),
        "EPLL" => Some((51.7219, 19.3981)), "EPSC" => Some((53.5847, 14.9022)),
        "EPSY" => Some((53.4819, 20.9378)), "EPLB" => Some((51.2393, 22.7127)),
        "EPMO" => Some((52.4511, 20.6517)), "EPRA" => Some((51.3892, 21.2131)),
        "EPZG" => Some((52.1385, 15.7986)), "EPBK" => Some((53.1072, 23.1747)),
        "EPBA" => Some((52.0333, 23.1333)), "EPCZ" => Some((50.8847, 19.2014)),
        "EPEL" => Some((54.1708, 19.4233)), "EPPG" => Some((54.2483, 18.6717)),
        "EPGL" => Some((50.2711, 18.6675)), "EPGI" => Some((53.5233, 18.835)),
        "EPIR" => Some((52.83, 18.33)), "EPJS" => Some((50.8986, 15.7867)),
        "EPKM" => Some((50.2383, 18.96)), "EPKW" => Some((54.045, 19.1783)),
        "EPKC" => Some((50.8461, 20.6531)), "EPKB" => Some((52.3167, 18.1667)),
        "EPKP" => Some((50.0864, 20.2036)), "EPKR" => Some((49.6822, 21.7514)),
        "EPLS" => Some((51.8358, 16.5275)), "EPLR" => Some((51.2153, 22.3958)),
        "EPSW" => Some((51.2319, 22.6917)), "EPLK" => Some((51.5517, 19.1783)),
        "EPMB" => Some((54.0267, 19.135)), "EPML" => Some((50.3222, 21.4622)),
        "EPMM" => Some((52.1994, 21.6569)), "EPMI" => Some((53.3933, 16.1381)),
        "EPNL" => Some((49.7469, 20.6217)), "EPNT" => Some((49.4622, 20.0483)),
        "EPOD" => Some((53.7725, 20.4158)), "EPOP" => Some((50.63, 17.7817)),
        "EPOM" => Some((51.7008, 17.8483)), "EPPI" => Some((53.1692, 16.7119)),
        "EPPT" => Some((51.385, 19.6861)), "EPPL" => Some((52.5858, 19.7214)),
        "EPPK" => Some((52.4331, 17.0425)), "EPKS" => Some((52.3317, 16.9633)),
        "EPRP" => Some((51.4797, 21.1128)), "EPRG" => Some((50.0708, 18.6275)),
        "EPSK" => Some((54.4789, 17.1083)), "EPST" => Some((50.6097, 22.015)),
        "EPSU" => Some((54.0722, 22.8986)), "EPSD" => Some((53.3922, 14.6331)),
        "EPSN" => Some((53.7908, 15.8267)), "EPTO" => Some((52.9847, 18.5475)),
        "EPBC" => Some((52.2686, 20.9108)), "EPWK" => Some((52.5853, 19.0131)),
        "EPWS" => Some((51.2017, 16.9975)), "EPZA" => Some((50.5986, 23.2036)),
        "EPZN" => Some((51.9844, 15.4647)),
        _ => None,
    }
}

fn process_metar_data(metar: &serde_json::Value) -> Result<WeatherData, String> {
    let raw_ob = metar.get("rawOb").and_then(|s| s.as_str()).unwrap_or("");
    let knots = metar.get("wspd").and_then(|w| w.as_f64().or_else(|| w.as_i64().map(|i| i as f64)));
    let wind = knots.map(|k| (k * 1.852).round().to_string());
    
    let mut wind_dir = metar.get("wdir").and_then(|d| d.as_i64());
    if wind_dir.is_none() || wind_dir == Some(0) {
        let wind_re = Regex::new(r"(\d{3})(\d{2,3})KT").unwrap();
        if let Some(cap) = wind_re.captures(raw_ob) {
            wind_dir = cap.get(1).and_then(|m| m.as_str().parse::<i64>().ok());
        }
    }

    let altim = metar.get("altim").and_then(|p| p.as_f64().or_else(|| p.as_i64().map(|i| i as f64)));
    let pressure = altim.map(|p| (if p < 110.0 { p * 33.8639 } else { p }).round().to_string());
    let phenomena = metar.get("wxString").and_then(|s| s.as_str()).map(|s| s.to_string());
    
    let clouds = metar.get("clouds").and_then(|c| c.as_array());
    let mut max_cover = "CLR";
    if let Some(cloud_layers) = clouds {
        let covers = ["OVC", "BKN", "SCT", "FEW", "CLR"];
        for layer in cloud_layers {
            if let Some(cover) = layer.get("cover").and_then(|s| s.as_str()) {
                let current_rank = covers.iter().position(|&r| r == cover).unwrap_or(4);
                let best_rank = covers.iter().position(|&r| r == max_cover).unwrap_or(4);
                if current_rank < best_rank { max_cover = cover; }
            }
        }
    }

    let mut icon = match max_cover {
        "OVC" => "overcast", 
        "BKN" => "broken", 
        "SCT" => "scattered", 
        "FEW" => "few", 
        _ => "sunny",
    }.to_string();

    if let Some(ref ph) = phenomena {
        let ph_upper = ph.to_uppercase();
        if ph_upper.contains("TS") { icon = "thunder".to_string(); }
        else if ph_upper.contains("GR") || ph_upper.contains("GS") { icon = "hail".to_string(); }
        else if ph_upper.contains("SN") { icon = "snow".to_string(); }
        else if ph_upper.contains("RA") || ph_upper.contains("DZ") { icon = "rain".to_string(); }
        else if ph_upper.contains("FG") { icon = "fog".to_string(); }
        else if ph_upper.contains("BR") { icon = "mist".to_string(); }
        else if ph_upper.contains("HZ") { icon = "haze".to_string(); }
    }

    let temperature_val = metar.get("temp").and_then(|t| t.as_f64().or_else(|| t.as_i64().map(|i| i as f64)));
    let dewpoint = metar.get("dewp").and_then(|d| d.as_f64().or_else(|| d.as_i64().map(|i| i as f64)));
    let temperature = temperature_val.map(|t| t.round().to_string());
    let humidity = if let (Some(t), Some(dp)) = (temperature_val, dewpoint) {
        let rh = 100.0 * (((17.625 * dp) / (243.04 + dp)).exp() / ((17.625 * t) / (243.04 + t)).exp());
        Some(rh.round().to_string())
    } else { None };

    use chrono::Timelike;
    let hour = chrono::Local::now().hour();
    let is_day = hour >= 6 && hour < 20;

    Ok(WeatherData { wind, temperature, humidity, pressure, wind_dir, phenomena, icon, is_day, timestamp: chrono::Local::now().format("%H:%M").to_string() })
}

fn process_fallback_data(json: serde_json::Value) -> Result<WeatherData, String> {
    let current = json.get("current").ok_or("Brak danych bieżących")?;
    
    let temperature = current.get("temperature_2m").and_then(|v| v.as_f64()).map(|v| v.round().to_string());
    let wind = current.get("wind_speed_10m").and_then(|v| v.as_f64()).map(|v| v.round().to_string());
    let wind_dir = current.get("wind_direction_10m").and_then(|v| v.as_i64());
    let humidity = current.get("relative_humidity_2m").and_then(|v| v.as_f64()).map(|v| v.round().to_string());
    let pressure = current.get("surface_pressure").and_then(|v| v.as_f64()).map(|v| v.round().to_string());
    let weather_code = current.get("weather_code").and_then(|v| v.as_i64()).unwrap_or(0);
    let is_day = current.get("is_day").and_then(|v| v.as_f64().or_else(|| v.as_i64().map(|i| i as f64))).map(|v| v == 1.0).unwrap_or(true);

    let (phenomena, icon) = match weather_code {
        0 => (None, "sunny".to_string()),
        1..=2 => (None, "few".to_string()),
        3 => (None, "overcast".to_string()),
        45 | 48 => (Some("Mgła".to_string()), "fog".to_string()),
        51..=55 => (Some("Mżawka".to_string()), "drizzle".to_string()),
        61..=65 => (Some("Deszcz".to_string()), "rain".to_string()),
        71..=75 => (Some("Śnieg".to_string()), "snow".to_string()),
        77 => (Some("Krupa śnieżna".to_string()), "hail".to_string()),
        80..=82 => (Some("Ulewa".to_string()), "rain".to_string()),
        85..=86 => (Some("Śnieżyca".to_string()), "snow".to_string()),
        95..=99 => (Some("Burza".to_string()), "thunder".to_string()),
        _ => (None, "few".to_string()),
    };

    Ok(WeatherData {
        wind, temperature, humidity, pressure, wind_dir, phenomena, icon, is_day,
        timestamp: chrono::Local::now().format("%H:%M").to_string(),
    })
}


use tauri::{SystemTray, SystemTrayMenu, CustomMenuItem, SystemTrayEvent};

#[tauri::command]
fn close_window(window: tauri::Window) {
    window.close().unwrap();
}

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Zamknij Pogoda KRK");
    let tray_menu = SystemTrayMenu::new().add_item(quit);
    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => {
                if id == "quit" {
                    app.exit(0);
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![get_weather, close_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
