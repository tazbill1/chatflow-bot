import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MessageSquare, TrendingUp, Clock } from "lucide-react";

const ADMIN_PASS = "werkadmin2026";

type Lead = {
  id: string;
  name: string;
  email: string;
  business: string | null;
  phone: string | null;
  contact_preference: string | null;
  type: string;
  summary: string | null;
  created_at: string;
  conversation: any;
};

type Session = {
  id: string;
  session_id: string;
  message_count: number;
  led_to_lead: boolean;
  first_message_at: string;
  last_message_at: string;
  topics: string[] | null;
};

function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pass === ADMIN_PASS) {
      sessionStorage.setItem("werkbot-admin", "1");
      onAuth();
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Admin Access</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={pass}
              onChange={(e) => { setPass(e.target.value); setError(false); }}
              placeholder="Enter admin password"
              className="w-full bg-muted text-card-foreground rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            {error && <p className="text-destructive text-xs">Incorrect password</p>}
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Enter
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, sub }: { title: string; value: string | number; icon: any; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-card-foreground mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadsTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) return <p className="text-muted-foreground text-sm py-8 text-center">No leads yet</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Name</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Email</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden md:table-cell">Business</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden lg:table-cell">Phone</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Type</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden md:table-cell">Summary</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="py-3 px-2 text-card-foreground font-medium">{lead.name}</td>
              <td className="py-3 px-2 text-card-foreground">{lead.email}</td>
              <td className="py-3 px-2 text-card-foreground hidden md:table-cell">{lead.business || "—"}</td>
              <td className="py-3 px-2 text-card-foreground hidden lg:table-cell">{lead.phone || "—"}</td>
              <td className="py-3 px-2">
                <Badge variant={lead.type === "sales" ? "default" : "secondary"}>
                  {lead.type}
                </Badge>
              </td>
              <td className="py-3 px-2 text-muted-foreground max-w-[200px] truncate hidden md:table-cell">{lead.summary || "—"}</td>
              <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                {new Date(lead.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionsTable({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) return <p className="text-muted-foreground text-sm py-8 text-center">No sessions yet</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Session</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Messages</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Lead?</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden md:table-cell">Started</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden md:table-cell">Last Active</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="py-3 px-2 text-card-foreground font-mono text-xs">{s.session_id.slice(0, 8)}…</td>
              <td className="py-3 px-2 text-card-foreground">{s.message_count}</td>
              <td className="py-3 px-2">
                {s.led_to_lead ? (
                  <Badge variant="default">Yes</Badge>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </td>
              <td className="py-3 px-2 text-muted-foreground whitespace-nowrap hidden md:table-cell">
                {new Date(s.first_message_at).toLocaleString()}
              </td>
              <td className="py-3 px-2 text-muted-foreground whitespace-nowrap hidden md:table-cell">
                {new Date(s.last_message_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("werkbot-admin") === "1");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authed) return;
    async function load() {
      setLoading(true);
      const [leadsRes, sessionsRes] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("chat_sessions").select("*").order("last_message_at", { ascending: false }).limit(100),
      ]);
      if (leadsRes.data) setLeads(leadsRes.data as Lead[]);
      if (sessionsRes.data) setSessions(sessionsRes.data as Session[]);
      setLoading(false);
    }
    load();
  }, [authed]);

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} />;

  const totalSessions = sessions.length;
  const totalLeads = leads.length;
  const conversionRate = totalSessions > 0 ? ((sessions.filter(s => s.led_to_lead).length / totalSessions) * 100).toFixed(1) : "0";
  const avgMessages = totalSessions > 0 ? (sessions.reduce((a, s) => a + s.message_count, 0) / totalSessions).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Werkbot Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Lead capture & chat analytics</p>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem("werkbot-admin"); setAuthed(false); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Logout
          </button>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total Leads" value={totalLeads} icon={Users} />
              <StatCard title="Chat Sessions" value={totalSessions} icon={MessageSquare} />
              <StatCard title="Conversion Rate" value={`${conversionRate}%`} icon={TrendingUp} />
              <StatCard title="Avg Messages" value={avgMessages} icon={Clock} sub="per session" />
            </div>

            <Tabs defaultValue="leads" className="w-full">
              <TabsList>
                <TabsTrigger value="leads">Leads ({totalLeads})</TabsTrigger>
                <TabsTrigger value="sessions">Sessions ({totalSessions})</TabsTrigger>
              </TabsList>
              <TabsContent value="leads">
                <Card>
                  <CardContent className="pt-6">
                    <LeadsTable leads={leads} />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="sessions">
                <Card>
                  <CardContent className="pt-6">
                    <SessionsTable sessions={sessions} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
