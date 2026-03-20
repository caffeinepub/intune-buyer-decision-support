import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface LayoutProps {
  children: ReactNode;
  title: string;
}

export function Layout({ children, title }: LayoutProps) {
  return (
    <div className="min-h-screen flex" style={{ background: "#f1f5f9" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col ml-60">
        <TopBar title={title} />
        <main className="flex-1 p-6">{children}</main>
        <footer
          className="px-6 py-3 text-xs text-center"
          style={{ color: "rgba(100,116,139,1)" }}
        >
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80"
          >
            caffeine.ai
          </a>
        </footer>
      </div>
    </div>
  );
}
