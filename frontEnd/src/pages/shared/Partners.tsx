import { partners, personnel } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Users, UserCheck } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/hooks/use-user";

export default function Partners() {
  const { isProgramManager } = useUser();
  const [search, setSearch] = useState('');
  const filtered = partners.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.district.toLowerCase().includes(search.toLowerCase()));
  const filteredPersonnel = personnel.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Partners & Personnel</h1>
          <p className="page-description">Manage institutional partners and program staff</p>
        </div>
        {isProgramManager() && (
          <Button><Plus className="h-4 w-4 mr-1" /> Add Partner</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Partners" value={partners.length} subtitle={`${partners.filter(p => p.status === 'Active').length} Active`} icon={Building2} variant="primary" />
        <StatCard title="YBFs & Instructors" value={personnel.filter(p => p.role !== 'Enumerator').length} icon={UserCheck} />
        <StatCard title="Total Youth Served" value={partners.reduce((s, p) => s + p.youthCount, 0)} icon={Users} variant="success" />
      </div>

      <input
        type="text"
        placeholder="Search partners or personnel..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full sm:w-72 px-3 py-2 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <Tabs defaultValue="partners">
        <TabsList>
          <TabsTrigger value="partners">Partners ({filtered.length})</TabsTrigger>
          <TabsTrigger value="personnel">Personnel ({filteredPersonnel.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="partners">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Institution</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Assigned YBF</TableHead>
                    <TableHead className="text-right">Youth</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant={p.type === 'TVET' ? 'default' : 'secondary'}>{p.type}</Badge></TableCell>
                      <TableCell>{p.district}</TableCell>
                      <TableCell>{p.assignedYBF}</TableCell>
                      <TableCell className="text-right font-semibold">{p.youthCount}</TableCell>
                      <TableCell><Badge variant={p.status === 'Active' ? 'default' : 'outline'}>{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personnel">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPersonnel.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="secondary">{p.role}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell>{p.assignedTo}</TableCell>
                      <TableCell><Badge variant={p.status === 'Active' ? 'default' : 'outline'}>{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
