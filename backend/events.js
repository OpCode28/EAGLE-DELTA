// eagle-delta/events.js
// A tiny in-process event bus. When the telemetry controller stores a new
// reading it emits "telemetry", and the SSE route (mounted in server.js)
// relays that straight to every connected Netra32 browser tab — no
// polling, no page refresh.

const { EventEmitter } = require("events");

class TelemetryBus extends EventEmitter {}

const bus = new TelemetryBus();
bus.setMaxListeners(50);

module.exports = bus;
