// ============================================================
// SISTEMA DE TICKETS EN TIEMPO REAL - Servidor
// Node.js + Express + Socket.IO
// ============================================================

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Servimos los archivos estáticos (las pantallas HTML)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// ESTADO DEL SISTEMA (en memoria)
// ============================================================

// Categorías de tickets: cada una tiene su prefijo y su contador
const CATEGORIAS = {
  A: { nombre: 'Atención general', contador: 0 },
  B: { nombre: 'Pagos', contador: 0 },
  C: { nombre: 'Consultas', contador: 0 },
};

// Cola de tickets esperando ser llamados (FIFO)
let cola = []; // [{ codigo: 'A1', categoria: 'A', creadoEn: timestamp }]

// Ticket que se está atendiendo actualmente
let ticketActual = null; // { codigo, puesto, llamadoEn }

// Historial de los últimos tickets llamados (mostramos los últimos 3)
let historial = []; // [{ codigo, puesto, llamadoEn }]

// ============================================================
// ESTADÍSTICAS: tickets atendidos por día (persistidas en JSON)
// ============================================================

const RUTA_STATS = path.join(__dirname, 'data', 'atendidos.json');

function cargarStats() {
  try {
    return JSON.parse(fs.readFileSync(RUTA_STATS, 'utf8'));
  } catch {
    return {}; // { '2026-07-01': 12, ... }
  }
}

function guardarStats(stats) {
  fs.mkdirSync(path.dirname(RUTA_STATS), { recursive: true });
  fs.writeFileSync(RUTA_STATS, JSON.stringify(stats, null, 2));
}

let atendidosPorDia = cargarStats();

// Devuelve la fecha de hoy en formato YYYY-MM-DD (hora local)
function fechaHoy() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// ============================================================
// HELPERS
// ============================================================

// Arma el "estado" completo que reciben las pantallas
function estadoActual() {
  return {
    ticketActual,
    ultimos3: historial.slice(0, 3),
    cola: cola.map(t => t.codigo),
    enEspera: cola.length,
    atendidosHoy: atendidosPorDia[fechaHoy()] || 0,
    atendidosPorDia,
    categorias: Object.fromEntries(
      Object.entries(CATEGORIAS).map(([k, v]) => [k, v.nombre])
    ),
  };
}

function emitirEstado() {
  io.emit('estado', estadoActual());
}

// ============================================================
// WEBSOCKETS (Socket.IO)
// ============================================================

io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  // Al conectarse, el cliente recibe el estado actual del sistema
  socket.emit('estado', estadoActual());

  // --- TOTEM: un cliente pide un nuevo ticket -----------------
  socket.on('nuevo-ticket', (categoria) => {
    if (!CATEGORIAS[categoria]) return;

    CATEGORIAS[categoria].contador++;
    const ticket = {
      codigo: `${categoria}${CATEGORIAS[categoria].contador}`,
      categoria,
      creadoEn: Date.now(),
    };
    cola.push(ticket);
    console.log(`🎫 Nuevo ticket: ${ticket.codigo} (${cola.length} en espera)`);

    // Le confirmamos SOLO a quien lo pidió cuál es su ticket
    socket.emit('ticket-emitido', ticket);

    // Y a TODOS les actualizamos el estado de la cola
    emitirEstado();
  });

  // --- PUESTO: un operador llama al siguiente ticket ----------
  socket.on('llamar-siguiente', (puesto) => {
    if (cola.length === 0) {
      socket.emit('cola-vacia');
      return;
    }

    const siguiente = cola.shift(); // sacamos el primero de la cola (FIFO)
    ticketActual = {
      codigo: siguiente.codigo,
      puesto,
      llamadoEn: Date.now(),
    };

    // Lo agregamos al principio del historial
    historial.unshift(ticketActual);
    if (historial.length > 20) historial.pop();

    // Sumamos 1 a los atendidos del día y persistimos
    const hoy = fechaHoy();
    atendidosPorDia[hoy] = (atendidosPorDia[hoy] || 0) + 1;
    guardarStats(atendidosPorDia);

    console.log(`📢 Llamando ${ticketActual.codigo} → Puesto ${puesto}`);

    // Evento específico para que la pantalla reproduzca el sonido
    io.emit('ticket-llamado', ticketActual);
    emitirEstado();
  });

  // --- PUESTO: volver a llamar al ticket actual ---------------
  socket.on('rellamar', () => {
    if (ticketActual) {
      io.emit('ticket-llamado', ticketActual);
    }
  });

  // --- CHAT: mensajes entre clientes conectados ---------------
  socket.on('chat:mensaje', ({ usuario, texto }) => {
    if (!texto || !texto.trim()) return;
    const mensaje = {
      usuario: usuario || 'Anónimo',
      texto: texto.trim().slice(0, 300),
      hora: new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    // Reenviamos el mensaje a TODOS los conectados (incluido el emisor)
    io.emit('chat:mensaje', mensaje);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

// ============================================================
// INICIO DEL SERVIDOR
// ============================================================

server.listen(PORT, () => {
  console.log('============================================');
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log('   Pantallas disponibles:');
  console.log(`   🖥️  Pantalla pública : http://localhost:${PORT}/pantalla.html`);
  console.log(`   🎫 Tótem de tickets  : http://localhost:${PORT}/totem.html`);
  console.log(`   👤 Puesto operador   : http://localhost:${PORT}/puesto.html`);
  console.log(`   📊 Estadísticas      : http://localhost:${PORT}/estadisticas.html`);
  console.log(`   💬 Chat              : http://localhost:${PORT}/chat.html`);
  console.log('============================================');
});
