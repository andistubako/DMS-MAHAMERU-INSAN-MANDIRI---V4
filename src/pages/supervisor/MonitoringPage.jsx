import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  X,
  RefreshCw,
  Search,
  Filter,
  MapPin,
  Phone,
  Clock,
  TrendingUp,
  Target,
  ShoppingBag,
  Users,
  Store,
  Eye,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import api, { errMsg } from "../../lib/api";
import StatusBadge from "../../components/StatusBadge";
import MapView from "../../components/MapView";
import { rupiah, fmtTime, fmtDateTime, todayLocal } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";

const STATUS_LABEL = {
  OFF_DUTY: "Off Duty",
  ON_DUTY: "On Duty",
  ON_FIELD: "On Field",
  VISITING: "Sedang Kunjungan",
  RETURNING: "Perjalanan Pulang",
};

export default function MonitoringPage() {
  const [data, setData] = useState({ items: [], summary: {} });
  const [pending, setPending] = useState([]);
  const [offices, setOffices] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedSalesman, setSelectedSalesman] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(10); // Default 10s for real-time
  const [autoRefreshSec, setAutoRefreshSec] = useState(10);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [m, p, o, v] = await Promise.all([
        api.get("/monitoring/sales"),
        api.get("/outlets/pending"),
        api.get("/offices"),
        api.get("/visits", { params: { date: todayLocal(), limit: 200 } }),
      ]);

      const salesList = Array.isArray(m.data?.items)
        ? m.data.items
        : Array.isArray(m.data?.salesmen)
        ? m.data.salesmen
        : [];

      setData({
        items: salesList,
        summary: m.data?.summary || {},
      });
      setPending(Array.isArray(p.data?.items) ? p.data.items : []);
      setOffices(Array.isArray(o.data?.items) ? o.data.items : []);
      setVisits(Array.isArray(v.data?.items) ? v.data.items : []);
      setLastSyncTime(new Date());
    } catch (e) {
      if (!silent) toast.error(errMsg(e));
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    setAutoRefreshSec(refreshIntervalSec);
    if (refreshIntervalSec === 0) return; // Manual mode

    const interval = setInterval(() => {
      setAutoRefreshSec((prev) => {
        if (prev <= 1) {
          load(true); // Silent background fetch without disturbing UI
          return refreshIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [load, refreshIntervalSec]);

  const approve = async (id) => {
    try {
      await api.post(`/outlets/${id}/approve`);
      toast.success("Outlet berhasil disetujui.");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const reject = async (id) => {
    try {
      await api.post(`/outlets/${id}/reject`, { reason: "Ditolak supervisor" });
      toast.success("Outlet ditolak.");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const safeOffices = Array.isArray(offices) ? offices : [];
  const safeItems = Array.isArray(data.items) ? data.items : [];
  const safeVisits = Array.isArray(visits) ? visits : [];
  const safePending = Array.isArray(pending) ? pending : [];

  // Filtered sales items
  const filteredSales = useMemo(() => {
    return safeItems.filter((s) => {
      const matchQuery =
        !searchQuery ||
        (s.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.area || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.active_outlet || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && s.status !== "OFF_DUTY") ||
        s.status === statusFilter;

      return matchQuery && matchStatus;
    });
  }, [safeItems, searchQuery, statusFilter]);

  // Overall KPI computations
  const totalSalesmen = safeItems.length;
  const activeInField = safeItems.filter((s) => s.status !== "OFF_DUTY").length;
  const totalPlanned = safeItems.reduce((acc, s) => acc + (s.planned || 0), 0);
  const totalCalls = safeItems.reduce((acc, s) => acc + (s.outlet_calls || s.actual || 0), 0);
  const totalEC = safeItems.reduce((acc, s) => acc + (s.effective_calls || s.effective || 0), 0);
  const overallEcRate = totalCalls > 0 ? Math.round((totalEC / totalCalls) * 100) : 0;
  const totalVol = safeItems.reduce((acc, s) => acc + (s.volume || s.actual_volume || 0), 0);
  const totalRevenue = safeItems.reduce((acc, s) => acc + (s.sales_value || s.revenue || 0), 0);

  // Map markers and polylines
  const mapCenter = useMemo(() => {
    if (mapFocus) return [mapFocus.lat, mapFocus.lng];
    if (safeOffices[0]?.latitude) return [safeOffices[0].latitude, safeOffices[0].longitude];
    const firstSalesLoc = safeItems.find((s) => s.last_location?.lat)?.last_location;
    if (firstSalesLoc) return [firstSalesLoc.lat, firstSalesLoc.lng];
    return [-6.2146, 106.8451];
  }, [mapFocus, safeOffices, safeItems]);

  const markers = useMemo(() => {
    const list = [];

    // Office Markers
    safeOffices
      .filter((o) => o && o.latitude)
      .forEach((o, idx) => {
        list.push({
          id: `office-${o._id || idx}`,
          lat: o.latitude,
          lng: o.longitude,
          type: "OFFICE",
          title: o.office_name || "Kantor Pusat Mahameru",
          subtitle: o.office_code ? `Kode: ${o.office_code}` : "Kantor Depo Distribusi",
          status: o.status || "ACTIVE",
          statusLabel: o.status === "ACTIVE" ? "Kantor Aktif" : "Non-Aktif",
          color: "#0A2540",
          badge: "HQ",
          address: o.address || "Jawa Barat, Indonesia",
          radius: o.attendance_radius || o.radius_m || 200,
          checkInWindow: `${o.check_in_end ? `Maks. ${o.check_in_end}` : "08:15"} (Check-Out: ${o.check_out_start || "16:00"} - ${o.check_out_end || "23:00"})`,
          googleMapsUrl: `https://www.google.com/maps?q=${o.latitude},${o.longitude}`,
        });
      });

    // If a single salesman is selected, prioritize their trail and current location
    if (selectedSalesman) {
      const s = selectedSalesman;
      if (s.last_location && s.last_location.lat) {
        list.push({
          id: `sales-focus-${s.salesman_id}`,
          lat: s.last_location.lat,
          lng: s.last_location.lng,
          type: "SALESMAN",
          title: s.name,
          subtitle: `Area: ${s.area || "Umum"} · Kode: ${s.code || "-"}`,
          phone: s.phone,
          status: s.status,
          statusLabel: STATUS_LABEL[s.status] || "Aktif Lapangan",
          color: "#C5A059",
          badge: s.name ? s.name.charAt(0).toUpperCase() : "S",
          isPulsing: true,
          metrics: {
            effectiveCalls: s.effective_calls || s.effective || 0,
            totalCalls: s.outlet_calls || s.actual || 0,
            plannedCalls: s.planned || 0,
            ecRate:
              (s.outlet_calls || s.actual || 0) > 0
                ? Math.round(
                    ((s.effective_calls || s.effective || 0) /
                      (s.outlet_calls || s.actual || 0)) *
                      100
                  )
                : 0,
            volume: s.volume || s.actual_volume || 0,
            revenue: s.sales_value || s.revenue || 0,
          },
          googleMapsUrl: `https://www.google.com/maps?q=${s.last_location.lat},${s.last_location.lng}`,
        });
      }

      // Add their specific visits
      const trail = Array.isArray(s.visits_trail) ? s.visits_trail : [];
      trail.forEach((v, idx) => {
        if (v.check_in_lat && v.check_in_lng) {
          const isEC = v.call_result === "EFFECTIVE";
          list.push({
            id: `visit-trail-${v._id || idx}`,
            lat: v.check_in_lat,
            lng: v.check_in_lng,
            type: "VISIT",
            title: v.outlet_name || "Outlet Mahameru",
            subtitle: `Urutan Visit #${idx + 1} · ${v.outlet_code || "OUT"}`,
            salesmanName: s.name,
            phone: v.phone || v.outlet_phone,
            address: v.address || v.outlet_address,
            callResult: v.call_result || (isEC ? "EFFECTIVE" : "OPEN"),
            statusLabel: isEC ? "Effective Call (Order)" : "Open Call (Non-EC)",
            color: isEC ? "#10B981" : "#F59E0B",
            badge: `${idx + 1}`,
            checkInTime: v.check_in_time
              ? new Date(v.check_in_time).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null,
            revenue: v.revenue || v.order_total || 0,
            volume: v.volume || 0,
            reason: v.open_call_reason || v.reason || v.notes,
            googleMapsUrl: `https://www.google.com/maps?q=${v.check_in_lat},${v.check_in_lng}`,
          });
        }
      });

      return list;
    }

    // All Salesmen Locations
    safeItems
      .filter((s) => s && s.last_location && s.last_location.lat)
      .forEach((s, idx) => {
        const isVisiting = s.status === "VISITING";
        const isOnField = s.status === "ON_FIELD";
        const color = isVisiting ? "#3B82F6" : isOnField ? "#C5A059" : "#64748B";

        list.push({
          id: `sales-marker-${s._id || s.salesman_id || idx}`,
          lat: s.last_location.lat,
          lng: s.last_location.lng,
          type: "SALESMAN",
          title: s.name,
          subtitle: `Area: ${s.area || "Umum"} · ${s.code || "Sales"}`,
          phone: s.phone,
          status: s.status,
          statusLabel: STATUS_LABEL[s.status] || "Aktif Lapangan",
          color: color,
          badge: s.name ? s.name.charAt(0).toUpperCase() : "S",
          isPulsing: isVisiting || isOnField,
          metrics: {
            effectiveCalls: s.effective_calls || s.effective || 0,
            totalCalls: s.outlet_calls || s.actual || 0,
            plannedCalls: s.planned || 0,
            ecRate:
              (s.outlet_calls || s.actual || 0) > 0
                ? Math.round(
                    ((s.effective_calls || s.effective || 0) /
                      (s.outlet_calls || s.actual || 0)) *
                      100
                  )
                : 0,
            volume: s.volume || s.actual_volume || 0,
            revenue: s.sales_value || s.revenue || 0,
          },
          actionLabel: "Fokus Sales",
          onSelect: () => handleSelectSalesmanRow(s),
          googleMapsUrl: `https://www.google.com/maps?q=${s.last_location.lat},${s.last_location.lng}`,
        });
      });

    // Today's Visits
    safeVisits
      .filter((v) => v && v.check_in_lat)
      .forEach((v, idx) => {
        const isEC = v.call_result === "EFFECTIVE";
        const isOpen = v.call_result === "OPEN";
        const color = isEC ? "#10B981" : isOpen ? "#F59E0B" : "#3B82F6";

        list.push({
          id: `visit-marker-${v._id || idx}`,
          lat: v.check_in_lat,
          lng: v.check_in_lng,
          type: "VISIT",
          title: v.outlet_name || "Outlet Mahameru",
          subtitle: `Kode: ${v.outlet_code || "OUT"} · Channel: ${v.channel_name || "Retail"}`,
          salesmanName: v.salesman_name || "Sales Lapangan",
          phone: v.phone || v.outlet_phone,
          address: v.address || v.outlet_address,
          ownerName: v.owner_name,
          callResult: v.call_result || (isEC ? "EFFECTIVE" : "OPEN"),
          statusLabel: isEC ? "Effective Call (Order)" : isOpen ? "Open Call (Non-EC)" : "Kunjungan",
          color: color,
          badge: isEC ? "EC" : "NC",
          checkInTime: v.check_in_time
            ? new Date(v.check_in_time).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : null,
          revenue: v.revenue || v.order_total || 0,
          volume: v.volume || 0,
          reason: v.open_call_reason || v.reason || v.notes,
          googleMapsUrl: `https://www.google.com/maps?q=${v.check_in_lat},${v.check_in_lng}`,
        });
      });

    return list;
  }, [safeOffices, safeItems, safeVisits, selectedSalesman]);

  const circles = useMemo(() => {
    return safeOffices
      .filter((o) => o && o.latitude)
      .map((o, idx) => ({
        id: `office-circle-${o._id || idx}`,
        lat: o.latitude,
        lng: o.longitude,
        radius: o.attendance_radius || o.radius_m || 100,
        color: "#0A2540",
      }));
  }, [safeOffices]);

  // Polylines for selected salesman trail
  const polylines = useMemo(() => {
    if (!selectedSalesman || !selectedSalesman.visits_trail) return [];
    const trail = selectedSalesman.visits_trail;
    const positions = [];

    if (selectedSalesman.check_in_lat && selectedSalesman.check_in_lng) {
      positions.push([selectedSalesman.check_in_lat, selectedSalesman.check_in_lng]);
    }

    trail.forEach((v) => {
      if (v.check_in_lat && v.check_in_lng) {
        positions.push([v.check_in_lat, v.check_in_lng]);
      }
    });

    if (selectedSalesman.last_location?.lat && selectedSalesman.last_location?.lng) {
      positions.push([selectedSalesman.last_location.lat, selectedSalesman.last_location.lng]);
    }

    if (positions.length < 2) return [];

    return [
      {
        id: `trail-${selectedSalesman.salesman_id}`,
        positions,
        color: "#C5A059",
        weight: 4,
        dashArray: "6, 8",
        opacity: 0.85,
      },
    ];
  }, [selectedSalesman]);

  // Export summary to CSV
  const exportToCSV = () => {
    if (safeItems.length === 0) {
      toast.error("Tidak ada data monitoring sales untuk diexport.");
      return;
    }

    const headers = [
      "Nama Sales",
      "Kode",
      "Area",
      "Kantor/Depo",
      "Status",
      "Absen Masuk",
      "Planned Calls",
      "Outlet Calls",
      "Effective Calls (EC)",
      "EC Rate (%)",
      "Target Vol (Qty)",
      "Actual Vol (Qty)",
      "Ach (%)",
      "Total Nilai (Rp)",
      "Outlet Aktif",
    ];

    const rows = safeItems.map((s) => [
      `"${s.name || ""}"`,
      `"${s.code || s.salesman_id || ""}"`,
      `"${s.area || ""}"`,
      `"${s.office_name || ""}"`,
      `"${STATUS_LABEL[s.status] || s.status || ""}"`,
      `"${s.check_in_time ? fmtTime(s.check_in_time) : "-"}"`,
      s.planned || 0,
      s.outlet_calls || s.actual || 0,
      s.effective_calls || s.effective || 0,
      `${s.ec_rate || 0}%`,
      s.target_volume || 0,
      s.actual_volume || s.volume || 0,
      `"${s.achievement_formatted || (s.achievement_percentage ? `${s.achievement_percentage}%` : "-")}"`,
      s.sales_value || s.revenue || 0,
      `"${s.active_outlet || "-"}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Monitoring_Sales_${todayLocal()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Laporan monitoring sales berhasil diunduh.");
  };

  const handleSelectSalesmanRow = (salesman) => {
    setSelectedSalesman(salesman);
    if (salesman.last_location?.lat) {
      setMapFocus({ lat: salesman.last_location.lat, lng: salesman.last_location.lng });
    }
  };

  if (loading && safeItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-3" data-testid="monitoring-loading">
        <Loader2 className="animate-spin text-navy" size={36} />
        <span className="text-sm font-semibold text-slate-500">Memuat data real-time monitoring sales...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="monitoring-page">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-heading text-xl font-bold text-navy">Monitoring Sales &amp; Tim Lapangan</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Radar GPS Real-Time
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau aktivitas panggilan, lokasi GPS, progres target volume, dan efektivitas kunjungan sales hari ini ({todayLocal()}).
            Terakhir update: {lastSyncTime.toLocaleTimeString("id-ID")}.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Interval Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <Clock size={13} className="text-slate-500 ml-1.5" />
            <select
              value={refreshIntervalSec}
              onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none pr-2 cursor-pointer"
              title="Interval Sinkronisasi Real-Time Peta & Data"
            >
              <option value={5}>⚡ 5 Detik (Ultra Live Radar)</option>
              <option value={10}>🟢 10 Detik (Real-Time)</option>
              <option value={30}>⏱️ 30 Detik</option>
              <option value={60}>⏲️ 60 Detik</option>
              <option value={0}>⏸️ Manual</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} className="mr-1.5" /> Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            data-testid="monitoring-refresh"
            onClick={() => load(false)}
            disabled={loading}
            className="text-xs font-semibold border-slate-300 text-navy hover:bg-slate-50"
          >
            <RefreshCw size={14} className={`mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {refreshIntervalSec > 0 ? `Sinkron (${autoRefreshSec}s)` : "Refresh"}
          </Button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tim Sales</span>
            <Users size={16} className="text-blue-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-navy">{activeInField}</span>
            <span className="text-xs text-slate-400">/ {totalSalesmen} Aktif</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            {totalSalesmen - activeInField} Off Duty / Belum Absen
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outlet Calls</span>
            <Store size={16} className="text-indigo-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-indigo-700">{totalCalls}</span>
            <span className="text-xs text-slate-400">/ {totalPlanned} Plan</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            Pencapaian: {totalPlanned > 0 ? Math.round((totalCalls / totalPlanned) * 100) : 0}%
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Effective Call</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-700">{totalEC}</span>
            <span className="text-xs text-slate-400">EC</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            {totalCalls - totalEC} Non-Effective Call
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">EC Rate</span>
            <TrendingUp size={16} className="text-purple-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-purple-700">{overallEcRate}%</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            Rasio efektivitas order toko
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Volume Qty</span>
            <ShoppingBag size={16} className="text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-amber-700">{totalVol}</span>
            <span className="text-xs text-slate-400">Qty</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            Realisasi produk terdistribusi
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Nilai</span>
            <Target size={16} className="text-gold-dark" />
          </div>
          <div className="mt-1 text-base font-bold text-navy truncate">
            {rupiah(totalRevenue)}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            Faktur hari ini
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="sales" data-testid="tab-sales-monitoring" className="text-xs font-semibold">
            Sales, Peta &amp; Aktivitas
          </TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals" className="text-xs font-semibold relative">
            Approval Outlet Baru
            {safePending.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold">
                {safePending.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          {/* Map View & Live Visual Controller */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-navy" />
                <span className="text-xs font-bold text-navy">Peta Sebaran GPS &amp; Rute Kunjungan Tim</span>
                {selectedSalesman && (
                  <span className="text-xs font-semibold text-gold-dark bg-gold/10 px-2 py-0.5 rounded-full">
                    Fokus Sales: {selectedSalesman.name}
                  </span>
                )}
              </div>

              {selectedSalesman && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedSalesman(null);
                    setMapFocus(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 h-7"
                >
                  <X size={12} className="mr-1" /> Reset Fokus Peta
                </Button>
              )}
            </div>

            <MapView
              center={mapCenter}
              zoom={selectedSalesman ? 15 : 13}
              height="480px"
              markers={markers}
              circles={circles}
              polylines={polylines}
              showSearch={true}
              showLayerToggle={true}
              showFitBounds={true}
              showUserLocation={true}
            />

            {/* Map Legend */}
            <div className="flex gap-4 text-[11px] font-semibold text-slate-600 flex-wrap items-center pt-1 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-navy inline-block shadow-sm" /> Kantor / Depo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gold inline-block shadow-sm" /> Posisi Sales Live
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm" /> Effective Call (Order)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shadow-sm" /> Non-EC Call
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block shadow-sm" /> Sedang Dikunjungi
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <Input
                placeholder="Cari nama sales, kode, area, toko..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Filter size={13} /> Status:
              </span>
              {["ALL", "ACTIVE", "VISITING", "ON_FIELD", "ON_DUTY", "OFF_DUTY"].map((st) => (
                <Button
                  key={st}
                  variant={statusFilter === st ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(st)}
                  className={`h-8 text-xs font-semibold whitespace-nowrap ${
                    statusFilter === st ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {st === "ALL"
                    ? "Semua"
                    : st === "ACTIVE"
                    ? "Aktif Lapangan"
                    : STATUS_LABEL[st] || st}
                </Button>
              ))}
            </div>
          </div>

          {/* Sales Monitoring Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b border-slate-200">
                    {[
                      "Petugas Sales",
                      "Status Live",
                      "Plan Call",
                      "Outlet Call",
                      "Effective (EC)",
                      "EC Rate",
                      "Target Vol",
                      "Actual Vol",
                      "Ach %",
                      "Total Nilai (Rp)",
                      "Absen Masuk",
                      "Aksi",
                    ].map((h) => (
                      <TableHead key={h} className="text-xs font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap py-3">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((s, i) => {
                    const sm = s.summary || {};
                    const isSelected = selectedSalesman?.salesman_id === s.salesman_id;
                    return (
                      <TableRow
                        key={`sales-${s.salesman_id || s._id || i}`}
                        data-testid={`sales-row-${i}`}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isSelected ? "bg-blue-50/60" : ""
                        }`}
                        onClick={() => handleSelectSalesmanRow(s)}
                      >
                        <TableCell className="py-3">
                          <div className="font-bold text-navy text-sm">{s.name}</div>
                          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                            <span>{s.area || "Area -"}</span>
                            <span>•</span>
                            <span>{s.office_name || "Depo Pusat"}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {s.code || s.salesman_id}
                            {s.active_outlet && (
                              <span className="text-blue-600 font-semibold ml-1">@ {s.active_outlet}</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={s.status || "OFF_DUTY"} label={STATUS_LABEL[s.status] || "Off Duty"} />
                        </TableCell>

                        <TableCell className="font-semibold text-slate-700">
                          {sm.planned ?? s.planned ?? 0}
                        </TableCell>

                        <TableCell className="font-bold text-blue-600">
                          {sm.outlet_calls ?? sm.actual ?? s.actual ?? 0}
                        </TableCell>

                        <TableCell className="text-emerald-600 font-bold">
                          {sm.effective_calls ?? sm.effective ?? s.effective ?? 0}
                        </TableCell>

                        <TableCell className="text-purple-600 font-bold">
                          {sm.ec_rate ?? sm.effective_ratio ?? s.ec_rate ?? 0}%
                        </TableCell>

                        <TableCell className="text-slate-600 font-semibold">
                          {s.target_volume ? `${s.target_volume} Qty` : "-"}
                        </TableCell>

                        <TableCell className="text-emerald-700 font-bold">
                          {sm.total_volume ?? sm.volume ?? s.volume ?? 0} Qty
                        </TableCell>

                        <TableCell>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              (s.achievement_percentage || 0) >= 100
                                ? "bg-emerald-100 text-emerald-800"
                                : (s.achievement_percentage || 0) >= 75
                                ? "bg-gold/20 text-gold-dark"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {s.achievement_formatted || (s.target_volume ? `${s.achievement_percentage}%` : "-")}
                          </span>
                        </TableCell>

                        <TableCell className="font-bold text-navy">
                          {rupiah(sm.sales_value ?? s.sales_value ?? 0)}
                        </TableCell>

                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {s.check_in_time ? (
                            <div className="flex items-center gap-1">
                              <Clock size={12} className="text-slate-400" />
                              <span>{fmtTime(s.check_in_time)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSalesman(s);
                            }}
                            className="h-7 px-2 text-xs font-semibold text-navy hover:bg-navy hover:text-white"
                          >
                            <Eye size={12} className="mr-1" /> Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12 text-slate-400 text-sm">
                        Tidak ada data sales yang cocok dengan kriteria filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="space-y-3 pt-2">
          {safePending.length === 0 && (
            <div
              className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-400 space-y-2"
              data-testid="approvals-empty"
            >
              <CheckCircle2 size={36} className="mx-auto text-emerald-500/80" />
              <div className="font-bold text-slate-700">Semua Outlet Telah Disetujui</div>
              <p className="text-xs text-slate-400">Tidak ada pengajuan outlet baru yang menunggu persetujuan.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {safePending.map((o, i) => (
              <div
                key={`pending-${o._id || i}`}
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm"
                data-testid={`approval-row-${i}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-navy text-base">
                      {o.outlet_name}{" "}
                      <span className="text-slate-400 text-xs font-mono font-normal">({o.outlet_code})</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{o.address}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Pemilik: <span className="font-semibold">{o.owner_name}</span> · {o.phone || "-"}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>Diajukan oleh: <strong className="text-slate-600">{o.created_by_name || "-"}</strong></span>
                      <span>•</span>
                      <span>GPS: {o.latitude?.toFixed(5)}, {o.longitude?.toFixed(5)}</span>
                    </div>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                {o.photo && (
                  <img
                    src={o.photo}
                    alt="Foto Outlet"
                    className="w-full h-44 object-cover rounded-lg border border-slate-200"
                  />
                )}

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button
                    data-testid={`approve-${i}`}
                    onClick={() => approve(o._id)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9"
                  >
                    <Check size={14} className="mr-1.5" /> Setujui Outlet
                  </Button>
                  <Button
                    data-testid={`reject-${i}`}
                    onClick={() => reject(o._id)}
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 font-bold text-xs h-9"
                  >
                    <X size={14} className="mr-1.5" /> Tolak
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Salesman Detail Activity Trail Modal */}
      {selectedSalesman && (
        <Dialog open={!!selectedSalesman} onOpenChange={(open) => !open && setSelectedSalesman(null)}>
          <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-navy flex items-center justify-between">
                <span>Rincian Aktivitas: {selectedSalesman.name}</span>
                <StatusBadge
                  status={selectedSalesman.status || "OFF_DUTY"}
                  label={STATUS_LABEL[selectedSalesman.status] || "Off Duty"}
                />
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Area: {selectedSalesman.area || "-"} · Kantor: {selectedSalesman.office_name || "Depo Pusat"} · Kode: {selectedSalesman.code || selectedSalesman.salesman_id}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Quick Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Kunjungan</div>
                  <div className="text-base font-bold text-navy">
                    {selectedSalesman.outlet_calls || selectedSalesman.actual || 0} / {selectedSalesman.planned || 0}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Effective Call (EC)</div>
                  <div className="text-base font-bold text-emerald-600">
                    {selectedSalesman.effective_calls || selectedSalesman.effective || 0} EC
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Volume Qty</div>
                  <div className="text-base font-bold text-amber-700">
                    {selectedSalesman.volume || selectedSalesman.actual_volume || 0} Qty
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Penjualan</div>
                  <div className="text-base font-bold text-navy truncate">
                    {rupiah(selectedSalesman.sales_value || selectedSalesman.revenue || 0)}
                  </div>
                </div>
              </div>

              {/* Contact & Attendance */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock size={13} className="text-blue-600" />
                    <span>
                      Absensi Masuk: {selectedSalesman.check_in_time ? fmtDateTime(selectedSalesman.check_in_time) : "Belum Absen"}
                    </span>
                  </div>
                  {selectedSalesman.active_outlet && (
                    <div className="text-blue-700 font-bold flex items-center gap-1">
                      <Store size={13} /> Sedang di outlet: {selectedSalesman.active_outlet}
                    </div>
                  )}
                </div>

                {selectedSalesman.phone && (
                  <a
                    href={`https://wa.me/${selectedSalesman.phone.replace(/^0/, "62").replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"
                  >
                    <Phone size={13} /> Hubungi WhatsApp
                  </a>
                )}
              </div>

              {/* Timeline of Visits */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Kronologi Kunjungan Toko Hari Ini ({Array.isArray(selectedSalesman.visits_trail) ? selectedSalesman.visits_trail.length : 0})
                </h4>

                {(!selectedSalesman.visits_trail || selectedSalesman.visits_trail.length === 0) && (
                  <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Belum ada riwayat kunjungan toko yang tercatat hari ini.
                  </div>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {selectedSalesman.visits_trail?.map((v, idx) => (
                    <div
                      key={`visit-detail-${v._id || idx}`}
                      className="flex items-start justify-between p-3 rounded-lg border border-slate-200 bg-white text-xs hover:border-slate-300"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-navy flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span>{v.outlet_name}</span>
                          <span className="text-slate-400 text-[10px]">({v.outlet_code})</span>
                        </div>
                        <div className="text-slate-500 text-[11px] pl-6">{v.address}</div>
                        <div className="text-[10px] text-slate-400 pl-6 flex items-center gap-2">
                          <span>Waktu: {fmtTime(v.check_in_time)}</span>
                          {v.check_out_time && <span>- {fmtTime(v.check_out_time)}</span>}
                          {v.distance_m != null && <span>• Jarak GPS: {v.distance_m}m</span>}
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.call_result === "EFFECTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {v.call_result === "EFFECTIVE" ? "Effective Call" : "Non-EC Call"}
                        </span>
                        {v.revenue > 0 && (
                          <div className="font-bold text-navy text-xs">{rupiah(v.revenue)}</div>
                        )}
                        {v.volume > 0 && (
                          <div className="text-slate-500 text-[10px]">{v.volume} Qty</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" onClick={() => setSelectedSalesman(null)} className="text-xs">
                  Tutup
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
