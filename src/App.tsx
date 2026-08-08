import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./layouts/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "../public/profiles/LoginPage";
import { ReturnToWariatkowoPage } from "./pages/ReturnToWariatkowoPage";
import { ShoppingPage } from "./pages/ShoppingPage";
import { ShoppingProductsPage } from "./pages/ShoppingProductsPage";
import { ShopModePage } from "./pages/ShopModePage";
import { TasksPage } from "./pages/TasksPage";
import { WelcomePage } from "./pages/WelcomePage";
import { CalendarPage } from "./pages/CalendarPage";

export function App() {
  return (
    <Routes>
      <Route element={<WelcomePage />} path="/" />
      <Route
        element={
          <ProtectedRoute>
            <ShopModePage />
          </ProtectedRoute>
        }
        path="/zakupy/sklep"
      />
      <Route element={<LoginPage />} path="/logowanie" />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route element={<DashboardPage />} path="/dashboard" />
        <Route
          element={<ReturnToWariatkowoPage />}
          path="/powrot-do-wariatkowa"
        />
        <Route element={<TasksPage />} path="/zadania" />
        <Route element={<ShoppingPage />} path="/zakupy" />
        <Route element={<ShoppingProductsPage />} path="/zakupy/produkty" />
        <Route element={<CalendarPage />} path="/kalendarz" />
        <Route element={<Navigate replace to="/dashboard" />} path="*" />
      </Route>
    </Routes>
  );
}
