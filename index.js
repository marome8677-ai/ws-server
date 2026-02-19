const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

// قائمة العملاء
let clients = [];

// مدة الاحتفاظ بالعميل بعد الانفصال (مللي ثانية)
const GRACE_PERIOD = 30 * 60 * 1000; // 30 دقيقة

wss.on('connection', function connection(ws) {
  // إضافة العميل مع وقت آخر اتصال
  let clientObj = { ws, lastActive: Date.now(), timeout: null };
  clients.push(clientObj);

  console.log("New client connected. Total clients:", clients.length);

  ws.on('message', function incoming(message) {
    // إرسال الرسالة لكل العملاء ما عدا المرسل
    clients.forEach(client => {
      if (client.ws !== ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  });

  ws.on('close', () => {
    // عند الانفصال، اترك العميل في الذاكرة لمدة GRACE_PERIOD
    clientObj.timeout = setTimeout(() => {
      clients = clients.filter(c => c !== clientObj);
      console.log("Client removed after grace period. Remaining:", clients.length);
    }, GRACE_PERIOD);

    console.log("Client disconnected. Will remove after grace period if not reconnected.");
  });

  ws.on('pong', () => {
    clientObj.lastActive = Date.now();
  });
});

// Ping داخلي للتحقق من العملاء النشطين ولمنع السيرفر من النوم
setInterval(() => {
  const now = Date.now();
  clients.forEach(client => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.ping();

      // إزالة أي عميل تجاوز GRACE_PERIOD بشكل نهائي حتى لو لم يغلق الاتصال
      if (client.lastActive + GRACE_PERIOD < now) {
        if (client.timeout) clearTimeout(client.timeout);
        client.ws.terminate();
        clients = clients.filter(c => c !== client);
        console.log("Client forcefully removed due to inactivity.");
      }
    }
  });
}, 30000);

console.log(`WebSocket server running on port ${PORT}`);
