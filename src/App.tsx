import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import StaffShell from "./StaffShell";
import TenantShell from "./TenantShell";
import RoomList from "./pages/public/RoomList";
import RoomDetail from "./pages/public/RoomDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dang-nhap" element={<Login />} />
      <Route path="/phong" element={<RoomList />} />
      <Route path="/phong/:id" element={<RoomDetail />} />
      <Route path="/app/*" element={<StaffShell />} />
      <Route path="/toi" element={<TenantShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
