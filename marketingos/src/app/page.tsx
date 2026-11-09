'use client';

import React, { lazy, Suspense, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { useAppStore, type ViewId } from '@/stores/app-store';
import { LoginView } from '@/components/views/login-view';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  Link2,
  Bot,
  Palette,
  Users,
  Search,
  Megaphone,
  FileText,
  BarChart3,
  UserCog,
  Cpu,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  Zap,
  Menu,
  X,
  Bell,
  Network,
  Plug,
} from 'lucide-react';

// Lazy load views
const DashboardView = lazy(() => import('@/components/views/dashboard-view').then(m => ({ default: m.DashboardView })));
const SocialAccountsView = lazy(() => import('@/components/views/social-accounts-view').then(m => ({ default: m.SocialAccountsView })));
const AiCommandView = lazy(() => import('@/components/views/ai-command-view').then(m => ({ default: m.AiCommandView })));
const MediaStudioView = lazy(() => import('@/components/views/media-studio-view').then(m => ({ default: m.MediaStudioView })));
const CrmView = lazy(() => import('@/components/views/crm-view').then(m => ({ default: m.CrmView })));
const SeoView = lazy(() => import('@/components/views/seo-view').then(m => ({ default: m.SeoView })));
const CampaignsView = lazy(() => import('@/components/views/campaigns-view').then(m => ({ default: m.CampaignsView })));
const ContentView = lazy(() => import('@/components/views/content-view').then(m => ({ default: m.ContentView })));
const AnalyticsView = lazy(() => import('@/components/views/analytics-view').then(m => ({ default: m.AnalyticsView })));
const TeamView = lazy(() => import('@/components/views/team-view').then(m => ({ default: m.TeamView })));
const WorkforceView = lazy(() => import('@/components/views/workforce-view').then(m => ({ default: m.WorkforceView })));
const AiAgentsView = lazy(() => import('@/components/views/ai-agents-view').then(m => ({ default: m.AiAgentsView })));
const SettingsView = lazy(() => import('@/components/views/settings-view').then(m => ({ default: m.SettingsView })));
const IntegrationsView = lazy(() => import('@/components/views/integrations-view').then(m => ({ default: m.IntegrationsView })));

const views: Record<ViewId, React.LazyExoticComponent<React.ComponentType>> = {
  dashboard: DashboardView,
  workforce: WorkforceView,
  'social-accounts': SocialAccountsView,
  'ai-command': AiCommandView,
  'media-studio': MediaStudioView,
  crm: CrmView,
  seo: SeoView,
  campaigns: CampaignsView,
  content: ContentView,
  analytics: AnalyticsView,
  team: TeamView,
  'ai-agents': AiAgentsView,
  integrations: IntegrationsView,
  subscriptions: SettingsView,
  settings: SettingsView,
};

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'CEO Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, section: 'Main' },
  { id: 'workforce', label: 'AI Workforce', icon: <Network className="w-4 h-4" />, badge: '2,000', section: 'Workforce' },
  { id: 'integrations', label: 'Integrations', icon: <Plug className="w-4 h-4" />, badge: '120', section: 'Connect' },
  { id: 'social-accounts', label: 'Social Accounts', icon: <Link2 className="w-4 h-4" />, badge: 'OAuth', section: 'Connect' },
  { id: 'ai-command', label: 'AI Command', icon: <Bot className="w-4 h-4" />, section: 'AI' },
  { id: 'media-studio', label: 'Media Studio', icon: <Palette className="w-4 h-4" />, section: 'AI' },
  { id: 'ai-agents', label: 'AI Agents', icon: <Cpu className="w-4 h-4" />, section: 'AI' },
  { id: 'crm', label: 'CRM', icon: <Users className="w-4 h-4" />, section: 'Marketing' },
  { id: 'seo', label: 'SEO Engine', icon: <Search className="w-4 h-4" />, section: 'Marketing' },
  { id: 'campaigns', label: 'Campaigns', icon: <Megaphone className="w-4 h-4" />, section: 'Marketing' },
  { id: 'content', label: 'Content', icon: <FileText className="w-4 h-4" />, section: 'Marketing' },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" />, section: 'Reports' },
  { id: 'team', label: 'Team', icon: <UserCog className="w-4 h-4" />, section: 'Management' },
  { id: 'subscriptions', label: 'Subscription', icon: <CreditCard className="w-4 h-4" />, section: 'Management' },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, section: 'Management' },
];

const sections = ['Main', 'Workforce', 'Connect', 'AI', 'Marketing', 'Reports', 'Management'];

function ViewFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading view...</p>
      </div>
    </div>
  );
}

function Sidebar() {
  const { user, activeView, setActiveView, isSidebarOpen, toggleSidebar, setSidebarOpen, logout } = useAppStore();

  const handleNavClick = (id: ViewId) => {
    setActiveView(id);
    // Close sidebar on mobile
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-full flex flex-col
        bg-card/80 backdrop-blur-xl border-r border-border/50
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'w-64' : 'w-[70px]'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border/50 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {isSidebarOpen && (
            <span className="font-bold text-lg bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent whitespace-nowrap">
              MarketingOS
            </span>
          )}
          <Button variant="ghost" size="icon" className="ml-auto md:hidden h-8 w-8" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3 px-2">
          <div className="space-y-1">
            {sections.map((section) => {
              const sectionItems = navItems.filter(n => n.section === section);
              if (sectionItems.length === 0) return null;
              return (
                <div key={section} className="mb-3">
                  {isSidebarOpen && (
                    <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {section}
                    </p>
                  )}
                  {sectionItems.map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <Tooltip key={item.id} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleNavClick(item.id)}
                            className={`
                              w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                              transition-all duration-200 group relative
                              ${isActive
                                ? 'bg-gradient-to-r from-primary/15 to-chart-2/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                              }
                              ${!isSidebarOpen ? 'justify-center px-0' : ''}
                            `}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                            )}
                            <span className={`shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                              {item.icon}
                            </span>
                            {isSidebarOpen && (
                              <span className="flex-1 text-left truncate">{item.label}</span>
                            )}
                            {isSidebarOpen && item.badge && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0">
                                {item.badge}
                              </Badge>
                            )}
                          </button>
                        </TooltipTrigger>
                        {!isSidebarOpen && (
                          <TooltipContent side="right" className="font-medium">
                            {item.label}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Collapse button */}
        <div className="hidden md:flex px-2 py-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={toggleSidebar}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${!isSidebarOpen ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </aside>
    </>
  );
}

function AppHeader() {
  const { user, activeView, setSidebarOpen, logout } = useAppStore();
  const currentNav = navItems.find(n => n.id === activeView);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={() => setSidebarOpen(true)}>
        <Menu className="w-5 h-5" />
      </Button>

      {currentNav && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{currentNav.icon}</span>
          <h1 className="font-semibold text-lg">{currentNav.label}</h1>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gradient-to-br from-primary to-chart-2 text-white text-xs font-bold">
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-tight">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={logout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sign Out</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

function AppContent() {
  const { activeView, isSidebarOpen } = useAppStore();
  const ActiveComponent = views[activeView];

  return (
    <div className={`flex h-screen bg-background transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-[70px]'}`}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <ScrollArea className="flex-1">
          <main className="p-4 md:p-6">
            <Suspense fallback={<ViewFallback />}>
              {ActiveComponent ? <ActiveComponent /> : <p className="text-muted-foreground">View not found</p>}
            </Suspense>
          </main>
        </ScrollArea>
        <footer className="mt-auto shrink-0 border-t px-4 py-2 text-center text-[10px] text-muted-foreground bg-card/50">
          MarketingOS — AI-Powered Marketing Operating System
        </footer>
      </div>
    </div>
  );
}

function AppShell() {
  const { isAuthenticated, isLoading, setUser } = useAppStore();

  useEffect(() => {
    const token = localStorage.getItem('mos_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUser({ ...data.user, token });
          } else {
            localStorage.removeItem('mos_token');
            setUser(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('mos_token');
          setUser(null);
        });
    } else {
      setUser(null);
    }
  }, [setUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center animate-pulse">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-muted-foreground">Loading MarketingOS...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginView />;
  return <AppContent />;
}

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AppShell />
    </ThemeProvider>
  );
}
