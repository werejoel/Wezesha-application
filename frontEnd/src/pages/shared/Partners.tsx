import { partners as initialPartners, personnel } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Users, UserCheck } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useUser } from "@/hooks/use-user";

export default function Partners() {
  const { isProgramManager, isYBF, user } = useUser();
  const [search, setSearch] = useState('');
  const [partners, setPartners] = useState(initialPartners);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'TVET',
    district: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    status: 'Active',
    startDate: new Date().toISOString().slice(0, 10),
  });
  const canAddPartner = isProgramManager() || isYBF();
  const filtered = partners.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.district.toLowerCase().includes(search.toLowerCase()));
  const filteredPersonnel = personnel.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleAddPartner = () => {
    const newPartner = {
      id: `P${String(partners.length + 1).padStart(3, '0')}`,
      name: form.name || `New Partner ${partners.length + 1}`,
      type: form.type as 'TVET' | 'CBO',
      location: form.district,
      district: form.district,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      contactEmail: form.contactEmail,
      status: form.status as 'Active' | 'Inactive',
      startDate: form.startDate,
      cohortsCount: 1,
      assignedYBF: user?.name ?? 'Unassigned',
      youthCount: 0,
    };
    setPartners([newPartner, ...partners]);
    setAddOpen(false);
    setForm({
      name: '',
      type: 'TVET',
      district: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      status: 'Active',
      startDate: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Partners & Personnel</h1>
          <p className="page-description">Manage institutional partners and program staff</p>
        </div>
        {canAddPartner && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add Partner</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Partner</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="partner-name">Institution Name</Label>
                  <Input
                    id="partner-name"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="E.g. City Youth Centre"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="partner-district">District</Label>
                    <Input
                      id="partner-district"
                      value={form.district}
                      onChange={e => setForm({ ...form, district: e.target.value })}
                      placeholder="Nairobi"
                    />
                  </div>
                  <div>
                    <Label htmlFor="partner-type">Type</Label>
                    <select
                      id="partner-type"
                      value={form.type}
                      onChange={e => setForm({ ...form, type: e.target.value as 'TVET' | 'CBO' })}
                      className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="TVET">TVET</option>
                      <option value="CBO">CBO</option>
                    </select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="partner-contact">Contact Name</Label>
                    <Input
                      id="partner-contact"
                      value={form.contactName}
                      onChange={e => setForm({ ...form, contactName: e.target.value })}
                      placeholder="James Mwangi"
                    />
                  </div>
                  <div>
                    <Label htmlFor="partner-phone">Contact Phone</Label>
                    <Input
                      id="partner-phone"
                      value={form.contactPhone}
                      onChange={e => setForm({ ...form, contactPhone: e.target.value })}
                      placeholder="+254712345678"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="partner-email">Contact Email</Label>
                  <Input
                    id="partner-email"
                    value={form.contactEmail}
                    onChange={e => setForm({ ...form, contactEmail: e.target.value })}
                    placeholder="partner@domain.com"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="partner-status">Status</Label>
                    <select
                      id="partner-status"
                      value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })}
                      className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="partner-start">Start Date</Label>
                    <Input
                      id="partner-start"
                      type="date"
                      value={form.startDate}
                      onChange={e => setForm({ ...form, startDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddPartner}>Save Partner</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
