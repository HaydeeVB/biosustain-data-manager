"""
cerebro_server.py — Servidor privado "Cerebro" para BioSustain.

Ejecuta los modelos de gemelo digital (Python + R + Gemini) en un
servidor privado sin IP pública. Solo el Sandbox puede acceder.

Endpoints:
  POST /model/biomass-projection  → proyección de biomasa (Verhulst)
  POST /model/water-balance       → balance hídrico + aspersor (R model logic)
  POST /model/gemini-diagnostic  → diagnóstico con Gemini API
  GET  /health                    → estado del Cerebro

Seguridad:
  - API key en header X-Cerebro-Key
  - Sin IP pública (solo accesible desde el Sandbox via red interna)
  - No expone código fuente ni algoritmos — solo resultados

Ejecutar:
  uvicorn cerebro_server:app --host 0.0.0.0 --port 8001
"""
from __future__ import annotations

import os
import math
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel, Field

app = FastAPI(title="BioSustain Cerebro", version="0.1.0")

CEREBRO_API_KEY = os.getenv("CEREBRO_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GCP_PROJECT = os.getenv("GCP_PROJECT", "caramelo33")
GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")

# ── Autenticación ─────────────────────────────────────────────────────────────


def verify_key(
    x_cerebro_key: str | None = Header(None),
    x_api_key: str | None = Header(None),
) -> str:
    """Verifica la API key del Sandbox.

    Acepta X-Cerebro-Key (nombre documentado) y X-API-Key (el que enviaba el
    Sandbox). Antes solo aceptaba X-Cerebro-Key, así que el Sandbox recibía 401
    en cada llamada y caía a su respaldo local sin que se notara.
    """
    if not CEREBRO_API_KEY:
        raise HTTPException(status_code=503, detail="CEREBRO_API_KEY no configurada.")
    provided = x_cerebro_key or x_api_key
    if not provided or provided != CEREBRO_API_KEY:
        raise HTTPException(status_code=401, detail="API key requerida.")
    return provided


# ── Modelos de entrada ───────────────────────────────────────────────────────


class BiomassProjectionRequest(BaseModel):
    cesta_id: str
    biomasa_inicial_kg: float = Field(gt=0)
    sustrato_inicial_kg: float = Field(gt=0)
    temperatura_promedio: float
    humedad_promedio: float
    dias_a_proyectar: int = Field(ge=1, le=30)


class WaterBalanceRequest(BaseModel):
    cesta_id: str
    humedad_actual: float
    temperatura_actual: float
    extractor_activo: bool


class GeminiDiagnosticRequest(BaseModel):
    cesta_id: str
    metricas: dict
    pregunta: str = Field(max_length=500)


# ── Cliente Gemini (Vertex AI vía ADC) ───────────────────────────────────────
# Mismo enfoque que el Sandbox: véase src/routes/cerebro.ts getGenai().
# Requiere que el service account tenga el scope cloud-platform (Cloud Run lo
# otorga por defecto). Sin API key.

_genai_client: Any | None = None
_genai_error: str | None = None


def _get_genai() -> Any:
    """Devuelve el cliente google-genai (Vertex AI), creándolo una sola vez."""
    global _genai_client, _genai_error
    if _genai_client is not None:
        return _genai_client
    try:
        from google import genai

        _genai_client = genai.Client(
            vertexai=True,
            project=GCP_PROJECT,
            location=GCP_LOCATION,
        )
        return _genai_client
    except Exception as exc:  # pragma: no cover
        _genai_error = str(exc)
        raise


def _genai_available() -> bool:
    """True si el SDK de Gemini está instalado y el cliente puede construirse."""
    try:
        _get_genai()
        return True
    except Exception:
        return False


# ── Modelo 1: Crecimiento larvario (Python — LarvalGrowthTwin) ──────────────
# Basado en el código del equipo: SOFWARE/code-1784482159142.py

def simulate_larval_growth(
    biomasa_inicial: float,
    sustrato_inicial: float,
    temp_prom: float,
    humedad_prom: float,
    dias: int,
) -> list[dict]:
    """Simula el crecimiento de biomasa larvaria día a día."""
    biomasa = biomasa_inicial
    sustrato = sustrato_inicial
    mortality_rate = 0.05  # Meta: 5%
    history = []

    for day in range(1, dias + 1):
        # Factor de eficiencia térmica (óptimo: 27-30°C)
        if 27 <= temp_prom <= 30:
            thermal_eff = 1.0
        else:
            thermal_eff = max(0.2, 1.0 - 0.08 * abs(28.5 - temp_prom))

        # Factor de eficiencia hídrica (óptimo: 60-70%)
        if 60 <= humedad_prom <= 70:
            moisture_eff = 1.0
        else:
            moisture_eff = max(0.3, 1.0 - 0.05 * abs(65.0 - humedad_prom))

        # Tasa de conversión alimenticia
        growth_rate = 0.18 * thermal_eff * moisture_eff

        if sustrato > 0:
            food_consumed = biomasa * 2.5 * thermal_eff
            food_consumed = min(food_consumed, sustrato)
            new_biomass = biomasa + (food_consumed * growth_rate)
            biomasa = new_biomass * (1.0 - (mortality_rate / 14))
            sustrato -= food_consumed
        else:
            biomasa *= 0.95  # Hambruna

        history.append({
            "dia": day,
            "biomasa_estimada_kg": round(biomasa, 2),
            "sustrato_remanente_kg": round(sustrato, 2),
            "eficiencia_termica": round(thermal_eff, 2),
        })

    return history


# ── Modelo 2: Balance hídrico (R — predict_sprinkler_activation) ─────────────
# Traducido del código R: SOFWARE/code-1784482099922.r


def predict_sprinkler_activation(
    humedad_actual: float,
    temp_actual: float,
    extractor_activo: bool,
) -> dict:
    """Predice la necesidad de activación del aspersor."""
    target_humidity = 65.0
    evaporation_constant = 0.08
    ventilation_factor = 1.4 if extractor_activo else 1.0

    # Proyección de pérdida de humedad (próximas 2 horas)
    projected_loss = (temp_actual * evaporation_constant) * ventilation_factor
    predicted_humidity = humedad_actual - projected_loss

    if predicted_humidity < 60.0:
        humidity_deficit = target_humidity - predicted_humidity
        # 1 segundo de aspersión = 0.4% de humedad
        required_seconds = math.ceil(humidity_deficit / 0.4)
        required_seconds = min(required_seconds, 45)  # Safety cap
        action = "ACTIVAR_ASPERSOR"
        reason = f"Déficit hídrico proyectado de {humidity_deficit:.2f}%"
    else:
        required_seconds = 0
        action = "MANTENER_INACTIVO"
        reason = "Microclima estable dentro del rango óptimo."

    return {
        "humedad_proyectada_pct": round(predicted_humidity, 2),
        "accion": action,
        "duracion_aspersor_seg": required_seconds,
        "diagnostico": reason,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────


@app.get("/health")
async def health(_key: str = Header(None)):
    """Estado del Cerebro."""
    return {
        "status": "ok",
        "service": "biosustain-cerebro",
        "version": "0.1.0",
        "gemini_configured": _genai_available(),
        "auth_mode": "vertex-adc",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/model/biomass-projection")
async def biomass_projection(
    req: BiomassProjectionRequest, _key: str = Depends(verify_key)
):
    """Proyección de biomasa usando el modelo de crecimiento larvario."""
    history = simulate_larval_growth(
        req.biomasa_inicial_kg,
        req.sustrato_inicial_kg,
        req.temperatura_promedio,
        req.humedad_promedio,
        req.dias_a_proyectar,
    )
    return {
        "cesta_id": req.cesta_id,
        "proyeccion": history,
        "biomasa_final_kg": history[-1]["biomasa_estimada_kg"] if history else 0,
        "dias_proyectados": len(history),
        "modelo": "LarvalGrowthTwin v1.0",
    }


@app.post("/model/water-balance")
async def water_balance(
    req: WaterBalanceRequest, _key: str = Depends(verify_key)
):
    """Balance hídrico y decisión de aspersor."""
    result = predict_sprinkler_activation(
        req.humedad_actual,
        req.temperatura_actual,
        req.extractor_activo,
    )
    return {
        "cesta_id": req.cesta_id,
        **result,
        "modelo": "WaterBalanceTwin v1.0",
    }


@app.post("/model/gemini-diagnostic")
async def gemini_diagnostic(
    req: GeminiDiagnosticRequest, _key: str = Depends(verify_key)
):
    """Diagnóstico predictivo usando Gemini (Vertex AI vía ADC).

    Usa el SDK google-genai en modo Vertex AI con las credenciales del service
    account de Cloud Run — NO requiere API key. Esto replica el enfoque del
    Sandbox (src/routes/cerebro.ts), que es el que funciona en producción: la
    política de la organización bloquea las claves 'AQ.' de service account, y
    el token por defecto de Cloud Run no tiene el scope de la Gemini Developer API.
    """
    if not _genai_available():
        return {
            "cesta_id": req.cesta_id,
            "diagnostico": "Motor de IA no disponible en este entorno.",
            "demo": True,
        }

    system_prompt = (
        "Eres el asistente de BioSustain Data-Manager. Analizas métricas "
        "de bioconversión con Hermetia illucens y das recomendaciones agronómicas. "
        "Responde en español, de forma clara y concisa."
    )

    user_content = (
        f"Métricas de la cesta {req.cesta_id}: {req.metricas}\n\n"
        f"Pregunta del productor: {req.pregunta}"
    )

    try:
        client = _get_genai()
        respuesta = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=f"{system_prompt}\n\n{user_content}",
            config={"temperature": 0.7, "max_output_tokens": 1024},
        )
        texto = respuesta.text
        return {
            "cesta_id": req.cesta_id,
            "diagnostico": texto,
            "modelo": GEMINI_MODEL,
            "demo": False,
            "disclaimer": (
                "Estimaciones generadas por IA; no certificadas por terceros. "
                "Verifica antes de uso regulatorio."
            ),
        }

    except Exception as exc:
        return {
            "cesta_id": req.cesta_id,
            "diagnostico": f"Error del motor de IA: {exc}",
            "demo": True,
        }


# ── Punto de entrada ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)