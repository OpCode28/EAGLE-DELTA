# Debug Session: esp32-csi-offline
- **Status**: [OPEN]
- **Issue**: ESP32 nodes are not showing as connected in Netra32, and CSI data is not appearing in the backend/dashboard.
- **Debug Server**: Pending
- **Log File**: .dbg/trae-debug-log-esp32-csi-offline.ndjson

## Reproduction Steps
1. Start the backend on port 4032.
2. Start the Netra32 frontend/Electron app.
3. Power and flash the ESP32 node.
4. Observe that login works, but no real node appears in the dashboard and no CSI data is visible.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The ESP32 firmware is still pointing at the wrong backend host IP, so packets never reach the laptop. | High | Low | Pending |
| B | The backend only accepts HTTP telemetry, but the ESP32 firmware is sending UDP or a different payload format. | High | Med | Pending |
| C | The ESP32 is sending data, but `node_key` / node ID is missing or mismatched, so the node never appears in the dashboard. | Med | Med | Pending |
| D | The backend receives telemetry, but it fails before persistence or SSE broadcast, so the frontend sees no node updates. | Med | Med | Pending |
| E | The frontend is connected, but token/auth-protected node fetches fail after login, hiding otherwise healthy backend data. | Low | Low | Pending |

## Log Evidence
- `nodeController.getAllNodes` returned only historical dummy nodes at first, showing the dashboard/backend auth path works.
- Direct POST to `http://localhost:4032/api/netra32/telemetry` with `node_key=probe-node-1` succeeded and immediately created a new node.
- Instrumentation recorded:
  - telemetry ingest hit for `probe-node-1`
  - telemetry persisted successfully
  - subsequent node list included `probe-node-1`
- Current host IPv4 on the laptop is `10.159.43.174`.
- Arduino firmware and ESP-IDF Kconfig were still defaulting backend host to `192.168.1.50`.

## Verification Conclusion
- Hypothesis A: **Confirmed**. Firmware/backend host mismatch is a real blocker.
- Hypothesis B: **Partially confirmed as a possible secondary issue**. Backend accepts HTTP JSON at `/api/netra32/telemetry`; ESP-IDF also has a parallel UDP path, but UDP is not used by backend node registration.
- Hypothesis C: **Not currently supported by evidence**. Backend creates nodes correctly when a valid `node_key` arrives.
- Hypothesis D: **Rejected for backend path**. Ingest, persistence, and node listing all work when telemetry reaches the backend.
- Hypothesis E: **Rejected**. Dashboard auth and `/nodes` retrieval are working.
