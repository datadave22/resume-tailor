import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  Users,
  Activity,
  Sparkles,
  LogOut,
  Menu,
  X
} from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
  activeNav: "overview" | "users" | "prompts";
}

const navItems = [
  { id: "overview" as const, label: "Overview", href: "/admin", icon: Activity },
  { id: "users" as const, label: "Users", href: "/admin/users", icon: Users },
  { id: "prompts" as const, label: "Prompt Testing", href: "/admin/prompts", icon: Sparkles },
];

export function AdminLayout({ children, activeNav }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
            <Link href="/dashboard">
              <Button className="mt-4">Return to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary rounded-md">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm sm:text-base">Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">User View</Button>
              <Button variant="ghost" size="icon" className="sm:hidden">
                <Activity className="h-4 w-4" />
              </Button>
            </Link>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t px-4 py-2 bg-card">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link key={item.id} href={item.href}>
                  <Button
                    variant={activeNav === item.id ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setMobileNavOpen(false)}
                    data-testid={`nav-mobile-${item.id}`}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <div className="flex">
        <aside className="hidden md:block w-56 lg:w-64 border-r bg-card min-h-[calc(100vh-57px)] p-3">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link key={item.id} href={item.href}>
                <Button
                  variant={activeNav === item.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  data-testid={`nav-${item.id}`}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
