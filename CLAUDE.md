# Control House — Frontend

## Descripción
Frontend Angular para aplicación de control de gastos.

## Stack
- **Framework:** Angular 21 con TypeScript estricto
- **UI:** Angular Material
- **Estilos:** SCSS
- **HTTP:** HttpClient con interceptors
- **Auth:** JWT guardado en localStorage
- **Routing:** Guards para rutas protegidas

## Backend
- URL base: http://localhost:3000/api/v1
- Endpoints auth:
  - POST /auth/register → { name, email, password }
  - POST /auth/login → { email, password } → devuelve token JWT

## Arquitectura
- Módulos por feature: auth, dashboard, accounts, transactions
- Servicios para cada módulo con HttpClient
- Interceptor HTTP para agregar JWT en cada request
- Guard para proteger rutas privadas
- Componentes standalone

## Convenciones
- Componentes standalone (no NgModules)
- Reactive Forms para formularios
- Manejo de errores en todos los servicios
- Variables de entorno en environment.ts
- Siempre trabajar en ramas

## Lo que NO hacer
- No guardar datos sensibles fuera de localStorage
- No skipear validaciones en formularios
- No usar any en TypeScript