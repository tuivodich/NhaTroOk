import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import StaffShell from "./StaffShell";

import TenantShell from "./TenantShell";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dang-nhap" element={<Login />} />
      <Route path="/app/*" element={<StaffShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/toi" element={<TenantShell />} />
    </Routes>
  );
}
