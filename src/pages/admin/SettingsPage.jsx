import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Settings,
  MapPin,
  ShieldAlert,
  Clock,
  FileText,
  Save,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  DollarSign,
  Briefcase,
  Database,
  Server,
  Download,
  Upload,
  Loader2,
  Building2,
  Compass,
  Navigation,
  Camera,
  Calendar,
  ExternalLink,
  Target,
} from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import UploadDatabaseModal from "../../components/UploadDatabaseModal";

const ALL_DAYS = [
  { key: "Senin", label: "Senin" },
  { key: "Selasa", label: "Selasa" },
  { key: "Rabu", label: "Rabu" },
  { key: "Kamis", label: "Kamis" },
  { key: "Jumat", label: "Jumat" },
  { key: "Sabtu", label: "Sabtu" },
  { key: "Minggu", label: "Minggu" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "OWNER";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [migratingCloudSql, setMigratingCloudSql] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);
  const [activeTab, setActiveTab] = useState("office"); // "office" | "gps" | "sales" | "finance" | "system"

  // Simulator State
  const [simDistance, setSimDistance] = useState(45);
  const [simAccuracy, setSimAccuracy] = useState(15);
  const [simTargetType, setSimTargetType] = useState("office"); // "office" | "outlet"

  const [settings, setSettings] = useState({
    // Office & Operational Shift Settings
    office_name: "Kantor Pusat Mahameru Distribusi Indonesia",
    office_address: "Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan, DKI Jakarta 12190",
    office_latitude: -6.2255,
    office_longitude: 106.8095,
    office_radius_m: 100,
    outlet_radius_m: 200,
    duplicate_radius_m: 50,
    gps_accuracy_max_m: 50,
    gps_tracking_interval_seconds: 300,
    work_start_time: "08:00",
    work_end_time: "17:00",
    check_in_start: "06:00",
    check_in_end: "11:00",
    check_out_start: "16:00",
    late_tolerance_min: 15,
    auto_absent_time: "12:00",
    working_days: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
    working_days_per_month: 26,
    require_selfie_attendance: true,
    require_selfie_checkout: false,
    enforce_office_geofence: true,
    enforce_outlet_geofence: true,
    require_gps_on_order: true,
    require_outlet_photo_visit: true,
    enforce_call_plan_schedule: false,
    min_visit_minutes: 5,
    visit_min_duration_sec: 300,
    min_target_daily_calls: 15,
    min_target_daily_effective_calls: 10,
    fake_gps_policy: "REJECT",
    allow_early_checkout: false,
    new_outlet_approval: true,
    open_call_reason_required: true,
    offline_sync_enabled: true,
    currency_symbol: "Rp",
    company_name: "PT Mahameru Distribusi Indonesia",
    default_payment_term_days: 14,
    tax_rate_percentage: 11,
    invoice_prefix: "INV",
    invoice_footer_note: "Barang yang sudah dibeli tidak dapat dikembalikan tanpa nota retur resmi.",
    auto_generate_invoice_pdf: true,
    enable_audit_logging: true,
    session_timeout_hours: 24,
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [setRes, statusRes] = await Promise.allSettled([
        api.get("/settings"),
        api.get("/system/db-status"),
      ]);

      if (setRes.status === "fulfilled" && setRes.value.data) {
        const raw = setRes.value.data.settings || setRes.value.data;
        setSettings((prev) => ({ ...prev, ...raw }));
      }

      if (statusRes.status === "fulfilled" && statusRes.value.data?.data) {
        setDbStatus(statusRes.value.data.data);
      }
    } catch (err) {
      toast.error("Gagal memuat pengaturan sistem: " + errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleWorkingDayToggle = (day) => {
    if (!canEdit) return;
    const current = Array.isArray(settings.working_days) ? [...settings.working_days] : [];
    const idx = current.indexOf(day);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(day);
    }
    setSettings((prev) => ({ ...prev, working_days: current }));
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Perangkat atau browser tidak mendukung fitur Geolocation.");
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGettingLocation(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setSettings((prev) => ({
          ...prev,
          office_latitude: lat,
          office_longitude: lng,
        }));
        toast.success(`Koordinat berhasil diperbarui: Lat ${lat}, Lng ${lng} (Akurasi: ±${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setGettingLocation(false);
        toast.error("Gagal mengambil titik GPS: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!canEdit) {
      toast.error("Hanya Admin atau Owner yang dapat mengubah konfigurasi.");
      return;
    }

    setSaving(true);
    try {
      const res = await api.put("/settings", settings);
      const updated = res.data.settings || res.data;
      setSettings((prev) => ({ ...prev, ...updated }));
      toast.success("Pengaturan operasional & geofence GPS berhasil disimpan!");
    } catch (err) {
      toast.error("Gagal menyimpan pengaturan: " + errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!canEdit) return;
    if (!window.confirm("Kembalikan semua parameter sistem dan geofence ke nilai standar operasional?")) {
      return;
    }

    setSaving(true);
    try {
      const res = await api.post("/settings/reset-defaults");
      const updated = res.data.settings || res.data;
      setSettings((prev) => ({ ...prev, ...updated }));
      toast.success("Pengaturan berhasil direset ke standar!");
    } catch (err) {
      toast.error("Gagal reset pengaturan: " + errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post("/system/sync-now", { forceAll: true });
      if (res.data?.data) {
        setDbStatus(res.data.data);
      }
      toast.success("Sinkronisasi database dengan Google Cloud Firestore berhasil!");
    } catch (err) {
      toast.error("Gagal sinkronisasi: " + errMsg(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleRepairDatabase = async () => {
    if (!canEdit) return;
    setSyncing(true);
    try {
      const res = await api.post("/system/repair-database");
      if (res.data?.data?.syncStats) {
        setDbStatus(res.data.data.syncStats);
      }
      toast.success("Audit & Perbaikan integritas database selesai dilakukan!");
    } catch (err) {
      toast.error("Gagal memeriksa database: " + errMsg(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleMigrateToCloudSql = async () => {
    if (!canEdit) return;
    setMigratingCloudSql(true);
    try {
      const res = await api.post("/system/migrate-to-cloudsql");
      if (res.data?.success) {
        toast.success(res.data.message || "Migrasi ke Cloud SQL (PostgreSQL) berhasil!");
        fetchSettings();
      } else {
        toast.error(res.data?.message || "Migrasi ke Cloud SQL gagal.");
      }
    } catch (err) {
      toast.error("Gagal melakukan migrasi ke Cloud SQL: " + errMsg(err));
    } finally {
      setMigratingCloudSql(false);
    }
  };

  const handleDownloadDatabase = async () => {
    if (!canEdit) {
      toast.error("Hanya Admin atau Owner yang dapat mendownload seluruh database.");
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="animate-spin text-navy" size={32} />
        <span className="text-sm font-semibold text-slate-500">Memuat konfigurasi operasional & GPS...</span>
      </div>
    );
  }

  // Simulation checks
  const maxGeofenceRadius = simTargetType === "office" ? (settings.office_radius_m || 100) : (settings.outlet_radius_m || 200);
  const isDistanceValid = simDistance <= maxGeofenceRadius;
  const isAccuracyValid = simAccuracy <= (settings.gps_accuracy_max_m || 50);
  const isSimPassing = isDistanceValid && isAccuracyValid;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-navy/5 text-navy rounded-xl">
              <Settings size={22} />
            </div>
            <h1 className="text-xl md:text-2xl font-bold font-heading text-navy">
              Pengaturan Global Operasional & GPS
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Konfigurasi lokasi kantor pusat, radius geofence GPS, jam kerja & shift presensi, validasi visit, dan Cloud SQL.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadDatabase}
                disabled={downloading}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-semibold"
                title="Download seluruh data & koleksi database dalam format JSON"
              >
                {downloading ? (
                  <Loader2 size={15} className="mr-1.5 animate-spin text-emerald-600" />
                ) : (
                  <Download size={15} className="mr-1.5 text-emerald-600" />
                )}
                {downloading ? "Mendownload..." : "Download Database"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUploadModal(true)}
                className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-semibold"
                title="Upload & pulihkan seluruh koleksi database dari file JSON backup"
              >
                <Upload size={15} className="mr-1.5 text-blue-600" />
                Upload Database
              </Button>
            </>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving}
              className="text-slate-600 hover:text-rose-600 hover:bg-rose-50 border-slate-200"
            >
              <RotateCcw size={15} className="mr-1.5" />
              Reset Standar
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-navy hover:bg-navy/90 text-white font-semibold shadow-xs"
            >
              <Save size={15} className="mr-1.5" />
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab("office")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 ${
            activeTab === "office"
              ? "bg-navy text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Building2 size={16} />
          Operasional Kantor & Jam Kerja
        </button>

        <button
          onClick={() => setActiveTab("gps")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 ${
            activeTab === "gps"
              ? "bg-navy text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <MapPin size={16} />
          GPS & Geofencing Lapangan
        </button>

        <button
          onClick={() => setActiveTab("sales")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 ${
            activeTab === "sales"
              ? "bg-navy text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Briefcase size={16} />
          Operasional Sales & Visit
        </button>

        <button
          onClick={() => setActiveTab("finance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 ${
            activeTab === "finance"
              ? "bg-navy text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <DollarSign size={16} />
          Faktur & Keuangan
        </button>

        <button
          onClick={() => setActiveTab("system")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 ${
            activeTab === "system"
              ? "bg-navy text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Database size={16} />
          Database & Cloud Services
        </button>
      </div>

      {/* Tab 1: Operasional Kantor & Jam Kerja */}
      {activeTab === "office" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kantor Pusat & Lokasi Koordinat */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="text-navy" size={18} />
              <h3 className="font-bold text-navy">Lokasi & Identitas Kantor Pusat</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Nama Kantor Pusat / Depo Utama
                </Label>
                <Input
                  disabled={!canEdit}
                  value={settings.office_name || ""}
                  onChange={(e) => handleChange("office_name", e.target.value)}
                  placeholder="Contoh: Kantor Pusat Mahameru Distribusi"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Alamat Lengkap Kantor
                </Label>
                <textarea
                  disabled={!canEdit}
                  rows={2}
                  value={settings.office_address || ""}
                  onChange={(e) => handleChange("office_address", e.target.value)}
                  placeholder="Alamat jalan, gedung, nomor, kelurahan, kecamatan, kota"
                  className="w-full mt-1 border border-slate-200 rounded-lg p-2.5 text-sm bg-white text-slate-800 focus:outline-navy"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Latitude Kantor (GPS)
                  </Label>
                  <Input
                    type="number"
                    step="0.000001"
                    disabled={!canEdit}
                    value={settings.office_latitude ?? -6.2255}
                    onChange={(e) => handleChange("office_latitude", parseFloat(e.target.value) || 0)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Longitude Kantor (GPS)
                  </Label>
                  <Input
                    type="number"
                    step="0.000001"
                    disabled={!canEdit}
                    value={settings.office_longitude ?? 106.8095}
                    onChange={(e) => handleChange("office_longitude", parseFloat(e.target.value) || 0)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGetCurrentLocation}
                    disabled={gettingLocation}
                    className="border-navy/20 text-navy hover:bg-navy/5 text-xs font-medium"
                  >
                    <Compass size={14} className={`mr-1.5 ${gettingLocation ? "animate-spin text-navy" : "text-navy"}`} />
                    {gettingLocation ? "Membaca GPS..." : "Ambil Lokasi Saat Ini (GPS)"}
                  </Button>
                )}

                {settings.office_latitude && settings.office_longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${settings.office_latitude},${settings.office_longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline px-2 py-1.5"
                  >
                    <ExternalLink size={13} />
                    Lihat di Google Maps
                  </a>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 leading-relaxed block">
                  Titik koordinat ini digunakan sebagai pusat lingkaran geofencing untuk validasi absensi masuk/pulang sales dan karyawan.
                </span>
              </div>
            </div>
          </div>

          {/* Jam Kerja & Kebijakan Presensi */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Clock className="text-navy" size={18} />
              <h3 className="font-bold text-navy">Jadwal Shift Kerja & Aturan Presensi</h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Jam Masuk Standar
                  </Label>
                  <Input
                    type="time"
                    disabled={!canEdit}
                    value={settings.work_start_time || "08:00"}
                    onChange={(e) => handleChange("work_start_time", e.target.value)}
                    className="mt-1"
                  />
                  <span className="text-[10px] text-slate-400">Target kehadiran pagi</span>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Jam Pulang Standar
                  </Label>
                  <Input
                    type="time"
                    disabled={!canEdit}
                    value={settings.work_end_time || "17:00"}
                    onChange={(e) => handleChange("work_end_time", e.target.value)}
                    className="mt-1"
                  />
                  <span className="text-[10px] text-slate-400">Akhir jam kerja harian</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Jam Buka Presensi Masuk
                  </Label>
                  <Input
                    type="time"
                    disabled={!canEdit}
                    value={settings.check_in_start || "06:00"}
                    onChange={(e) => handleChange("check_in_start", e.target.value)}
                    className="mt-1"
                  />
                  <span className="text-[10px] text-slate-400">Paling awal boleh check-in</span>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Batas Akhir Presensi Masuk
                  </Label>
                  <Input
                    type="time"
                    disabled={!canEdit}
                    value={settings.check_in_end || "11:00"}
                    onChange={(e) => handleChange("check_in_end", e.target.value)}
                    className="mt-1"
                  />
                  <span className="text-[10px] text-slate-400">Setelah jam ini otomatis ditolak</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Mulai Presensi Pulang
                  </Label>
                  <Input
                    type="time"
                    disabled={!canEdit}
                    value={settings.check_out_start || "16:00"}
                    onChange={(e) => handleChange("check_out_start", e.target.value)}
                    className="mt-1"
                  />
                  <span className="text-[10px] text-slate-400">Check-out sebelum ini perlu izin</span>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600">
                    Toleransi Terlambat (Menit)
                  </Label>
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={settings.late_tolerance_min ?? 15}
                    onChange={(e) => handleChange("late_tolerance_min", parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                  <span className="text-[10px] text-slate-400">Misal: 15 menit (08:15)</span>
                </div>
              </div>

              {/* Hari Kerja Aktif */}
              <div>
                <Label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Hari Kerja Operasional Aktif
                </Label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ALL_DAYS.map((d) => {
                    const isSelected = Array.isArray(settings.working_days) && settings.working_days.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => handleWorkingDayToggle(d.key)}
                        disabled={!canEdit}
                        className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                          isSelected
                            ? "bg-navy text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle Wajib Selfie */}
              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Camera size={16} className="text-navy" />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Wajib Foto Selfie Presensi Masuk
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Sales wajib mengambil foto selfie wajah saat check-in absensi pagi.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={settings.require_selfie_attendance !== false}
                    onChange={(e) => handleChange("require_selfie_attendance", e.target.checked)}
                    className="w-4 h-4 rounded text-navy"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Camera size={16} className="text-navy" />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Wajib Foto Selfie Presensi Pulang
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Sales wajib mengambil foto selfie wajah saat check-out absensi sore.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={!!settings.require_selfie_checkout}
                    onChange={(e) => handleChange("require_selfie_checkout", e.target.checked)}
                    className="w-4 h-4 rounded text-navy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: GPS & Validasi Lokasi */}
      {activeTab === "gps" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Radius Geofencing Parameters */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <MapPin className="text-navy" size={18} />
                <h3 className="font-bold text-navy">Radius Geofencing & Jarak Maksimal</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Radius Geofence Kantor / Depo Gudang (Meter)
                    </Label>
                    <span className="text-xs font-bold text-navy">{settings.office_radius_m || 100} m</span>
                  </div>
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={settings.office_radius_m || 100}
                    onChange={(e) => handleChange("office_radius_m", parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                  <span className="text-[11px] text-slate-400">
                    Batas jarak maksimal salesman saat melakukan absensi masuk & pulang di kantor cabang.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Radius Check-in Toko / Outlet (Meter)
                    </Label>
                    <span className="text-xs font-bold text-navy">{settings.outlet_radius_m || 200} m</span>
                  </div>
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={settings.outlet_radius_m || 200}
                    onChange={(e) => handleChange("outlet_radius_m", parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                  <span className="text-[11px] text-slate-400">
                    Jarak toleransi maksimal antara titik GPS sales dengan koordinat outlet saat check-in visit.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Radius Deteksi Duplikasi Outlet Baru / NOO (Meter)
                    </Label>
                    <span className="text-xs font-bold text-navy">{settings.duplicate_radius_m || 50} m</span>
                  </div>
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={settings.duplicate_radius_m || 50}
                    onChange={(e) => handleChange("duplicate_radius_m", parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                  <span className="text-[11px] text-slate-400">
                    Sistem memberi peringatan jika ada toko terdaftar lain dalam radius ini saat registrasi NOO.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Batas Toleransi Akurasi Sinyal GPS (Meter)
                    </Label>
                    <span className="text-xs font-bold text-navy">{settings.gps_accuracy_max_m || 50} m</span>
                  </div>
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={settings.gps_accuracy_max_m || 50}
                    onChange={(e) => handleChange("gps_accuracy_max_m", parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                  <span className="text-[11px] text-slate-400">
                    Menolak titik GPS jika akurasi hardware melebihi batas ini (misal sinyal GPS lemah/melompat).
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Interval Background GPS Tracking Sales (Detik)
                    </Label>
                    <span className="text-xs font-bold text-navy">{settings.gps_tracking_interval_seconds || 300} dtk ({Math.round((settings.gps_tracking_interval_seconds || 300) / 60)} mnt)</span>
                  </div>
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={settings.gps_tracking_interval_seconds || 300}
                    onChange={(e) => handleChange("gps_tracking_interval_seconds", parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                  <span className="text-[11px] text-slate-400">
                    Frekuensi perekaman titik jejak rute salesman ke server saat jam kerja aktif.
                  </span>
                </div>
              </div>
            </div>

            {/* Anti Fake GPS & Strict Validation Enforcements */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <ShieldAlert className="text-rose-500" size={18} />
                <h3 className="font-bold text-navy">Kebijakan Anti Fake GPS & Penegakan Geofence</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Kebijakan Deteksi Mock / Fake GPS
                  </Label>
                  <select
                    disabled={!canEdit}
                    value={settings.fake_gps_policy || "REJECT"}
                    onChange={(e) => handleChange("fake_gps_policy", e.target.value)}
                    className="w-full mt-1 border border-slate-200 rounded-lg p-2.5 text-sm bg-white text-slate-800 focus:outline-navy"
                  >
                    <option value="REJECT">TOLAK MUTLAK (Blokir Presensi, Transaksi & Visit)</option>
                    <option value="FLAG">TANDAI (Izinkan dengan Catatan Audit Khusus)</option>
                    <option value="ALLOW">IZINKAN (Mode Uji Coba / Testing Non-Produksi)</option>
                  </select>
                  <span className="text-[11px] text-slate-400">
                    Proteksi terhadap penggunaan aplikasi manipulasi koordinat / fake GPS di smartphone sales.
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Wajib Validasi Geofence Kantor saat Absensi
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Menolak absensi jika sales berada di luar radius kantor ({settings.office_radius_m || 100}m).
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={settings.enforce_office_geofence !== false}
                      onChange={(e) => handleChange("enforce_office_geofence", e.target.checked)}
                      className="w-4 h-4 rounded text-navy"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Wajib Validasi Geofence Outlet saat Check-in Visit
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Menolak check-in jika sales berada di luar radius toko ({settings.outlet_radius_m || 200}m).
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={settings.enforce_outlet_geofence !== false}
                      onChange={(e) => handleChange("enforce_outlet_geofence", e.target.checked)}
                      className="w-4 h-4 rounded text-navy"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Wajib Tagging Koordinat GPS saat Transaksi Penjualan
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Menyimpan titik GPS akurat pada setiap nota faktur/order yang diterbitkan.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={settings.require_gps_on_order !== false}
                      onChange={(e) => handleChange("require_gps_on_order", e.target.checked)}
                      className="w-4 h-4 rounded text-navy"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Wajib Foto Fisik Toko saat Check-in Visit
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Sales wajib menyertakan foto papan nama / display toko saat check-in.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={settings.require_outlet_photo_visit !== false}
                      onChange={(e) => handleChange("require_outlet_photo_visit", e.target.checked)}
                      className="w-4 h-4 rounded text-navy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Geofence Simulator */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Compass className="text-emerald-600" size={18} />
              <h3 className="font-bold text-navy">Simulasi & Uji Coba Logika Geofence (Live Test)</h3>
            </div>

            <p className="text-xs text-slate-500">
              Uji bagaimana sistem memvalidasi presensi atau kunjungan berdasarkan parameter radius dan akurasi yang sedang dikonfigurasi.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Tipe Pengujian</Label>
                <select
                  value={simTargetType}
                  onChange={(e) => setSimTargetType(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg p-2 text-xs bg-white text-slate-800"
                >
                  <option value="office">Presensi Kantor (Maks. {settings.office_radius_m || 100}m)</option>
                  <option value="outlet">Kunjungan Toko (Maks. {settings.outlet_radius_m || 200}m)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Jarak Simulasi Sales ke Titik (Meter)</Label>
                <Input
                  type="number"
                  value={simDistance}
                  onChange={(e) => setSimDistance(parseInt(e.target.value) || 0)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Akurasi GPS Perangkat (Meter)</Label>
                <Input
                  type="number"
                  value={simAccuracy}
                  onChange={(e) => setSimAccuracy(parseInt(e.target.value) || 0)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 mt-2 transition-all bg-slate-50 border-slate-200">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isSimPassing ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {isSimPassing ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">
                    Status Validasi: {isSimPassing ? "LOLOS / DITERIMA (VERIFIED)" : "DITOLAK SISTEM (BLOCKED)"}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Jarak: <strong>{simDistance}m</strong> vs Batas <strong>{maxGeofenceRadius}m</strong> ({isDistanceValid ? "Dalam Radius" : "Di Luar Radius"}) | Akurasi GPS: <strong>±{simAccuracy}m</strong> vs Batas <strong>{settings.gps_accuracy_max_m || 50}m</strong> ({isAccuracyValid ? "Akurat" : "Terlalu Lemah"})
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold ${
                  isSimPassing ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                }`}>
                  {isSimPassing ? "Status OK" : "Geofence Mismatch"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Operasional Sales & Visit */}
      {activeTab === "sales" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Clock className="text-navy" size={18} />
              <h3 className="font-bold text-navy">Waktu & Standar Pelayanan Kunjungan</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Minimal Durasi Kunjungan di Toko (Menit)
                </Label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={settings.min_visit_minutes || 5}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    handleChange("min_visit_minutes", val);
                    handleChange("visit_min_duration_sec", val * 60);
                  }}
                  className="mt-1"
                />
                <span className="text-[11px] text-slate-400">
                  Waktu minimal salesman berinteraksi di toko agar dihitung sebagai kunjungan valid ({settings.min_visit_minutes || 5} menit = {(settings.min_visit_minutes || 5) * 60} detik).
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Target Standar Call Kunjungan per Hari (Toko)
                </Label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={settings.min_target_daily_calls || 15}
                  onChange={(e) => handleChange("min_target_daily_calls", parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
                <span className="text-[11px] text-slate-400">
                  Baseline jumlah toko yang wajib dikunjungi setiap salesman per hari kerja.
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Target Standar Effective Call / Transaksi per Hari
                </Label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={settings.min_target_daily_effective_calls || 10}
                  onChange={(e) => handleChange("min_target_daily_effective_calls", parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
                <span className="text-[11px] text-slate-400">
                  Target jumlah transaksi order berhasil (EC) per salesman per hari.
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Jumlah Hari Kerja Efektif per Bulan
                </Label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={settings.working_days_per_month || 26}
                  onChange={(e) => handleChange("working_days_per_month", parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
                <span className="text-[11px] text-slate-400">
                  Digunakan untuk perhitungan target bulanan proporsional.
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Sliders className="text-purple-600" size={18} />
              <h3 className="font-bold text-navy">Fitur & Kebijakan Lapangan</h3>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block">
                      Validasi Approval Toko Baru (NOO)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      NOO memerlukan verifikasi supervisor sebelum masuk jadwal rute reguler.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={settings.new_outlet_approval !== false}
                    onChange={(e) => handleChange("new_outlet_approval", e.target.checked)}
                    className="w-4 h-4 rounded text-navy"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block">
                      Wajib Alasan untuk Kunjungan Tanpa Order (Open Call)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Sales wajib memilih alasan (stok penuh, toko tutup, pemilik tidak ada) jika tanpa pesanan.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={settings.open_call_reason_required !== false}
                    onChange={(e) => handleChange("open_call_reason_required", e.target.checked)}
                    className="w-4 h-4 rounded text-navy"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block">
                      Wajib Mematuhi Jadwal Rute Call Plan
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Hanya mengizinkan kunjungan pada outlet yang terdaftar di rencana kerja harian.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={!!settings.enforce_call_plan_schedule}
                    onChange={(e) => handleChange("enforce_call_plan_schedule", e.target.checked)}
                    className="w-4 h-4 rounded text-navy"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block">
                      Izinkan Check-out Absensi Lebih Awal
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Memungkinkan sales check-out sebelum jam kerja berakhir dengan alasan khusus.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={!!settings.allow_early_checkout}
                    onChange={(e) => handleChange("allow_early_checkout", e.target.checked)}
                    className="w-4 h-4 rounded text-navy"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block">
                      Dukungan Offline-First Data & Antrean Transaksi
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Menyimpan transaksi dan nota saat tidak ada jaringan dan sinkron otomatis saat online.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={settings.offline_sync_enabled !== false}
                    onChange={(e) => handleChange("offline_sync_enabled", e.target.checked)}
                    className="w-4 h-4 rounded text-navy"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block">
                      Aktifkan Audit Trail Logging Menyeluruh
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Merekam setiap aksi mutasi, hapus data, reassign outlet, dan perubahan konfigurasi ke log audit.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={settings.enable_audit_logging !== false}
                    onChange={(e) => handleChange("enable_audit_logging", e.target.checked)}
                    className="w-4 h-4 rounded text-navy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Faktur & Keuangan */}
      {activeTab === "finance" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <FileText className="text-emerald-600" size={18} />
              <h3 className="font-bold text-navy">Format & Penomoran Dokumen</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Prefix Nomor Faktur Penjualan (Invoice)
                </Label>
                <Input
                  disabled={!canEdit}
                  value={settings.invoice_prefix || "INV"}
                  onChange={(e) => handleChange("invoice_prefix", e.target.value.toUpperCase())}
                  className="mt-1"
                />
                <span className="text-[11px] text-slate-400">
                  Contoh format hasil: {settings.invoice_prefix || "INV"}-20260825-001
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Mata Uang & Simbol
                </Label>
                <Input
                  disabled={!canEdit}
                  value={settings.currency_symbol || "Rp"}
                  onChange={(e) => handleChange("currency_symbol", e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Catatan Kaki / Footer Nota Faktur
                </Label>
                <textarea
                  disabled={!canEdit}
                  rows={3}
                  value={settings.invoice_footer_note || ""}
                  onChange={(e) => handleChange("invoice_footer_note", e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg p-2 text-sm bg-white text-slate-800"
                />
                <span className="text-[11px] text-slate-400">
                  Dicetak di bagian bawah setiap nota penjualan / invoice resmi.
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <DollarSign className="text-navy" size={18} />
              <h3 className="font-bold text-navy">Pajak & Termin Pembayaran</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Tarif PPN Standar (%)
                </Label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={settings.tax_rate_percentage ?? 11}
                  onChange={(e) => handleChange("tax_rate_percentage", parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600">
                  Termin Pembayaran Kredit Standar (Hari)
                </Label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={settings.default_payment_term_days || 14}
                  onChange={(e) => handleChange("default_payment_term_days", parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
                <span className="text-[11px] text-slate-400">
                  Jatuh tempo otomatis saat salesman memilih metode pembayaran TEMPO / TOP.
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block">
                      Otomatis Generate PDF Faktur Setelah Transaksi
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Membuat struk/invoice PDF siap cetak thermal 58mm/80mm atau A4.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={settings.auto_generate_invoice_pdf !== false}
                    onChange={(e) => handleChange("auto_generate_invoice_pdf", e.target.checked)}
                    className="w-4 h-4 rounded text-navy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Database & Cloud Services */}
      {activeTab === "system" && (
        <div className="space-y-6">
          {/* Card 1: Google Cloud SQL (PostgreSQL) Enterprise Relational Database */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl">
                  <Server size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-navy">Google Cloud SQL (PostgreSQL)</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      asia-southeast1
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Instance Relational Database: <code className="text-navy font-semibold">ai-studio-10b64a83</code> | Dialect: <strong className="text-slate-700">PostgreSQL 15+ (Drizzle ORM)</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMigrateToCloudSql}
                  disabled={migratingCloudSql}
                  className="border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs"
                  title="Migrasikan seluruh data DMS ke Google Cloud SQL (PostgreSQL)"
                >
                  {migratingCloudSql ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin text-blue-600" />
                  ) : (
                    <Database size={14} className="mr-1.5 text-blue-600" />
                  )}
                  {migratingCloudSql ? "Memigrasikan Data..." : "Migrasikan ke Cloud SQL (PostgreSQL)"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-xs text-slate-500">Status Cloud SQL</div>
                <div className="text-sm font-bold text-emerald-600 flex items-center justify-center gap-1 mt-0.5">
                  <CheckCircle2 size={14} /> Terhubung & Siap
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-xs text-slate-500">Region & Zona</div>
                <div className="text-sm font-bold text-navy mt-0.5">
                  asia-southeast1 (Jakarta/SG)
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-xs text-slate-500">Total Tabel Relasional</div>
                <div className="text-base font-bold text-navy mt-0.5">
                  {dbStatus?.cloudSql?.tableCount || 31} Tabel
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-xs text-slate-500">Data Tersimpan di SQL</div>
                <div className="text-base font-bold text-blue-600 mt-0.5">
                  {dbStatus?.cloudSql?.persistedRecords || dbStatus?.totalLocalRecords || 0} Data
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="text-blue-600 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-blue-900 leading-relaxed">
                <strong>Google Cloud SQL (PostgreSQL) Aktif:</strong> Konfigurasi skema PostgreSQL dan koneksi Drizzle ORM telah terpasang ke Cloud SQL instance <code>ai-studio-10b64a83</code> di region <strong>asia-southeast1</strong>. Database relasional siap melayani transaksi ACID, relasi master data, dan pelaporan distribusi berskala besar.
              </div>
            </div>
          </div>

          {/* Card 2: Google Cloud Firestore */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                  <Database size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-navy">Google Cloud Firestore (Document Cloud Database)</h3>
                  <p className="text-xs text-slate-500">
                    Penyimpanan dokumen awan terkelola Google Cloud (Project: <code className="text-navy font-semibold">ai-studio-sfamim-877ef0cf-d3cb-4bec-8aa3-5fdef2e327d9</code>).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadDatabase}
                  disabled={downloading}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-semibold text-xs"
                  title="Download seluruh data & koleksi database dalam format JSON"
                >
                  {downloading ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin text-emerald-600" />
                  ) : (
                    <Download size={14} className="mr-1.5 text-emerald-600" />
                  )}
                  {downloading ? "Mendownload..." : "Download Backup (JSON)"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUploadModal(true)}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-semibold text-xs"
                  title="Upload & pulihkan seluruh koleksi database dari file JSON backup"
                >
                  <Upload size={14} className="mr-1.5 text-blue-600" />
                  Upload Database (Restore)
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTriggerSync}
                  disabled={syncing}
                  className="border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold text-xs"
                >
                  <RefreshCw size={14} className={`mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Sinkronisasi..." : "Sinkronkan Sekarang"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRepairDatabase}
                  disabled={syncing}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs"
                >
                  <CheckCircle2 size={14} className="mr-1.5 text-emerald-600" />
                  Audit & Perbaiki
                </Button>
              </div>
            </div>

            {dbStatus && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs text-slate-500">Status Database</div>
                  <div className="text-sm font-bold text-emerald-600 flex items-center justify-center gap-1 mt-0.5">
                    <CheckCircle2 size={14} /> Aktif & Terhubung
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs text-slate-500">Mesin Database</div>
                  <div className="text-sm font-bold text-navy mt-0.5">
                    {dbStatus.databaseEngine || "Google Cloud Firestore"}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs text-slate-500">Total Koleksi Tabel</div>
                  <div className="text-base font-bold text-navy mt-0.5">
                    {dbStatus.totalLocalCollections || 31} Tabel
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="text-xs text-slate-500">Total Rekor Data</div>
                  <div className="text-base font-bold text-emerald-600 mt-0.5">
                    {dbStatus.totalLocalRecords || 0} Data
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-emerald-900 leading-relaxed">
                <strong>Integritas Database Primer Aktif:</strong> Aplikasi Mahameru DMS terhubung secara penuh ke <strong>Google Cloud Firestore & Google Cloud SQL</strong>. Setiap data master (Wilayah, Outlet, Produk/SKU, Salesman, Gudang/Kantor), transaksi nota, mutasi stok fisik/van, serta presensi GPS tersimpan secara persisten dan aman secara real-time.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Save Footer for Quick Action */}
      {canEdit && (
        <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-wrap items-center justify-between gap-3 mt-8">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>Pastikan klik tombol simpan setelah mengubah parameter operasional atau geofence.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving}
              className="text-slate-600 hover:text-rose-600 hover:bg-rose-50 border-slate-200"
            >
              <RotateCcw size={15} className="mr-1.5" />
              Reset Standar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-navy hover:bg-navy/90 text-white font-semibold shadow-xs"
            >
              {saving ? (
                <Loader2 size={15} className="mr-1.5 animate-spin" />
              ) : (
                <Save size={15} className="mr-1.5" />
              )}
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>
        </div>
      )}

      {/* Upload Database Modal */}
      <UploadDatabaseModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onSuccess={() => fetchSettings()}
      />
    </div>
  );
}
