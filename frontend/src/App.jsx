import React, { useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import Sidebar from "./components/Sidebar.jsx";
import LoginView from "./views/LoginView.jsx";
import RegisterView from "./views/RegisterView.jsx";
import ProvisionView from "./views/ProvisionView.jsx";
import DashboardOverview from "./views/DashboardOverview.jsx";
import AboutView from "./views/AboutView.jsx";
import PresenceView from "./views/PresenceView.jsx";
import MovementView from "./views/MovementView.jsx";
import EnvironmentView from "./views/EnvironmentView.jsx";
import AnalyticsView from "./views/AnalyticsView.jsx";
import SettingsView from "./views/SettingsView.jsx";
import CSIVisualizationView from "./views/CSIVisualizationView.jsx";
import NodeManagementView from "./views/NodeManagementView.jsx";
import AddDeviceWizard from "./views/AddDeviceWizard.jsx";

function ConsoleShell({ token, children }) {
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="nt-app-shell">
      <Sidebar />
      <main className="nt-main">{children}</main>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(null);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginView onLogin={setToken} />} />
        <Route path="/register" element={<RegisterView onLogin={setToken} />} />
        <Route
          path="/provision"
          element={
            <ConsoleShell token={token}>
              <ProvisionView token={token} />
            </ConsoleShell>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ConsoleShell token={token}>
              <DashboardOverview token={token} />
            </ConsoleShell>
          }
        />
        <Route
          path="/csi-visualization"
          element={
            <ConsoleShell token={token}>
              <CSIVisualizationView token={token} />
            </ConsoleShell>
          }
        />
        <Route
          path="/presence"
          element={
            <ConsoleShell token={token}>
              <PresenceView />
            </ConsoleShell>
          }
        />
        <Route
          path="/nodes"
          element={
            <ConsoleShell token={token}>
              <NodeManagementView token={token} />
            </ConsoleShell>
          }
        />
        <Route
          path="/wizard"
          element={
            <ConsoleShell token={token}>
              <AddDeviceWizard token={token} />
            </ConsoleShell>
          }
        />
        <Route
          path="/movement"
          element={
            <ConsoleShell token={token}>
              <MovementView />
            </ConsoleShell>
          }
        />
        <Route
          path="/environment"
          element={
            <ConsoleShell token={token}>
              <EnvironmentView />
            </ConsoleShell>
          }
        />
        <Route
          path="/analytics"
          element={
            <ConsoleShell token={token}>
              <AnalyticsView />
            </ConsoleShell>
          }
        />
        <Route
          path="/about"
          element={
            <ConsoleShell token={token}>
              <AboutView />
            </ConsoleShell>
          }
        />
        <Route
          path="/settings"
          element={
            <ConsoleShell token={token}>
              <SettingsView />
            </ConsoleShell>
          }
        />
        <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </HashRouter>
  );
}
