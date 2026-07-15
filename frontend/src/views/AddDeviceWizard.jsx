import React, { useState } from "react";
import Header from "../components/Header";

export default function AddDeviceWizard({ token }) {
  const [step, setStep] = useState(1);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [isProvisioning, setIsProvisioning] = useState(false);

  const provisionDevice = async () => {
    setIsProvisioning(true);
    setStatusMsg("Pushing credentials to the EAGLE node...");
    
    try {
      const response = await fetch("http://192.168.4.1/provision", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({ ssid, password }),
      });

      if (response.ok) {
        setStatusMsg("Success! The node is rebooting onto your home network.");
        setStep(3);
      } else {
        setStatusMsg("Failed. Are you connected to the EAGLE-XXXX Wi-Fi network?");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("Connection failed. Make sure your computer is connected to the EAGLE-XXXX Wi-Fi network!");
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <div>
      <Header title="Add Device Wizard" subtitle="Provision new EAGLE-Δ nodes" />
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto", background: "var(--nt-surface)", borderRadius: "8px", marginTop: "2rem" }}>
        
        {/* Progress Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2rem", borderBottom: "1px solid var(--nt-line)", paddingBottom: "1rem" }}>
          <span style={{ color: step >= 1 ? "var(--nt-iris)" : "var(--nt-steel-dim)" }}>1. Connect Wi-Fi</span>
          <span style={{ color: step >= 2 ? "var(--nt-iris)" : "var(--nt-steel-dim)" }}>2. Provision</span>
          <span style={{ color: step >= 3 ? "var(--nt-iris)" : "var(--nt-steel-dim)" }}>3. Done</span>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ color: "var(--nt-steel)", marginBottom: "1rem" }}>Connect to the Node</h2>
            <div style={{ background: "var(--nt-void)", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem", border: "1px solid var(--nt-line)", textAlign: "left" }}>
              <p style={{ color: "var(--nt-steel-dim)", marginBottom: "1rem" }}>
                1. Power on your new EAGLE-Δ ESP32 node.
              </p>
              <p style={{ color: "var(--nt-steel-dim)", marginBottom: "1rem" }}>
                2. Open your computer's Wi-Fi menu and connect to the network starting with <strong>EAGLE-</strong>.
              </p>
              <p style={{ color: "var(--nt-warning)" }}>
                Note: It will say "No Internet", this is perfectly normal.
              </p>
            </div>
            
            <button 
              onClick={() => setStep(2)}
              style={{
                background: "var(--nt-iris)", color: "white", border: "none",
                padding: "1rem 2rem", fontSize: "1.1rem", borderRadius: "4px", cursor: "pointer",
                boxShadow: "0 4px 14px rgba(15, 98, 254, 0.4)"
              }}
            >
              I am connected to the EAGLE network
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <h2 style={{ color: "var(--nt-steel)", marginBottom: "1rem" }}>Enter Home Network</h2>
            <p style={{ color: "var(--nt-steel-dim)", marginBottom: "2rem" }}>
              Tell the node which Wi-Fi network it should connect to for daily operation.
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", color: "var(--nt-steel-dim)", marginBottom: "0.5rem" }}>Your Home Wi-Fi Name (SSID)</label>
              <input 
                type="text" 
                value={ssid} 
                onChange={(e) => setSsid(e.target.value)}
                placeholder="e.g. MyHomeNetwork"
                style={{ width: "100%", padding: "0.75rem", background: "var(--nt-void)", border: "1px solid var(--nt-line)", color: "white", borderRadius: "4px" }}
              />
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <label style={{ display: "block", color: "var(--nt-steel-dim)", marginBottom: "0.5rem" }}>Wi-Fi Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: "0.75rem", background: "var(--nt-void)", border: "1px solid var(--nt-line)", color: "white", borderRadius: "4px" }}
              />
            </div>

            {statusMsg && (
              <p style={{ color: "var(--nt-warning)", marginBottom: "1rem", textAlign: "center" }}>
                {statusMsg}
              </p>
            )}

            <button 
              onClick={provisionDevice}
              disabled={isProvisioning}
              style={{
                width: "100%", background: isProvisioning ? "var(--nt-line)" : "var(--nt-iris)", color: "white", border: "none",
                padding: "1rem", fontSize: "1.1rem", borderRadius: "4px", cursor: isProvisioning ? "not-allowed" : "pointer"
              }}
            >
              {isProvisioning ? "Sending..." : "Send Credentials to Node"}
            </button>
            
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <button 
                onClick={() => setStep(1)}
                style={{ background: "transparent", border: "none", color: "var(--nt-steel-dim)", cursor: "pointer", textDecoration: "underline" }}
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ color: "#24a148", marginBottom: "1rem" }}>✓ Setup Complete!</h2>
            <p style={{ color: "var(--nt-steel-dim)", marginBottom: "2rem" }}>
              The node is now rebooting. <br/><br/>
              <strong>Important:</strong> Reconnect your computer to your normal Home Wi-Fi network now!
            </p>
            <p style={{ color: "var(--nt-steel-dim)", marginBottom: "2rem" }}>
              Once you are back on your home network, the node will automatically appear on the Dashboard.
            </p>
            <button 
              onClick={() => { setStep(1); setSsid(""); setPassword(""); setStatusMsg(""); }}
              style={{
                background: "var(--nt-line)", color: "white", border: "none",
                padding: "0.75rem 1.5rem", borderRadius: "4px", cursor: "pointer"
              }}
            >
              Add Another Node
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}
