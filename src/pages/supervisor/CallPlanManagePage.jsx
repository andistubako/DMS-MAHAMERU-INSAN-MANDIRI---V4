import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2, Pencil, Search } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import StatusBadge from "../../components/StatusBadge";
import { todayLocal } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";

export default function CallPlanManagePage() {
  const [date, setDate] = useState(todayLocal());
  const [salesmen, setSalesmen] = useState([]);
  const [salesmanId, setSalesmanId] = useState("");
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editPlan, setEditPlan] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        api.get("/call-plans", { params: { date, salesman_id: salesmanId || undefined } }),
        api.get("/masters/salesmen", { params: { status: "ACTIVE", limit: 100 } }),
      ]);
      setPlans(Array.isArray(p.data?.items) ? p.data.items : []);
      setSalesmen(Array.isArray(s.data?.items) ? s.data.items : []);
    } catch (e) {
      toast.error(errMsg(e));
    }
    setLoading(false);
  }, [date, salesmanId]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id) => {
    try {
      await api.delete(`/call-plans/${id}`);
      toast.success("Call plan dihapus");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-4" data-testid="callplan-manage-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-xl font-bold text-navy">Kelola Call Plan</h2>
        <Button data-testid="callplan-create-button" onClick={() => { setEditPlan(null); setFormOpen(true); }} className="bg-navy text-white font-bold">
          <Plus size={16} className="mr-1" /> Buat Call Plan
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input data-testid="filter-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        <Select value={salesmanId} onValueChange={(v) => setSalesmanId(v === "ALL" ? "" : v)}>
          <SelectTrigger data-testid="filter-salesman" className="w-56"><SelectValue placeholder="Semua sales" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua sales</SelectItem>
            {salesmen.map((s, idx) => (
              <SelectItem key={s.user_id || s._id || `filter-sales-${idx}`} value={s.user_id || s._id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-navy" /></div>
      ) : plans.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-400" data-testid="callplan-manage-empty">
          Belum ada call plan untuk filter ini
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {plans.map((p, i) => (
            <div key={p._id || `plan-${i}`} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3" data-testid={`plan-card-${i}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-navy">{p.salesman_name}</div>
                  <div className="text-xs text-slate-500">{p.date} · {p.item_count} outlet</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" data-testid={`plan-edit-${i}`} onClick={() => { setEditPlan(p); setFormOpen(true); }} className="flex-1">
                  <Pencil size={13} className="mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" data-testid={`plan-delete-${i}`} onClick={() => remove(p._id)} className="border-red-200 text-red-600">
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PlanFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        salesmen={salesmen}
        defaultDate={date}
        editPlan={editPlan}
        onSaved={() => { setFormOpen(false); load(); }}
      />
    </div>
  );
}

function PlanFormDialog({ open, onClose, salesmen, defaultDate, editPlan, onSaved }) {
  const [date, setDate] = useState(defaultDate);
  const [salesmanId, setSalesmanId] = useState("");
  const [selected, setSelected] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState([]);
  const [recs, setRecs] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(editPlan?.date || defaultDate);
      setSalesmanId(editPlan?.salesman_id || "");
      setSelected([]);
      setRecs(null);
      setSearchRes([]);
      if (editPlan) {
        (async () => {
          try {
            const { data } = await api.get(`/call-plans/${editPlan._id}`);
            setSelected(data.items.map((it) => ({
              outlet_id: it.outlet_id,
              outlet_name: it.outlet?.outlet_name || it.outlet_name,
              priority: it.priority,
            })));
          } catch (e) { toast.error(errMsg(e)); }
        })();
      }
    }
  }, [open, editPlan, defaultDate]);

  const search = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchRes([]); return; }
    try {
      const { data } = await api.get("/outlets", {
        params: { q, status: "ACTIVE", salesman_id: salesmanId || undefined, limit: 15 },
      });
      setSearchRes((data.items || []).filter((o) => !selected.find((s) => s.outlet_id === o._id)));
    } catch (e) {
      console.warn("Pencarian outlet gagal", e);
    }
  };

  const loadRecs = async () => {
    if (!salesmanId) {
      toast.error("Pilih sales terlebih dahulu");
      return;
    }
    try {
      const { data } = await api.get("/call-plans/smart/recommendations", { params: { date, salesman_id: salesmanId } });
      const list = Array.isArray(data) ? data : (data.items || []);
      setRecs(list.filter((r) => !selected.find((s) => s.outlet_id === (r.outlet_id || r._id))));
    } catch (e) { toast.error(errMsg(e)); }
  };

  const addOutlet = (o, priority = "NORMAL") => {
    setSelected((s) => [...s, { outlet_id: o.outlet_id || o._id, outlet_name: o.outlet_name, priority }]);
    setSearchRes((r) => r.filter((x) => x._id !== (o._id || o.outlet_id)));
    setRecs((r) => (r ? r.filter((x) => (x.outlet_id || x._id) !== (o.outlet_id || o._id)) : r));
  };

  const submit = async () => {
    if (!salesmanId || selected.length === 0) {
      toast.error("Pilih sales dan minimal 1 outlet");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        date,
        salesman_id: salesmanId,
        outlet_ids: selected.map((s) => s.outlet_id),
        items: selected.map((s, i) => ({ outlet_id: s.outlet_id, priority: s.priority, sequence: i + 1 })),
      };
      if (editPlan) {
        await api.put(`/call-plans/${editPlan._id}`, payload);
        toast.success("Call plan diperbarui");
      } else {
        await api.post("/call-plans", payload);
        toast.success("Call plan dibuat & dipublish");
      }
      onSaved();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid="plan-form-dialog" className="max-h-[85vh] overflow-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>{editPlan ? "Edit Call Plan" : "Buat Call Plan"}</DialogTitle>
          <DialogDescription>Tentukan tanggal, sales, dan urutan outlet kunjungan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tanggal</Label>
              <Input data-testid="plan-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!!editPlan} />
            </div>
            <div className="space-y-1.5">
              <Label>Sales</Label>
              <Select value={salesmanId} onValueChange={setSalesmanId} disabled={!!editPlan}>
                <SelectTrigger data-testid="plan-salesman"><SelectValue placeholder="Pilih sales" /></SelectTrigger>
                <SelectContent>
                  {salesmen.map((s, idx) => (
                    <SelectItem key={s.user_id || s._id || `form-sales-${idx}`} value={s.user_id || s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Outlet ({selected.length})</Label>
              <Button size="sm" variant="outline" data-testid="smart-recs-button" onClick={loadRecs} className="text-gold-dark border-gold">
                <Sparkles size={13} className="mr-1" /> Rekomendasi Cerdas
              </Button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input data-testid="plan-outlet-search" placeholder="Cari outlet..." value={searchQ} onChange={(e) => search(e.target.value)} className="pl-9" />
            </div>
            {searchRes.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-auto">
                {searchRes.map((o, idx) => {
                  const outId = o._id || o.outlet_id || `res-${idx}`;
                  return (
                    <button key={outId} data-testid={`plan-add-${outId}`} onClick={() => addOutlet(o)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                      <span className="font-bold text-navy">{o.outlet_name}</span>
                      <span className="text-xs text-slate-400 ml-2">{o.address}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {recs && (
              <div className="border border-gold/40 bg-gold/5 rounded-lg p-2 space-y-1 max-h-48 overflow-auto" data-testid="smart-recs-list">
                <div className="text-[10px] uppercase tracking-wider font-bold text-gold-dark px-1">Rekomendasi berdasarkan riwayat order & kunjungan</div>
                {recs.length === 0 && <div className="text-xs text-slate-400 px-1 py-2">Tidak ada rekomendasi</div>}
                {recs.map((r, idx) => {
                  const recId = r.outlet_id || r._id || `rec-${idx}`;
                  return (
                    <div key={recId} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                      <div className="text-xs">
                        <div className="font-bold text-navy">{r.outlet_name}</div>
                        <div className="text-slate-400">
                          {r.days_no_order == null ? "Belum pernah order" : `${r.days_no_order} hari tidak order`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.priority} />
                        <Button size="sm" variant="ghost" data-testid={`rec-add-${recId}`} onClick={() => addOutlet(r, r.priority)}><Plus size={14} /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-1.5">
              {selected.map((s, i) => {
                const itemKey = s.outlet_id ? `sel-${s.outlet_id}-${i}` : `sel-${i}`;
                return (
                  <div key={itemKey} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2" data-testid={`selected-outlet-${i}`}>
                    <span className="w-6 h-6 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="flex-1 text-sm font-bold text-navy truncate">{s.outlet_name}</span>
                    <Select value={s.priority} onValueChange={(v) => setSelected((arr) => arr.map((x) => (x.outlet_id === s.outlet_id ? { ...x, priority: v } : x)))}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">HIGH</SelectItem>
                        <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                        <SelectItem value="NORMAL">NORMAL</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => setSelected((arr) => arr.filter((x) => x.outlet_id !== s.outlet_id))}><Trash2 size={14} className="text-red-400" /></Button>
                  </div>
                );
              })}
            </div>
          </div>

          <Button data-testid="plan-submit" disabled={busy} onClick={submit} className="w-full bg-navy text-white font-bold">
            {busy ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
            {editPlan ? "Simpan Perubahan" : "Buat & Publish"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
