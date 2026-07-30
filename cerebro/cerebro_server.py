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
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# ── Autenticación ─────────────────────────────────────────────────────────────


def verify_key(x_cerebro_key: str | None = Header(None)) -> str:
    """Verifica la API key del Sandbox."""
    if not CEREBRO_API_KEY:
        return "dev"  # Modo desarrollo
    if not x_cerebro_key or x_cerebro_key != CEREBRO_API_KEY:
        raise HTTPException(status_code=401, detail="API key requerida.")
    return x_cerebro_key


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
        "gemini_configured": bool(GEMINI_API_KEY),
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
    """Diagnóstico predictivo usando Gemini API."""
    if not GEMINI_API_KEY:
        return {
            "cesta_id": req.cesta_id,
            "diagnostico": "Gemini API no configurada. Modo demo.",
            "demo": True,
        }

    import httpx

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
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                params={"key": GEMINI_API_KEY},
                json={
                    "contents": [
                        {"role": "user", "parts": [{"text": f"{system_prompt}\n\n{user_content}"}]}
                    ],
                    "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1024},
                },
            )

        if resp.status_code != 200:
            return {
                "cesta_id": req.cesta_id,
                "diagnostico": f"Error de Gemini API: {resp.status_code}",
            }

        data = resp.json()
        texto = data["candidates"][0]["content"]["parts"][0]["text"]
        return {
            "cesta_id": req.cesta_id,
            "diagnostico": texto,
            "modelo": GEMINI_MODEL,
        }

    except Exception as exc:
        return {
            "cesta_id": req.cesta_id,
            "diagnostico": f"Error: {exc}",
        }


# ── Punto de entrada ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)