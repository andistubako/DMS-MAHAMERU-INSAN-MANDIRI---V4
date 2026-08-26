import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Search, Power, AlertTriangle, Download } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import StatusBadge from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";

const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"];

const ENTITIES = {
  users: {
    label: "Pengguna", endpoint: "/users",
    columns: [
      { k: "name", l: "Nama" },
      { k: "email", l: "Email" },
      { k: "role", l: "Role", badge: true },
      { k: "office_name", l: "Kantor Penugasan" },
      { k: "status", l: "Status", badge: true },
    ],
    fields: [
      { k: "name", l: "Nama", required: true },
      { k: "email", l: "Email", type: "email", required: true, hideOnEdit: true },
      { k: "password", l: "Password", type: "password", required: true, editLabel: "Password Baru (opsional)" },
      { k: "role", l: "Role", type: "select", options: ["OWNER", "ADMIN", "SUPERVISOR", "SALES", "WAREHOUSE"], required: true },
      { k: "phone", l: "Telepon" },
      { k: "office_id", l: "Kantor Penugasan (Wajib untuk Sales)", type: "select", source: "offices", labelKey: "office_name" },
      { k: "area_id", l: "Area Operasional", type: "select", source: "areas" },
      { k: "status", l: "Status Akun", type: "select", options: STATUS_OPTIONS },
    ],
  },
  salesmen: {
    label: "Salesman", endpoint: "/masters/salesmen",
    columns: [
      { k: "code", l: "Kode" },
      { k: "name", l: "Nama" },
      { k: "office_name", l: "Kantor Penugasan" },
      { k: "area_name", l: "Area" },
      { k: "status", l: "Status", badge: true },
    ],
    fields: [
      { k: "name", l: "Nama", required: true },
      { k: "code", l: "Kode", required: true },
      { k: "office_id", l: "Kantor Penugasan (Absensi)", type: "select", source: "offices", labelKey: "office_name", required: true },
      { k: "area_id", l: "Area", type: "select", source: "areas" },
      { k: "status", l: "Status Salesman", type: "select", options: STATUS_OPTIONS },
    ],
  },
  offices: {
    label: "Kantor & Depo Gudang", endpoint: "/masters/offices",
    columns: [
      { k: "office_name", l: "Nama Kantor / Depo" },
      { k: "code", l: "Kode" },
      { k: "address", l: "Alamat" },
      { k: "radius_m", l: "Radius Geofence (m)" },
      { k: "work_start_time", l: "Jam Masuk" },
      { k: "work_end_time", l: "Jam Pulang" },
      { k: "status", l: "Status", badge: true },
    ],
    fields: [
      { k: "office_name", l: "Nama Kantor / Depo Gudang", required: true },
      { k: "code", l: "Kode Kantor (misal: HO-JKT, DEPO-BDG)", required: true },
      { k: "address", l: "Alamat Lengkap", required: true },
      { k: "latitude", l: "Latitude GPS (misal: -6.2255)", type: "number", step: "0.000001", required: true },
      { k: "longitude", l: "Longitude GPS (misal: 106.8095)", type: "number", step: "0.000001", required: true },
      { k: "radius_m", l: "Radius Geofence Presensi (Meter)", type: "number", required: true },
      { k: "work_start_time", l: "Jam Masuk (HH:mm, misal: 08:00)" },
      { k: "work_end_time", l: "Jam Pulang (HH:mm, misal: 17:00)" },
      { k: "check_in_start", l: "Jam Buka Presensi (HH:mm, misal: 06:00)" },
      { k: "late_tolerance_min", l: "Toleransi Terlambat (Menit)", type: "number" },
      { k: "status", l: "Status Kantor", type: "select", options: STATUS_OPTIONS },
    ],
  },
  areas: {
    label: "Area", endpoint: "/masters/areas",
    columns: [{ k: "name", l: "Nama" }, { k: "code", l: "Kode" }, { k: "status", l: "Status", badge: true }],
    fields: [
      { k: "name", l: "Nama", required: true },
      { k: "code", l: "Kode", required: true },
      { k: "status", l: "Status Area", type: "select", options: STATUS_OPTIONS },
    ],
  },
  districts: {
    label: "Kecamatan", endpoint: "/masters/districts",
    columns: [{ k: "name", l: "Nama" }, { k: "area_name", l: "Area" }, { k: "status", l: "Status", badge: true }],
    fields: [
      { k: "name", l: "Nama", required: true },
      { k: "area_id", l: "Area", type: "select", source: "areas", required: true },
      { k: "status", l: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  villages: {
    label: "Kelurahan", endpoint: "/masters/villages",
    columns: [{ k: "name", l: "Nama" }, { k: "district_name", l: "Kecamatan" }, { k: "status", l: "Status", badge: true }],
    fields: [
      { k: "name", l: "Nama", required: true },
      { k: "district_id", l: "Kecamatan", type: "select", source: "districts", required: true },
      { k: "status", l: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  channels: {
    label: "Channel", endpoint: "/masters/channels",
    columns: [{ k: "name", l: "Nama" }, { k: "code", l: "Kode" }, { k: "status", l: "Status", badge: true }],
    fields: [
      { k: "name", l: "Nama", required: true },
      { k: "code", l: "Kode", required: true },
      { k: "status", l: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  products: {
    label: "Produk", endpoint: "/masters/products",
    columns: [{ k: "name", l: "Nama" }, { k: "brand", l: "Brand" }, { k: "category", l: "Kategori" }, { k: "status", l: "Status", badge: true }],
    fields: [
      { k: "name", l: "Nama", required: true },
      { k: "brand", l: "Brand" },
      { k: "category", l: "Kategori" },
      { k: "status", l: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  skus: {
    label: "SKU", endpoint: "/masters/skus",
    columns: [{ k: "sku_code", l: "Kode" }, { k: "name", l: "Nama" }, { k: "unit", l: "Satuan" }, { k: "status", l: "Status", badge: true }],
    fields: [
      { k: "product_id", l: "Produk", type: "select", source: "products", required: true },
      { k: "sku_code", l: "Kode SKU", required: true },
      { k: "name", l: "Nama SKU", required: true },
      { k: "unit", l: "Satuan" },
      { k: "status", l: "Status SKU", type: "select", options: STATUS_OPTIONS },
    ],
  },
  prices: {
    label: "Harga", endpoint: "/masters/prices",
    columns: [{ k: "sku_name", l: "SKU" }, { k: "price", l: "Harga", money: true }, { k: "effective_date", l: "Berlaku" }, { k: "status", l: "Status", badge: true }],
    fields: [
      { k: "sku_id", l: "SKU", type: "select", source: "skus", required: true },
      { k: "price", l: "Harga", type: "number", required: true },
      { k: "effective_date", l: "Tanggal Berlaku", type: "date", required: true },
      { k: "status", l: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  promos: {
    label: "Promo", endpoint: "/masters/promos",
    columns: [{ k: "name", l: "Nama" }, { k: "discount_pct", l: "Diskon %" }, { k: "start_date", l: "Mulai" }, { k: "end_date", l: "Selesai" }, { k: "status", l: "Status", badge: true }],
    fields: [
      { k: "name", l: "Nama Promo", required: true },
      { k: "sku_id", l: "SKU", type: "select", source: "skus" },
      { k: "discount_pct", l: "Diskon (%)", type: "number" },
      { k: "start_date", l: "Mulai", type: "date" },
      { k: "end_date", l: "Selesai", type: "date" },
      { k: "status", l: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  routes: {
    label: "Rute", endpoint: "/masters/routes",
    columns: [{ k: "name", l: "Nama" }, { k: "area_name", l: "Area" }, { k: "status", l: "Status", badge: true }],
    fields: [
      { k: "name", l: "Nama Rute", required: true },
      { k: "area_id", l: "Area", type: "select", source: "areas" },
      { k: "status", l: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  "open-call-reasons": {
    label: "Alasan Outlet Call (Non-EC)", endpoint: "/masters/open-call-reasons",
    columns: [{ k: "reason", l: "Alasan" }, { k: "status", l: "Status", badge: true }],
    fields: [
      { k: "reason", l: "Alasan", required: true },
      { k: "status", l: "Status", type: "select", options: STATUS_OPTIONS },
    ],
  },
  targets: {
    label: "Target Volume Penjualan", endpoint: "/targets",
    columns: [
      { k: "salesman_name", l: "Sales" },
      { k: "sku_name", l: "SKU" },
      { k: "period", l: "Periode" },
      { k: "target_volume", l: "Target Volume (Qty)" },
      { k: "unit", l: "Satuan" },
      { k: "status", l: "Status", badge: true },
    ],
    fields: [
      { k: "salesman_id", l: "Sales", type: "select", source: "salesmen", valueKey: "user_id" },
      { k: "sku_id", l: "SKU Produk", type: "select", source: "skus" },
      { k: "period", l: "Periode (YYYY-MM)", required: true },
      { k: "target_volume", l: "Target Volume (Qty)", type: "number", required: true },
      { k: "unit", l: "Satuan (CTN / BKS / PCS)", required: true },
      { k: "notes", l: "Catatan" },
      { k: "status", l: "Status Target", type: "select", options: STATUS_OPTIONS },
    ],
  },
  outlets: {
    label: "Outlet", endpoint: "/outlets",
    columns: [
      { k: "outlet_code", l: "Kode" }, { k: "outlet_name", l: "Nama" }, { k: "owner_name", l: "Pemilik" },
      { k: "area_name", l: "Area" }, { k: "channel_name", l: "Channel" }, { k: "assigned_sales_name", l: "Sales Penugasan" },
      { k: "completed_transaction_count", l: "Tx Selesai" },
      { k: "lifecycle_status", l: "Status Lifecycle", badge: true },
      { k: "status", l: "Status Operasional", badge: true },
    ],
    fields: [
      { k: "outlet_name", l: "Nama Outlet", required: true }, { k: "owner_name", l: "Pemilik" },
      { k: "phone", l: "Telepon" }, { k: "address", l: "Alamat", required: true },
      { k: "area_id", l: "Area", type: "select", source: "areas", required: true },
      { k: "channel_id", l: "Channel", type: "select", source: "channels", required: true },
      { k: "latitude", l: "Latitude", type: "number", required: true }, { k: "longitude", l: "Longitude", type: "number", required: true },
      { k: "status", l: "Status Operasional", type: "select", options: STATUS_OPTIONS },
    ],
  },
};

const SELECT_SOURCES = {
  areas: "/masters/areas",
  districts: "/masters/districts",
  products: "/masters/products",
  skus: "/masters/skus",
  channels: "/masters/channels",
  salesmen: "/masters/salesmen",
  offices: "/offices",
  outlets: "/outlets",
};

export default function MasterDataPage() {
  const { user } = useAuth();
  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";
  const [params, setParams] = useSearchParams();
  const [downloading, setDownloading] = useState(false);
  const tab = params.get("tab") || "users";

  const handleDownloadDatabase = async () => {
    if (!isAdminOrOwner) {
      toast.error("Hanya Administrator & Owner yang berwenang mendownload seluruh database.");
      return;
    }
    setDownloading(true);
    try {
      const res = await api.get("/system/export-db", { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute("download", `mahameru-dms-database-backup-${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Snapshot seluruh database berhasil didownload!");
    } catch (err) {
      toast.error("Gagal mendownload database: " + errMsg(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="master-data-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold text-navy">Master Data</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen referensi data organisasi, produk, harga, channel, dan master operasional.
          </p>
        </div>
        {isAdminOrOwner && (
          <Button
            onClick={handleDownloadDatabase}
            disabled={downloading}
            variant="outline"
            size="sm"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 shadow-2xs font-semibold shrink-0"
            title="Download seluruh data & koleksi database dalam format JSON"
          >
            {downloading ? (
              <Loader2 size={15} className="mr-1.5 animate-spin text-emerald-600" />
            ) : (
              <Download size={15} className="mr-1.5 text-emerald-600" />
            )}
            {downloading ? "Mendownload..." : "Download Semua Data Database"}
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-white border border-slate-200 p-1">
          {Object.entries(ENTITIES).map(([k, e]) => (
            <TabsTrigger key={k} value={k} data-testid={`master-tab-${k}`} className="text-xs">{e.label}</TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(ENTITIES).map(([k, e]) => (
          <TabsContent key={k} value={k}>
            <MasterTab entityKey={k} config={e} active={tab === k} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function MasterTab({ entityKey, config, active }) {
  const { user } = useAuth();
  const canDelete = user?.role === "ADMIN" || user?.role === "OWNER";
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [options, setOptions] = useState({});
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const loadOptions = useCallback(async () => {
    const needed = [...new Set(config.fields.filter((f) => f.source).map((f) => f.source))];
    const extra = {};
    await Promise.all(needed.map(async (src) => {
      try {
        const { data } = await api.get(SELECT_SOURCES[src], { params: { limit: 500, status: src === "offices" ? undefined : "ACTIVE" } });
        extra[src] = data.items;
      } catch {
        extra[src] = [];
      }
    }));
    setOptions(extra);
  }, [config]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(config.endpoint, { params: { q, page, limit: 20 } });
      const raw = Array.isArray(data.items) ? data.items : [];
      const seen = new Set();
      const deduped = raw.filter((item) => {
        if (!item._id) return true;
        if (seen.has(item._id)) return false;
        seen.add(item._id);
        return true;
      });
      setItems(deduped);
      setTotal(data.total);
    } catch (e) {
      toast.error(errMsg(e));
    }
    setLoading(false);
  }, [config, q, page]);

  useEffect(() => {
    if (active) {
      load();
      loadOptions();
    }
  }, [active, load, loadOptions]);

  const lookupMaps = useMemo(() => {
    const maps = {};
    for (const [src, items] of Object.entries(options)) {
      maps[src] = Object.fromEntries(items.map((i) => [i._id, i]));
    }
    return maps;
  }, [options]);

  const displayVal = (col, item) => {
    if (col.badge) return <StatusBadge status={item[col.k]} />;
    if (col.money) return `Rp ${(item[col.k] || 0).toLocaleString("id-ID")}`;
    if (col.k.endsWith("_id")) return item[col.k] || "-";
    return item[col.k] ?? "-";
  };

  const enriched = items.map((item) => {
    const out = { ...item };
    for (const [src, map] of Object.entries(lookupMaps)) {
      const idKey = src === "offices" ? "office_id" : `${src.replace(/s$/, "")}_id`;
      if (item[idKey] && map[item[idKey]]) {
        out[`${src.replace(/s$/, "")}_name`] = map[item[idKey]].name || map[item[idKey]].office_name;
      }
    }
    if (entityKey === "targets" && item.salesman_id) {
      const sm = (options.salesmen || []).find((s) => s.user_id === item.salesman_id);
      out.salesman_name = sm?.name || item.salesman_id;
    }
    return out;
  });

  const handleToggleStatus = async (item) => {
    if (!canDelete) {
      toast.error("Hanya Admin dan Owner yang berwenang mengubah status.");
      return;
    }
    setTogglingId(item._id);
    try {
      const toggleUrl = `${config.endpoint}/${item._id}/toggle`;
      const { data } = await api.post(toggleUrl);
      const newStatus = data.status || (item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      toast.success(`Status berhasil diubah menjadi ${newStatus}`);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
    setTogglingId(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    setDeleting(true);
    try {
      const base = entityKey === "outlets" ? "/outlets" : (entityKey === "users" ? "/users" : (entityKey === "targets" ? "/targets" : (entityKey === "sales_outlets" ? "/sales-outlets" : config.endpoint)));
      await api.delete(`${base}/${deleteConfirmItem._id}`);
      toast.success("Data berhasil dihapus dari sistem.");
      setDeleteConfirmItem(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-3 pt-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            data-testid={`${entityKey}-search`}
            placeholder="Cari..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button data-testid={`${entityKey}-create-button`} onClick={() => { setEditItem(null); setFormOpen(true); }} className="bg-navy text-white font-bold">
          <Plus size={16} className="mr-1" /> Tambah
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-navy" /></div>
        ) : enriched.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-400" data-testid={`${entityKey}-empty`}>Tidak ada data</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  {config.columns.map((c) => <TableHead key={c.k} className="text-xs font-bold uppercase tracking-wider text-slate-500">{c.l}</TableHead>)}
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map((item, i) => (
                  <TableRow key={item._id ? `${item._id}-${i}` : `row-${i}`} data-testid={`${entityKey}-row-${i}`}>
                    {config.columns.map((c) => <TableCell key={c.k} className="text-sm">{displayVal(c, item)}</TableCell>)}
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            data-testid={`${entityKey}-toggle-${i}`}
                            onClick={() => handleToggleStatus(item)}
                            disabled={togglingId === item._id}
                            className={`h-8 w-8 ${item.status === "ACTIVE" ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
                            title={item.status === "ACTIVE" ? "Nonaktifkan Data (Jadikan INACTIVE)" : "Aktifkan Data (Jadikan ACTIVE)"}
                          >
                            {togglingId === item._id ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" data-testid={`${entityKey}-edit-${i}`} onClick={() => { setEditItem(item); setFormOpen(true); }} title="Edit Data" className="h-8 w-8 text-slate-600 hover:text-navy hover:bg-slate-100">
                          <Pencil size={14} />
                        </Button>
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            data-testid={`${entityKey}-delete-${i}`}
                            onClick={() => setDeleteConfirmItem(item)}
                            className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Hapus Data"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Total: {total}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid={`${entityKey}-prev`}>Sebelumnya</Button>
          <Button size="sm" variant="outline" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)} data-testid={`${entityKey}-next`}>Berikutnya</Button>
        </div>
      </div>

      <EntityFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        config={config}
        entityKey={entityKey}
        item={editItem}
        options={options}
        onSaved={() => { setFormOpen(false); load(); }}
      />

      {/* In-App Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle size={18} />
              Konfirmasi Hapus Data
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 pt-2">
              Apakah Anda yakin ingin menghapus data{" "}
              <b>
                {deleteConfirmItem?.name ||
                  deleteConfirmItem?.outlet_name ||
                  deleteConfirmItem?.sku_name ||
                  deleteConfirmItem?.reason ||
                  deleteConfirmItem?.code ||
                  deleteConfirmItem?.email ||
                  "ini"}
              </b>
              ? Tindakan ini akan menghapus data dari sistem dan cloud Firestore.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmItem(null)}
              disabled={deleting}
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {deleting ? <Loader2 className="animate-spin mr-1.5" size={14} /> : <Trash2 size={14} className="mr-1.5" />}
              Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntityFormDialog({ open, onClose, config, entityKey, item, options, onSaved }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const init = {};
      for (const f of config.fields) {
        init[f.k] = item?.[f.k] ?? (f.k === "status" ? "ACTIVE" : "");
      }
      setForm(init);
    }
  }, [open, item, config]);

  const submit = async () => {
    for (const f of config.fields) {
      if (f.required && !item && !form[f.k]) {
        toast.error(`${f.l} wajib diisi`);
        return;
      }
    }
    setBusy(true);
    try {
      const payload = {};
      for (const f of config.fields) {
        let v = form[f.k];
        if (v === "" || v === undefined) continue;
        if (item && f.hideOnEdit) continue;
        if (f.type === "number") v = Number(v);
        payload[f.k] = v;
      }
      if (item) {
        await api.put(`${config.endpoint}/${item._id}`, payload);
        toast.success("Data diperbarui");
      } else {
        await api.post(config.endpoint, payload);
        toast.success("Data dibuat");
      }
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid={`${entityKey}-form-dialog`} className="max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit" : "Tambah"} {config.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {config.fields.map((f) => (
            <div key={f.k} className="space-y-1.5">
              <Label>
                {item && f.editLabel ? f.editLabel : f.l}
                {f.required && !item ? " *" : ""}
              </Label>
              {f.type === "select" ? (
                <Select value={form[f.k] || (f.k === "status" ? "ACTIVE" : "")} onValueChange={(v) => setForm((s) => ({ ...s, [f.k]: v }))}>
                  <SelectTrigger data-testid={`form-${f.k}`}><SelectValue placeholder={`Pilih ${f.l}`} /></SelectTrigger>
                  <SelectContent>
                    {f.options
                      ? f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)
                      : (options[f.source] || []).map((o) => {
                          const val = f.valueKey ? (o[f.valueKey] || o._id) : o._id;
                          let display = o[f.labelKey || "name"] || o.office_name || o.outlet_name || o.reason || val;
                          if (f.source === "outlets" && o.outlet_code) {
                            display = `[${o.outlet_code}] ${o.outlet_name || display}`;
                          } else if (f.source === "salesmen" && o.code) {
                            display = `${o.name || display} (${o.code})`;
                          }
                          return (
                            <SelectItem key={o._id || val} value={val}>
                              {display}
                            </SelectItem>
                          );
                        })}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  data-testid={`form-${f.k}`}
                  type={f.type || "text"}
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  step={f.type === "number" ? "any" : undefined}
                  value={form[f.k] ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, [f.k]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <Button data-testid={`${entityKey}-form-submit`} disabled={busy} onClick={submit} className="w-full bg-navy text-white font-bold">
            {busy ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
            Simpan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
