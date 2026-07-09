import { Link, Route, Routes } from "react-router-dom";
import { LeadsList } from "./pages/LeadsList";
import { LeadDetail } from "./pages/LeadDetail";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-gray-900">
            Winforge
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Routes>
          <Route path="/" element={<LeadsList />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
        </Routes>
      </main>
    </div>
  );
}
