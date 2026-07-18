biosustain-data-manager/
├── src/
│   ├── dominio/                # Lógica pura de negocio
│   │   └── BioconversionAgent.ts
│   ├── infraestructura/        # Implementaciones (DB, PubSub)
│   │   ├── db/
│   │   │   └── Repository.ts   # Implementación Firestore
│   │   └── pubsub/
│   │       └── SensorSubscriber.ts
├── tests/                      # Pruebas unitarias
│   └── SensorSubscriber.test.ts
├── README.md                   # DOCUMENTACIÓN OFICIAL (Raíz)
└── package.json
