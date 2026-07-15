const wifi = require("node-wifi");

// Initialize wifi module
wifi.init({
  iface: null // network interface, choose a random one if multiple
});

/**
 * Scan for local Wi-Fi networks to populate the Add Device wizard
 */
function scanNetworks(req, res) {
  wifi.scan((error, networks) => {
    if (error) {
      console.error("[eagle-delta] Wi-Fi scan error:", error);
      return res.status(500).json({ ok: false, error: "Failed to scan networks" });
    }
    
    // Deduplicate SSIDs (sometimes 2.4/5GHz share names but have diff BSSIDs)
    const uniqueSSIDs = [...new Set(networks.map(n => n.ssid).filter(s => s && s.trim().length > 0))];
    return res.json({ ok: true, networks: uniqueSSIDs });
  });
}

module.exports = {
  scanNetworks
};
