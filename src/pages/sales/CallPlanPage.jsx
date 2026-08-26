import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Route,
  Calendar,
  Store,
  Map as MapIcon,
  List,
  Compass,
  Navigation,
} from "lucide-react";
import api, { errMsg } from "../../lib/api";
import StatusBadge from "../../components/StatusBadge";
import MapView from "../../components/MapView";
import { todayLocal, fmtDate } from "../../lib/format";
import { useLiveLocation } from "../../context/LiveLocationContext";
import { haversineMeters, formatDistance } from "../../lib/geo";

export default function CallPlanPage() {
  const navigate = useNavigate();
  const { coords: userCoords } = useLiveLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("list"); // list | map

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/call-plans/my", { params: { date: todayLocal() } });
      setData(data);
    } catch (e) {
      toast.error(errMsg(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.items || [];
  const summary = data?.summary || {};
  const completedCount = items.filter((it) => ["COMPLETED", "EFFECTIVE"].includes(it.status)).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const filteredItems = items.filter((it) => {
    const isVisited = ["COMPLETED", "EFFECTIVE"].includes(it.status);
    if (filter === "PENDING") return !isVisited;
    if (filter === "DONE") return isVisited;
    return true;
  });

  // Generate Map Markers & Polylines for Call Plan Route
  const { routeMarkers, routePolylines, mapCenter } = useMemo(() => {
    const markers = [];
    const validPositions = [];

    // If user coords available, start polyline from current position
    if (userCoords && !isNaN(userCoords.lat) && !isNaN(userCoords.lng)) {
      validPositions.push([userCoords.lat, userCoords.lng]);
    }

    items.forEach((it, idx) => {
      const outlet = it.outlet || {};
      const lat = Number(outlet.latitude ?? it.latitude);
      const lng = Number(outlet.longitude ?? it.longitude);
      const isVisited = ["COMPLETED", "EFFECTIVE"].includes(it.status);
      const seq = it.sequence || idx + 1;

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        validPositions.push([lat, lng]);

        let color = "#0A2540";
        let statusLabel = "Rute Plan";
        if (it.status === "EFFECTIVE") {
          color = "#10B981";
          statusLabel = "Effective (Order)";
        } else if (it.status === "COMPLETED") {
          color = "#3B82F6";
          statusLabel = "Selesai Visit";
        } else if (it.priority === "HIGH") {
          color = "#EF4444";
          statusLabel = "Prioritas Tinggi";
        }

        markers.push({
          id: it._id || `plan-marker-${idx}`,
          lat,
          lng,
          title: `${seq}. ${outlet.outlet_name || it.outlet_name || "Outlet"}`,
          subtitle: outlet.address || it.address,
          badge: `${seq}`,
          color,
          type: "VISIT",
          statusLabel,
          phone: outlet.phone || it.phone,
          ownerName: outlet.owner_name || it.owner_name,
          onSelect: () => navigate(`/outlets/${it.outlet_id}?plan_item=${it._id}`),
          actionLabel: "Buka Toko",
        });
      }
    });

    const polylines = [];
    if (validPositions.length >= 2) {
      polylines.push({
        id: "call-plan-route-line",
        positions: validPositions,
        color: "#C5A059",
        weight: 4,
        dashArray: "6, 6",
      });
    }

    const center =
      validPositions.length > 0
        ? validPositions[0]
        : userCoords
        ? [userCoords.lat, userCoords.lng]
        : [-6.2146, 106.8451];

    return { routeMarkers: markers, routePolylines: polylines, mapCenter: center };
  }, [items, userCoords, navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3" data-testid="callplan-loading">
        <Loader2 className="animate-spin text-navy" size={32} />
        <span className="text-sm font-medium text-slate-500">Memuat rute Call Plan...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="callplan-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-navy tracking-tight flex items-center gap-2">
            <Route className="text-gold" size={20} />
            Call Plan Hari Ini
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.plan ? `Disusun oleh ${data.plan.created_by_name || "Supervisor"}` : "Belum ada rencana kunjungan"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle: List vs Map */}
          {items.length > 0 && (
            <div className="flex bg-slate-200/80 p-1 rounded-xl">
              <button
                onClick={() => setViewMode("list")}
                title="Tampilan Daftar"
                className={`p-1.5 rounded-lg transition-all text-xs font-bold flex items-center gap-1 ${
                  viewMode === "list" ? "bg-white text-navy shadow-xs" : "text-slate-600 hover:text-navy"
                }`}
              >
                <List size={15} />
                <span className="hidden sm:inline">Daftar</span>
              </button>
              <button
                onClick={() => setViewMode("map")}
                title="Tampilan Peta Rute"
                className={`p-1.5 rounded-lg transition-all text-xs font-bold flex items-center gap-1 ${
                  viewMode === "map" ? "bg-white text-navy shadow-xs" : "text-slate-600 hover:text-navy"
                }`}
              >
                <MapIcon size={15} />
                <span className="hidden sm:inline">Peta Rute</span>
              </button>
            </div>
          )}

          <span className="text-xs font-bold text-navy bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
            <Calendar size={13} className="text-slate-400" />
            {fmtDate(todayLocal())}
          </span>
        </div>
      </div>

      {data?.plan && (
        <>
          {/* Progress Card */}
          <div className="bg-gradient-to-br from-navy to-navy-dark text-white rounded-2xl p-4 shadow-sm space-y-3 border border-navy-light/20">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-gold font-bold">Progres Kunjungan Rute</span>
                <div className="font-heading font-bold text-lg">{completedCount} dari {items.length} Outlet Selesai</div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
                  {progressPercent}%
                </span>
              </div>
            </div>
            <div className="w-full bg-white/15 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Quick Summary Counts */}
          <div className="grid grid-cols-5 gap-1 sm:gap-1.5 text-center" data-testid="callplan-summary">
            {[
              ["Planned", summary.planned || items.length, "text-navy"],
              ["Selesai", summary.completed ?? completedCount, "text-blue-700"],
              ["Effective", summary.effective ?? 0, "text-emerald-700"],
              ["Open", summary.open ?? 0, "text-amber-700"],
              ["Missed", summary.missed ?? 0, "text-rose-700"],
            ].map(([l, v, color]) => (
              <div key={l} className="bg-white border border-slate-200/90 rounded-xl p-1.5 sm:p-2.5 shadow-2xs">
                <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-400 font-bold truncate">{l}</div>
                <div className={`font-heading font-bold text-sm sm:text-base ${color}`}>{v ?? 0}</div>
              </div>
            ))}
          </div>

          {/* View Mode: Map View */}
          {viewMode === "map" && (
            <div className="space-y-2">
              <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapIcon size={16} className="text-navy" />
                    <span className="text-xs font-bold text-navy">Peta Rute Urutan Kunjungan Toko</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                    {routeMarkers.length} Toko Berkoordinat
                  </span>
                </div>

                <MapView
                  center={mapCenter}
                  zoom={14}
                  height="420px"
                  markers={routeMarkers}
                  polylines={routePolylines}
                  showUserLocation={true}
                  showLayerToggle={true}
                  showFitBounds={true}
                />

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-navy inline-block" /> Belum Visit
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Order (EC)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Selesai Visit
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex gap-1.5 bg-slate-200/60 p-1 rounded-xl">
            {[
              { id: "ALL", label: `Semua (${items.length})` },
              { id: "PENDING", label: `Belum (${items.length - completedCount})` },
              { id: "DONE", label: `Selesai (${completedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filter === tab.id
                    ? "bg-white text-navy shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </>
      )}

      {!data?.plan && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3 shadow-xs" data-testid="callplan-empty">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <MapPin size={24} />
          </div>
          <div className="text-base font-bold text-navy">Tidak ada call plan aktif hari ini</div>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Anda tetap dapat melakukan kunjungan ke outlet existing (Non-Plan) atau menambah outlet baru dari tab Outlet.
          </p>
          <button
            onClick={() => navigate("/outlets")}
            className="inline-flex items-center gap-2 bg-navy text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs hover:bg-navy-light transition-colors"
          >
            <Store size={14} /> Buka Daftar Outlet
          </button>
        </div>
      )}

      <div className="space-y-2">
        {filteredItems.map((it, idx) => {
          const isVisited = ["COMPLETED", "EFFECTIVE"].includes(it.status);
          const outlet = it.outlet || {};
          const lat = Number(outlet.latitude ?? it.latitude);
          const lng = Number(outlet.longitude ?? it.longitude);

          let distanceStr = null;
          if (userCoords && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            const dist = haversineMeters(userCoords.lat, userCoords.lng, lat, lng);
            distanceStr = formatDistance(dist);
          }

          return (
            <button
              key={it._id || `plan-item-${idx}`}
              data-testid={`callplan-item-${idx}`}
              onClick={() => navigate(`/outlets/${it.outlet_id}?plan_item=${it._id}`)}
              className={`w-full bg-white border rounded-2xl p-4 flex items-center gap-3 text-left shadow-2xs active:scale-[0.98] transition-all hover:shadow-xs ${
                isVisited
                  ? "border-slate-200/90 bg-slate-50/70"
                  : "border-slate-200/90 hover:border-navy/50"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-heading font-bold text-sm shrink-0 shadow-2xs ${
                  isVisited
                    ? "bg-emerald-600 text-white"
                    : "bg-navy text-white"
                }`}
              >
                {isVisited ? <CheckCircle2 size={18} /> : (it.sequence || idx + 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-navy truncate">{outlet.outlet_name || it.outlet_name}</span>
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">{outlet.address || it.address || "-"}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium">
                  {outlet.channel_name && <span>{outlet.channel_name}</span>}
                  {distanceStr && (
                    <span className="text-navy font-bold flex items-center gap-1 bg-navy/5 px-1.5 py-0.5 rounded">
                      <Compass size={10} /> {distanceStr}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <StatusBadge status={it.status} />
                {it.priority && <StatusBadge status={it.priority} />}
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
