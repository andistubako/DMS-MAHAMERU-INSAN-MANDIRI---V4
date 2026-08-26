import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Download, Play, FileSpreadsheet, FileText, Filter, RotateCcw, Store, ArrowUpRight } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { todayLocal } from "../lib/format";
import { exportToCSV, exportToXLSX, exportToPDF } from "../lib/export";

export default function ReportsPage() {
  const [types, setTypes] = useState([]);
  const [rtype, setRtype] = useState("");
  const [from, setFrom] = useState(todayLocal());
  const [to, setTo] = useState(todayLocal());
  const [salesmanId, setSalesmanId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [skuId, setSkuId] = useState("");
  const [salesmen, setSalesmen] = useState([]);
  const [areas, setAreas] = useState([]);
  const [channels, setChannels] = useState([]);
  const [skus, setSkus] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const setPreset = (preset) => {
    const f = (d) => {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return formatter.format(d);
    };
    const now = new Date();
    if (preset === "today") {
      const t = todayLocal();
      setFrom(t);
      setTo(t);
    } else if (preset === "7d") {
      const fromD = new Date(Date.now() - 6 * 86400000);
      setFrom(f(fromD));
      setTo(f(now));
    } else if (preset === "thisMonth") {
      const cur = todayLocal();
      setFrom(`${cur.slice(0, 7)}-01`);
      setTo(cur);
    }
  };

  const resetFilters = () => {
    const t = todayLocal();
    setFrom(t);
    setTo(t);
    setSalesmanId("");
    setAreaId("");
    setChannelId("");
    setSkuId("");
  };

  useEffect(() => {
    (async () => {
      try {
        const [t, s, a, c, sk] = await Promise.all([
          api.get("/reports"),
          api.get("/masters/salesmen", { params: { limit: 100 } }),
          api.get("/masters/areas", { params: { limit: 100 } }),
          api.get("/masters/channels", { params: { limit: 100 } }),
          api.get("/masters/skus", { params: { limit: 100 } }),
        ]);
        setTypes(t.data.items || t.data);
        const list = t.data.items || t.data;
        if (list.length) setRtype(list[0].key || list[0].id);
        setSalesmen(s.data.items || []);
        setAreas(a.data.items || []);
        setChannels(c.data.items || []);
        setSkus(sk.data.items || []);
      } catch (e) {
        toast.error(errMsg(e));
      }
    })();
  }, []);

  const params = useCallback(() => {
    const p = { from, to };
    if (salesmanId) p.salesman_id = salesmanId;
    if (areaId) p.area_id = areaId;
    if (channelId) p.channel_id = channelId;
    if (skuId) p.sku_id = skuId;
    return p;
  }, [from, to, salesmanId, areaId, channelId, skuId]);

  const run = async () => {
    if (!rtype) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/${rtype}`, { params: params() });
      setResult(data);
    } catch (e) {
      toast.error(errMsg(e));
    }
    setLoading(false);
  };

  const rows = result?.rows || result?.data || [];
  const cols = rows.length ? Object.keys(rows[0]) : [];

  const getReportFilename = (type) => {
    switch (type) {
      case "daily-sales":
        return "DMS_Mahameru_Daily_Report";
      case "sales-performance":
        return "DMS_Mahameru_Sales_Performance";
      case "inventory":
      case "daily-stock-movement":
      case "sales-stock-ledger":
        return "DMS_Mahameru_Inventory_Report";
      case "transactions":
        return "DMS_Mahameru_Transaction_Report";
      case "target-performance":
        return "DMS_Mahameru_Target_Volume_Report";
      default:
        return `DMS_Mahameru_${(type || "Report").replace(/-/g, "_")}`;
    }
  };

  const handleExportCSV = () => {
    if (!rows.length) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const filename = getReportFilename(rtype);
    exportToCSV(filename, cols, rows);
    toast.success("Laporan CSV berhasil diunduh");
  };

  const handleExportXLSX = () => {
    if (!rows.length) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const filename = getReportFilename(rtype);
    exportToXLSX(filename, "Laporan", rows);
    toast.success("Laporan Excel (XLSX) berhasil diunduh");
  };

  const handleExportPDF = () => {
    if (!rows.length) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const currentReport = types.find((t) => (t.key || t.id) === rtype);
    const pdfHeaders = cols.map((col) => ({
      key: col,
      label: col.replace(/_/g, " ").toUpperCase(),
      isMoney: col.includes("price") || col.includes("total") || col.includes("sales") || col.includes("nilai"),
    }));

    const filename = getReportFilename(rtype);
    exportToPDF({
      title: currentReport?.name ? `DMS MAHAMERU — ${currentReport.name.toUpperCase()}` : "DMS MAHAMERU REPORT",
      subtitle: `Periode: ${from} s/d ${to} | Filter: ${salesmanId ? `Sales ID: ${salesmanId}` : "Semua Sales"}`,
      headers: pdfHeaders,
      data: rows,
      filename,
    });
    toast.success("Laporan PDF resmi PT Mahameru Insan Mandiri berhasil diunduh");
  };

  return (
    <div className="space-y-4" data-testid="reports-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl font-bold text-navy">Report Center</h2>
          <p className="text-xs text-slate-500">Laporan operasional, target vs actual SKU volume, performa sales & audit trail</p>
        </div>
        <Link
          to="/reports/outlets"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-bold shadow-xs hover:bg-navy-light transition-all"
        >
          <Store size={14} className="text-gold" />
          <span>Buka Laporan Outlet Interaktif</span>
          <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 shadow-xs">
        <div className="space-y-1 col-span-2 md:col-span-1">
          <Label className="text-xs font-bold text-slate-700">Jenis Laporan</Label>
          <Select value={rtype} onValueChange={setRtype}>
            <SelectTrigger data-testid="report-type-select" className="text-xs h-9">
              <SelectValue placeholder="Pilih laporan" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.key || t.id} value={t.key || t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700">Dari Tanggal</Label>
          <Input data-testid="report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-xs h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700">Sampai Tanggal</Label>
          <Input data-testid="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-xs h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700">Salesman</Label>
          <Select value={salesmanId} onValueChange={(v) => setSalesmanId(v === "ALL" ? "" : v)}>
            <SelectTrigger data-testid="report-salesman" className="text-xs h-9"><SelectValue placeholder="Semua Salesman" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Salesman</SelectItem>
              {salesmen.map((s) => <SelectItem key={s.user_id || s._id} value={s.user_id || s._id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700">Area</Label>
          <Select value={areaId} onValueChange={(v) => setAreaId(v === "ALL" ? "" : v)}>
            <SelectTrigger data-testid="report-area" className="text-xs h-9"><SelectValue placeholder="Semua Area" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Area</SelectItem>
              {areas.map((a) => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold text-slate-700">SKU / Produk</Label>
          <Select value={skuId} onValueChange={(v) => setSkuId(v === "ALL" ? "" : v)}>
            <SelectTrigger data-testid="report-sku" className="text-xs h-9"><SelectValue placeholder="Semua SKU" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua SKU</SelectItem>
              {skus.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 col-span-2 md:col-span-3 xl:col-span-6 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setPreset("today")}
                className="px-2 py-1 text-[11px] font-semibold rounded hover:bg-white text-slate-600 transition-all"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setPreset("7d")}
                className="px-2 py-1 text-[11px] font-semibold rounded hover:bg-white text-slate-600 transition-all"
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => setPreset("thisMonth")}
                className="px-2 py-1 text-[11px] font-semibold rounded hover:bg-white text-slate-600 transition-all"
              >
                Bulan Ini
              </button>
            </div>
            <Button data-testid="report-run-button" onClick={run} disabled={loading || !rtype} className="bg-navy hover:bg-navy-light text-white font-bold h-9 text-xs">
              {loading ? <Loader2 className="animate-spin mr-1.5" size={14} /> : <Play size={14} className="mr-1.5" />}
              Tampilkan Data
            </Button>
            {(salesmanId || areaId || channelId || skuId) && (
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-slate-500 h-9">
                <RotateCcw size={13} className="mr-1" /> Reset Filter
              </Button>
            )}
          </div>

          {rows.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 mr-1">Ekspor:</span>
              <Button data-testid="report-export-csv" onClick={handleExportCSV} variant="outline" size="sm" className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-100">
                <Download size={13} className="mr-1" /> CSV
              </Button>
              <Button data-testid="report-export-xlsx" onClick={handleExportXLSX} variant="outline" size="sm" className="h-8 text-xs border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
                <FileSpreadsheet size={13} className="mr-1" /> Excel
              </Button>
              <Button data-testid="report-export-pdf" onClick={handleExportPDF} variant="outline" size="sm" className="h-8 text-xs border-red-300 text-red-700 bg-red-50 hover:bg-red-100">
                <FileText size={13} className="mr-1" /> PDF Resmi
              </Button>
            </div>
          )}
        </div>
      </div>

      {result?.meta && (
        <div className="grid grid-cols-3 gap-2" data-testid="report-meta">
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-slate-400 font-bold">Total Outlet</div><div className="font-heading font-bold text-navy text-lg">{result.meta.total_outlet}</div></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-slate-400 font-bold">Dikunjungi</div><div className="font-heading font-bold text-emerald-600 text-lg">{result.meta.visited}</div></div>
          <div className="bg-navy rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-gold font-bold">Coverage</div><div className="font-heading font-bold text-white text-lg">{result.meta.coverage_pct}%</div></div>
        </div>
      )}

      {result && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm" data-testid="report-result">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <span className="font-heading font-bold text-navy text-sm">{result.name || types.find((t) => (t.key || t.id) === rtype)?.name}</span>
            <span className="text-xs text-slate-500 font-semibold">{rows.length} baris data ditemukan</span>
          </div>
          {rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400" data-testid="report-empty">Tidak ada data untuk filter dan periode ini</div>
          ) : (
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    {cols.map((c) => (
                      <TableHead key={c} className="text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
                        {c.replace(/_/g, " ")}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={Object.values(r).join("|") + i} data-testid={`report-row-${i}`} className="hover:bg-slate-50/80">
                      {cols.map((c) => (
                        <TableCell key={c} className="text-sm whitespace-nowrap">
                          {typeof r[c] === "number" ? r[c].toLocaleString("id-ID") : String(r[c] ?? "-")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
