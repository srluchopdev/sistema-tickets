# Sistema de Tickets en Tiempo Real 🎫

TP: Estrategias y mecanismos para desarrollo de App web en tiempo real.
Stack: **Node.js + Express + Socket.IO**.

## Cómo ejecutarlo

```powershell
npm install
npm start
```

Después abrir en el navegador (idealmente en varias pestañas/ventanas a la vez para ver el tiempo real):

| Pantalla | URL | Función |
|---|---|---|
| 🖥️ Pantalla pública | http://localhost:3000/pantalla.html | Muestra el turno llamado en grande + los últimos 3. Reproduce sonido y voz en cada llamado. |
| 🎫 Tótem | http://localhost:3000/totem.html | El cliente saca su ticket eligiendo categoría (A, B o C). |
| 👤 Puesto | http://localhost:3000/puesto.html | El operador llama al siguiente ticket de la cola. |
| 📊 Estadísticas | http://localhost:3000/estadisticas.html | Tickets atendidos por día (punto 3.b). |
| 💬 Chat | http://localhost:3000/chat.html | Chat simple con sockets (punto 4). |

> ⚠️ **Sonido:** los navegadores bloquean el audio hasta que el usuario interactúa con la página. En la pantalla pública hay que hacer un clic en el botón amarillo "Activar sonido" una sola vez.

## Cómo funciona

- El servidor mantiene en memoria la cola de tickets (FIFO), el ticket actual y el historial.
- Los atendidos por día se persisten en `data/atendidos.json` para que no se pierdan al reiniciar.
- Toda la comunicación entre pantallas es por WebSockets (Socket.IO): cuando pasa algo (nuevo ticket, llamado), el servidor hace `io.emit(...)` y todas las pantallas conectadas se actualizan al instante, sin recargar.

### Eventos de Socket.IO

| Evento | Dirección | Descripción |
|---|---|---|
| `nuevo-ticket` | cliente → servidor | El tótem pide un ticket de una categoría |
| `ticket-emitido` | servidor → cliente | Confirma el ticket solo a quien lo sacó |
| `llamar-siguiente` | cliente → servidor | El puesto llama al próximo de la cola |
| `ticket-llamado` | servidor → todos | Dispara el sonido y la actualización de la pantalla |
| `estado` | servidor → todos | Estado completo (actual, últimos 3, en espera, stats) |
| `chat:mensaje` | ambos sentidos | Mensajes del chat |

## Punto 1 — ¿Qué son las aplicaciones en tiempo real?

Son aplicaciones donde la información se actualiza en el momento en que ocurre un cambio, sin que el usuario tenga que recargar la página ni pedir los datos manualmente. El servidor "empuja" (push) las novedades a todos los clientes conectados apenas suceden. Ejemplos: chats (WhatsApp Web), notificaciones, tableros de turnos, cotizaciones del dólar, juegos online, documentos colaborativos como Google Docs.

## Punto 2 — ¿Qué son los WebSockets?

Es un protocolo de comunicación que establece una conexión persistente y bidireccional entre el cliente y el servidor sobre una única conexión TCP. A diferencia de HTTP tradicional (donde el cliente pregunta y el servidor responde, y la conexión se cierra), con WebSockets el canal queda abierto: cualquiera de los dos puede enviar mensajes en cualquier momento. Esto lo hace ideal para tiempo real porque evita el "polling" (estar preguntando al servidor cada X segundos), reduce la latencia y el tráfico. En este proyecto usamos Socket.IO, una librería que usa WebSockets por debajo y agrega reconexión automática, eventos con nombre y compatibilidad con navegadores viejos.
