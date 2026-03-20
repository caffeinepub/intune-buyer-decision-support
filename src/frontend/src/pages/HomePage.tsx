import { useNavigate } from "@tanstack/react-router";
import {
  BarChart2,
  FileBarChart,
  LayoutDashboard,
  RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import { Layout } from "../components/Layout";

const navCards = [
  {
    to: "/" as const,
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "View KPI summary and top re-buy candidates",
    color: "#F5C518",
  },
  {
    to: "/style-analysis" as const,
    icon: BarChart2,
    title: "Style Analysis",
    description: "Analyse performance by style and category",
    color: "#F5C518",
  },
  {
    to: "/rebuy-size" as const,
    icon: RefreshCw,
    title: "Re-buy & Size Planning",
    description: "Supply chain metrics and size allocation",
    color: "#F5C518",
  },
  {
    to: "/reports" as const,
    icon: FileBarChart,
    title: "Reports",
    description: "Full data table and CSV export",
    color: "#F5C518",
  },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <Layout title="Home">
      <div className="max-w-4xl mx-auto py-4">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-center gap-6"
          style={{ background: "#0f172a" }}
        >
          <div
            className="rounded-xl px-6 py-4 shrink-0"
            style={{ background: "white" }}
          >
            <img
              src="/assets/uploads/image-1-1.png"
              alt="INTUNE"
              className="h-12 w-auto"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight">
              Welcome to INTUNE Buyer DSS
            </h2>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "rgba(148,163,184,1)" }}
            >
              Your data-driven decision support system for re-buy optimization
              at Shoppers Stop. Analyse sales velocity, inventory cover, and
              size demand to make confident buying decisions.
            </p>
          </div>
        </motion.div>

        {/* Navigation Cards */}
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "rgba(100,116,139,1)" }}
        >
          Quick Navigation
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {navCards.map((card, i) => (
            <motion.button
              key={card.to}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              onClick={() => navigate({ to: card.to })}
              className="group text-left rounded-xl border p-5 transition-all duration-200 hover:shadow-lg cursor-pointer"
              style={{
                background: "white",
                borderColor: "#e2e8f0",
              }}
              data-ocid={`home.${card.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.card`}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors duration-200"
                style={{ background: "rgba(245,197,24,0.12)" }}
              >
                <card.icon
                  className="w-5 h-5 transition-colors duration-200"
                  style={{ color: "#d97706" }}
                />
              </div>
              <h3
                className="font-semibold text-sm mb-1 transition-colors duration-200 group-hover:text-amber-600"
                style={{ color: "#0f172a" }}
              >
                {card.title}
              </h3>
              <p className="text-xs" style={{ color: "rgba(100,116,139,1)" }}>
                {card.description}
              </p>
            </motion.button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
