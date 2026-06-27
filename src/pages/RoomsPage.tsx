import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, DoorOpen } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows } from '@/lib/use-table-sort';
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';

const roomCsvColumns: CsvColumnDef[] = [
  { key: 'room_number', header: 'رقم الغرفة' },
  { key: 'building', header: 'المبنى' },
  { key: 'capacity', header: 'السعة', importTransform: v => parseInt(v) || 4 },
];

interface Room {
  id: string;
  room_number: string;
  building: string | null;
  capacity: number;
  supervisor_id: string | null;
  is_active: boolean;
  staff?: { staff_name: string } | null;
}

interface StaffMember {
  id: string;
  staff_name: string;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState({ room_number: '', building: '', capacity: '4', supervisor_id: '' });
  const { toast } = useToast();

  const fetchData = async () => {
    const [rRes, sRes] = await Promise.all([
      supabase.from('rooms').select('*, staff(staff_name)').order('room_number'),
      supabase.from('staff').select('id, staff_name').eq('is_active', true),
    ]);
    setRooms(rRes.data || []);
    setStaffList(sRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ room_number: '', building: '', capacity: '4', supervisor_id: '' });
    setDialogOpen(true);
  };

  const openEdit = (r: Room) => {
    setEditing(r);
    setForm({
      room_number: r.room_number,
      building: r.building || '',
      capacity: String(r.capacity),
      supervisor_id: r.supervisor_id || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      room_number: form.room_number,
      building: form.building || null,
      capacity: parseInt(form.capacity) || 4,
      supervisor_id: form.supervisor_id || null,
    };
    if (editing) {
      const { error } = await supabase.from('rooms').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('rooms').insert(payload);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    }
    toast({ title: editing ? 'تم التحديث' : 'تم الإضافة' });
    setDialogOpen(false);
    fetchData();
  };

  // Count students per room
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});

  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sortedRooms = (() => {
    const acc: Record<string, (r: Room) => unknown> = {
      room: (r) => r.room_number,
      building: (r) => r.building,
      capacity: (r) => r.capacity,
      occupancy: (r) => studentCounts[r.id] || 0,
      supervisor: (r) => r.staff?.staff_name,
    };
    const numeric = sortKey === 'capacity' || sortKey === 'occupancy';
    if (!sortKey || !acc[sortKey]) return rooms;
    return sortRows(rooms, acc[sortKey], sortDir, numeric ? 'number' : 'text');
  })();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('students')
        .select('room_id')
        .eq('is_active', true)
        .not('room_id', 'is', null);
      const counts: Record<string, number> = {};
      (data || []).forEach(s => {
        if (s.room_id) counts[s.room_id] = (counts[s.room_id] || 0) + 1;
      });
      setStudentCounts(counts);
    };
    load();
  }, [rooms]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">إدارة الغرف</h1>
          <p className="text-sm text-muted-foreground mt-1">غرف السكن الداخلي</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvActions data={rooms} columns={roomCsvColumns} tableName="rooms" filename="rooms" onImportComplete={fetchData} />
          <Button onClick={openCreate}><Plus size={18} /> إضافة غرفة</Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? 'تعديل الغرفة' : 'إضافة غرفة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>رقم الغرفة</Label>
                <Input value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>المبنى</Label>
                <Input value={form.building} onChange={e => setForm(f => ({ ...f, building: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>السعة</Label>
                <Input type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>المشرفة</Label>
                <SearchableSelect
                  options={staffList.map(s => ({ value: s.id, label: s.staff_name }))}
                  value={form.supervisor_id}
                  onValueChange={v => setForm(f => ({ ...f, supervisor_id: v }))}
                  placeholder="اختر المشرفة"
                  searchPlaceholder="ابحث عن مشرفة..."
                />
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? 'حفظ' : 'إضافة'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <Card className="animate-pulse"><CardContent className="h-48" /></Card>
      ) : rooms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <DoorOpen size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">لا توجد غرف بعد</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="رقم الغرفة" sortKey="room" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="المبنى" sortKey="building" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="السعة" sortKey="capacity" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الإشغال" sortKey="occupancy" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="المشرفة" sortKey="supervisor" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRooms.map(r => {
                const occupied = studentCounts[r.id] || 0;
                const full = occupied >= r.capacity;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.room_number}</TableCell>
                    <TableCell>{r.building || '-'}</TableCell>
                    <TableCell>{r.capacity}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={full ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}>
                        {occupied}/{r.capacity}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.staff?.staff_name || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                        <Pencil size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
