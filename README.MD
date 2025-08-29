# 💈 Barbería — Backend (FastAPI + MongoDB)

Backend para la gestión integral de una barbería: **clientes, barberos, servicios, turnos, reseñas, notificaciones y analíticas**.  
Construido con **FastAPI**, **MongoDB (Motor)** y **JWT** para autenticación.

---

## 🚀 Stack
- **Framework:** FastAPI
- **DB:** MongoDB (driver **motor** / `pymongo`)
- **Auth:** JWT (login/register)
- **Validación:** Pydantic v2
- **ASGI server:** uvicorn
- **ENV:** `python-dotenv`

> Puerto por defecto: **8001** (definido en `server.py`).

---

## 📁 Estructura (resumen)
```
backend/
├─ server.py            # App principal FastAPI, rutas base y auth
├─ database.py          # Conexión a MongoDB y helpers
├─ models.py            # Modelos Pydantic (User, Barber, Service, Appointment, etc.)
├─ analytics.py         # Router de analíticas  (/api/analytics)
├─ reviews.py           # Router de reseñas      (/api/reviews)
├─ notifications.py     # Router de notificaciones (/api/notifications)
├─ whatsapp_routes.py   # Router de WhatsApp     (/api/whatsapp)
├─ requirements.txt     # Dependencias
└─ .env                 # Variables de entorno (no subir)
```
> **Nota:** El proyecto trae una carpeta `venv/` en el ZIP que **no debe** subirse al repo. Usá `requirements.txt` para recrear el entorno.

---

## 🔐 Variables de entorno (`backend/.env`)
Solo **nombres** (no subas valores reales):
```ini
MONGO_URL=mongodb+srv://...
DB_NAME=barberia
JWT_SECRET=super_secreto
PORT=8001
```
- `MONGO_URL`: cadena de conexión a MongoDB.
- `DB_NAME`: nombre de la base.
- `JWT_SECRET`: secreto para firmar tokens JWT.
- `PORT`: puerto del backend (coincide con `server.py`).

---

## 📦 Instalación y ejecución

### 1) Clonar y posicionarse
```bash
git clone https://github.com/ajoca/Barberia.git
cd Barberia/backend
```

### 2) Crear y activar entorno virtual
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
# source venv/bin/activate
```

### 3) Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4) Configurar `.env`
Crear `backend/.env` con las claves indicadas arriba.

### 5) Ejecutar
```bash
python server.py
# o
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
La API quedará en: `http://localhost:8001`  
Documentación automática: `http://localhost:8001/docs` (si está habilitada por defecto).

---

## 🔑 Autenticación
- **POST** `/api/auth/register` → alta de usuario
- **POST** `/api/auth/login` → devuelve **JWT**

Usá el header:  
`Authorization: Bearer <tu_token>` en endpoints protegidos.

---

## 🧭 Endpoints principales (detectados)

### Base (server.py)
- **POST** `/api/auth/register`
- **POST** `/api/auth/login`
- **GET**  `/api/customers`
- **POST** `/api/customers`
- **PUT**  `/api/customers/{customer_id}`
- **GET**  `/api/barbers`
- **POST** `/api/barbers`
- **PUT**  `/api/barbers/{barber_id}`
- **GET**  `/api/services`
- **POST** `/api/services`
- **PUT**  `/api/services/{service_id}`
- **POST** `/api/appointments`
- **GET**  `/api/appointments`
- **PUT**  `/api/appointments/{appointment_id}/status`
- **GET**  `/api/barbers/{barber_id}/availability`
- **GET**  `/api/health`

### Analíticas (`/api/analytics`)
Rutas de métricas e informes (volumen de turnos, ingresos, etc.).

### Reseñas (`/api/reviews`)
CRUD de reseñas de clientes.

### Notificaciones (`/api/notifications`)
Plantillas y envío de notificaciones (email/push/otros, según implementación).

### WhatsApp (`/api/whatsapp`)
- **GET** `/api/whatsapp/status`
- **GET** `/api/whatsapp/qr-code`
- **POST** `/api/whatsapp/reconnect`
- **POST** `/api/whatsapp/disconnect`
- **POST** `/api/whatsapp/send-message`
- **POST** `/api/whatsapp/send-appointment-notification`
- **GET** `/api/whatsapp/messages`
- **GET** `/api/whatsapp/appointments/reminders`
- **POST** `/api/whatsapp/messages`

> El microservicio externo se configura con `WHATSAPP_SERVICE_URL` (por defecto `http://localhost:8002`).

---

## 🧱 Modelos principales (Pydantic)
- **User** (roles, hash de contraseña, JWT)
- **Customer**, **Barber**, **Service**
- **Appointment** (estado, horarios, disponibilidad)
- **Review** (puntuación/comentario)
- **WhatsAppMessage** / **WhatsAppStatus**

> Ver `models.py` para campos detallados y validaciones.

---

## ✅ Buenas prácticas del repo
- Confirmar que `.venv/`, `venv/`, `__pycache__/`, `.env` y archivos locales estén en **.gitignore**.
- Commits atómicos y descriptivos.
- Issues/PRs para nuevas features o bugs.

---

## 🧪 Próximos pasos sugeridos
- Añadir **tests** (pytest) y flujo CI.
- Especificar **roles** y permisos por endpoint.
- Plantillas de notificación parametrizables.
- Dockerización opcional (compose para mongo + api).
- Paginación y filtros en listados.

---

## 👤 Autor
**Alan Canto (Ajoca)** — Montevideo, Uruguay  
GitHub: https://github.com/ajoca

