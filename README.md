# BioSustain: Plataforma SaaS de Bioconversión

## Arquitectura Técnica
Sistema distribuido basado en eventos diseñado para el monitoreo autónomo, escalable y en tiempo real.

``` ```mermaid 
graph LR
    A[Sensores IoT] --> B(Google Cloud Pub/Sub)
    B --> C{Worker Cloud Run}
    C --> D[(Database/Storage)]
    C --> E[Dashboard Health Check] `` `` ``
    
Pilares de Ingeniería
Escalabilidad (O(1)): Procesamiento asíncrono vía Pub/Sub que permite escalar a múltiples reactores sin latencia.
Seguridad: Implementación de Secret Manager para gestión de credenciales y cuentas de servicio con privilegios mínimos (IAM).
Clean Architecture: Separación estricta entre lógica de negocio (Dominio) e infraestructura (GCP).
Despliegue Continuo: Automatización total mediante Google Cloud Build (cloudbuild.yaml).
Stack TecnológicoBackend: Node.js, TypeScript (Clean Architecture).
Infraestructura: Google Cloud Run (Serverless), Pub/Sub, Secret Manager.
Validación: Jest (Unit Testing para lógica de biomasa).
Monitoreo: Dashboard de salud integrado para métricas críticas de pH y temperatura.
Metodología de Validación
Para garantizar la fiabilidad del sistema:
Input Sanitization: Normalización de datos en el SensorAdapter.
Motor de Reglas: Evaluación determinista (O(1)) de parámetros biológicos (pH 5.5-7.5).
Pruebas de Estrés: Cobertura de tests unitarios que simulan condiciones críticas de biomasa.
Equipo (BioSustain Research Lab)
Haydee Zulay Viteri Bernal: CEO & Fundadora,Estrategia.
Wiston Ricardo Viteri Bernal: Lead Technical & Research.
José Alejandro Vargas: Software Architecture & Backend.
Sharon Guillen: Strategy & UX.
Diana Paola Contreras Sanchez: Lab & Production Data.
Robespierre Reinaldo Carrillo Arias: Legal & Logistics.
Desarrollado bajo estándares de grado industrial para el desafío global Build with Gemini XPRIDE.
