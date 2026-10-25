/*
 * CestaNode_Rural.ino — Nodo CESTA: TDS + pH + MQ-135 + celda de carga 20 kg
 * BioSustain Research Lab · Prospyr 305 · 2026-10-24
 *
 * Placa: ESP32 DevKit (Arduino IDE, core "esp32 by Espressif")
 *
 * QUÉ HACE
 *   Lee 4 sensores y envía la telemetría por WiFi (HTTPS POST) a la API de
 *   BioSustain cada 30 segundos. La respuesta del servidor trae la decisión del
 *   aspersor (trigger_sprinkler) por si se quiere accionar un relé local.
 *
 * ENDPOINT (producción)
 *   POST https://biosustain-saas-683265952295.us-central1.run.app/api/v1/iot/metrics
 *   Header: X-API-Key: <llave del nodo>
 *
 * ⚠️ PINES ANALÓGICOS: SOLO ADC1 (GPIO 32–39).
 *   Los pines ADC2 (GPIO 0,2,4,12–15,25–27) NO funcionan con WiFi encendido y
 *   devuelven basura SIN dar error. Este sketch no los usa.
 *
 * LIBRERÍAS (Gestor de librerías del Arduino IDE)
 *   "HX711 Arduino Library" de Bogdan Necula  (autor: bogde)
 *
 * CONEXIONES
 *   TDS  (AOUT)      -> GPIO 34
 *   pH   (PO/OUT)    -> GPIO 35
 *   MQ-135 (AOUT)    -> GPIO 39   (VN)
 *   HX711 DT (DOUT)  -> GPIO 32
 *   HX711 SCK        -> GPIO 33
 *   Relé aspersor    -> GPIO 26   (módulo activo en LOW)
 *   Alimentación:    5 V (VIN) para ESP32 + sensores; GND común obligatorio
 *   HX711: VCC -> 5 V (según módulo, revisar), GND -> GND, EXC+/EXC-/A+/A- -> celda
 *
 * ANTES DE ENCENDER: ajustar el LM2596 (si se usa) a 5.0 V con multímetro.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <HX711.h>

// ─── 1. CONFIGURACIÓN — EDITAR ESTAS LÍNEAS ────────────────────────────────
const char* WIFI_SSID     = "TU_RED_WIFI";
const char* WIFI_PASSWORD = "TU_CLAVE_WIFI";

const char* API_URL   = "https://biosustain-saas-683265952295.us-central1.run.app/api/v1/iot/metrics";
const char* API_KEY   = "bs_PEGA_AQUI_LA_LLAVE_DEL_NODO";   // X-API-Key
const char* DEVICE_ID = "NODO-CESTA-RURAL-01";              // debe coincidir con la llave
const char* CESTA_ID  = "CESTA-RURAL-01";                   // cesta creada en el panel

const unsigned long INTERVALO_MS = 30000;   // 30 s entre envíos

// ─── 2. CALIBRACIÓN ────────────────────────────────────────────────────────
// TDS: factor típico 0.5–1.0 según la sonda. Calibrar con solución 342 ppm.
const float TDS_FACTOR = 0.50;

// pH: con solución 7.0 y 4.0 obtener y = m*x + b
const float PH_PENDIENTE = -5.70;   // ajustar
const float PH_OFFSET    = 21.34;   // ajustar

// Celda de carga: (lectura cruda) / (peso conocido en kg)
const float HX711_ESCALA = -7050.0; // ajustar con un peso patrón

// MQ-135 — es un indicador de gases, NO un medidor de CO₂ calibrado.
// La conversión usa la curva Rs/R0 y sirve como TENDENCIA dentro de la cesta.
const float MQ135_R0 = 76.63;       // calibrar en aire limpio (24–48 h de quemado)
const float MQ135_VCC = 5.0;        // el MQ-135 necesita 5 V
const int   MQ135_ADC_MAX = 4095;

// Temperatura para compensación de TDS/pH (si no hay DS18B20, dejar fija)
const float TEMP_COMP_C = 25.0;

// ─── 3. PINES ──────────────────────────────────────────────────────────────
const int PIN_TDS   = 34;
const int PIN_PH    = 35;
const int PIN_MQ135 = 39;
const int PIN_HX_DT = 32;
const int PIN_HX_SCK = 33;
const int PIN_RELE  = 26;

HX711 balanza;

// ─── 4. UTILIDADES ─────────────────────────────────────────────────────────

// Lee un pin analógico promediando N muestras (reduce ruido del ADC del ESP32).
float leerPromedio(int pin, int muestras = 15) {
  long suma = 0;
  for (int i = 0; i < muestras; i++) {
    suma += analogRead(pin);
    delay(6);
  }
  return (float)suma / (float)muestras;
}

// Convierte la lectura de TDS a ppm con compensación de temperatura.
float leerTDS(float tempC) {
  float v = leerPromedio(PIN_TDS) * (3.3f / 4095.0f);   // V en el pin
  float coef = 1.0f + 0.02f * (tempC - 25.0f);
  float vComp = v / coef;
  float tds = (133.42f * vComp * vComp * vComp - 255.86f * vComp * vComp + 857.39f * vComp)
              * TDS_FACTOR;
  if (tds < 0) tds = 0;
  return tds;
}

float leerPH() {
  float v = leerPromedio(PIN_PH) * (3.3f / 4095.0f);
  float ph = PH_PENDIENTE * v + PH_OFFSET;
  if (ph < 0) ph = 0;
  if (ph > 14) ph = 14;
  return ph;
}

// MQ-135 → CO₂ estimado (curva Rs/R0 → ppm). Tendencia, no medición de laboratorio.
float leerCO2Estimado() {
  float v = leerPromedio(PIN_MQ135) * (3.3f / 4095.0f);
  if (v <= 0.01f) return 400.0f;
  float rs = ((MQ135_VCC * 10.0f) / v - 10.0f) * 1000.0f;   // Rs en ohm (RL=10k)
  float ratio = rs / MQ135_R0;
  if (ratio < 0.01f) ratio = 0.01f;
  float ppm = 116.6020682f * pow(ratio, -2.769034857f);
  if (ppm < 400.0f) ppm = 400.0f;
  if (ppm > 5000.0f) ppm = 5000.0f;
  return ppm;
}

float leerPesoKg() {
  if (!balanza.is_ready()) return NAN;      // NUNCA enviamos NaN: se filtra abajo
  float kg = balanza.get_units(10);
  if (!isfinite(kg) || kg < 0) return NAN;
  if (kg > 100.0f) return 100.0f;
  return kg;
}

// Serializa un número con 2 decimales, o lo omite si es NaN/Inf.
void agregarCampo(String &json, const char *clave, float valor, bool &primero) {
  if (!isfinite(valor)) return;             // NaN / Inf fuera del JSON
  if (!primero) json += ",";
  primero = false;
  json += "\"";
  json += clave;
  json += "\":";
  json += String(valor, 2);
}

// ─── 5. WIFI ───────────────────────────────────────────────────────────────
void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[WiFi] conectando a %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] OK  IP=%s  RSSI=%d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("\n[WiFi] sin conexión — se reintenta en el próximo ciclo");
  }
}

// ─── 6. ENVÍO ──────────────────────────────────────────────────────────────
void enviarTelemetria() {
  float tds  = leerTDS(TEMP_COMP_C);
  float ph   = leerPH();
  float co2  = leerCO2Estimado();
  float peso = leerPesoKg();

  String json = "{\"device_id\":\"";
  json += DEVICE_ID;
  json += "\",\"cesta_id\":\"";
  json += CESTA_ID;

  // sensores: TDS, pH, CO₂ estimado, peso. Temperatura/humedad se omiten si no hay sensor.
  String sens = "";
  bool primero = true;
  agregarCampo(sens, "tds_ppm", tds, primero);
  agregarCampo(sens, "ph", ph, primero);
  agregarCampo(sens, "co2_ppm", co2, primero);
  agregarCampo(sens, "peso_riel_kg", peso, primero);

  json += "\",\"sensores\":{";
  json += sens;
  json += "},\"actuadores\":{\"aspersor_auto_status\":0,\"ventilacion_status\":0}}";

  Serial.println("[POST] " + json);

  WiFiClientSecure client;
  // DEMO: acepta cualquier certificado. Para producción, usar la CA raíz de
  // Google Trust Services (ver nota al final del archivo) para validar el TLS.
  client.setInsecure();

  HTTPClient http;
  http.setTimeout(15000);
  if (!http.begin(client, API_URL)) {
    Serial.println("[HTTP] no se pudo iniciar la conexión");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);

  int code = http.POST(json);
  String respuesta = http.getString();
  Serial.printf("[HTTP] %d  %s\n", code, respuesta.substring(0, 280).c_str());

  if (code == 200) {
    // El servidor devuelve el análisis biológico y si conviene accionar el aspersor.
    if (respuesta.indexOf("\"trigger_sprinkler\":true") >= 0) {
      Serial.println("[CTRL] servidor sugiere activar aspersor 45 s");
      digitalWrite(PIN_RELE, LOW);     // módulo de relé activo en LOW
      delay(45000);
      digitalWrite(PIN_RELE, HIGH);
    }
  } else if (code == 401) {
    Serial.println("[HTTP] 401 — la X-API-Key no es válida o el nodo fue desactivado");
  } else if (code == 400) {
    Serial.println("[HTTP] 400 — payload inválido: revisar nombres de campos");
  } else if (code < 0) {
    Serial.println("[HTTP] error de red/TLS");
  }

  http.end();
}

// ─── 7. SETUP / LOOP ───────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println("\n=== Nodo CESTA · BioSustain · arranque ===");

  pinMode(PIN_RELE, OUTPUT);
  digitalWrite(PIN_RELE, HIGH);        // relé apagado (activo en LOW)

  analogReadResolution(12);            // 0–4095
  analogSetAttenuation(ADC_11db);      // rango completo ~0–3.3 V

  balanza.begin(PIN_HX_DT, PIN_HX_SCK);
  balanza.set_scale(HX711_ESCALA);
  balanza.tare(20);                    // tarar con la cesta vacía

  conectarWiFi();
  Serial.printf("[SENS] TDS=%.1f ppm  pH=%.2f  CO2est=%.0f ppm  peso=%s kg\n",
                leerTDS(TEMP_COMP_C), leerPH(), leerCO2Estimado(),
                isnan(leerPesoKg()) ? "n/d" : String(leerPesoKg(), 2).c_str());
}

void loop() {
  static unsigned long ultimo = 0;

  if (WiFi.status() != WL_CONNECTED) conectarWiFi();

  if (millis() - ultimo >= INTERVALO_MS) {
    ultimo = millis();
    if (WiFi.status() == WL_CONNECTED) {
      enviarTelemetria();
    } else {
      Serial.println("[CICLO] sin WiFi — no se envía");
    }
  }
  delay(50);
}

/*
 * ─── NOTA DE SEGURIDAD TLS ──────────────────────────────────────────────────
 * client.setInsecure() no valida el certificado del servidor: sirve para la
 * demo. Para producción, reemplazar por la CA raíz de Google Trust Services:
 *
 *   static const char* GTS_ROOT_R1 = R"(
 *   -----BEGIN CERTIFICATE-----
 *   ...(descargar de https://pki.goog/repo/certs/gtsr1.pem)...
 *   -----END CERTIFICATE-----
 *   )";
 *   client.setCACert(GTS_ROOT_R1);
 *
 * ─── SI NO HAY CONEXIÓN ─────────────────────────────────────────────────────
 *   401 -> llave incorrecta o nodo desactivado (revisar en el panel)
 *   400 -> nombres de campos: deben ser exactamente tds_ppm, ph, co2_ppm, peso_riel_kg
 *   -1  -> red/TLS; probar con el hotspot del teléfono para descartar el router
 *   nada en el monitor serial -> revisar que el baud sea 115200 y el cable de datos
 */
