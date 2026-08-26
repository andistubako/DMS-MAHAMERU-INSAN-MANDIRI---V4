import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { User, KeyRound, LogOut, ShieldCheck, Building2, MapPin, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { errMsg } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export default function ProfilePage() {
  const { user, logout, changePassword } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      toast.error("Isi kata sandi lama dan baru.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Kata sandi minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      await changePassword(newPassword, oldPassword);
      toast.success("Kata sandi berhasil diperbarui!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(errMsg(err));
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4" data-testid="profile-page">
      {/* Profile Header Card */}
      <div className="bg-gradient-to-br from-navy via-navy to-navy-dark rounded-2xl p-5 text-white shadow-lg space-y-4 border border-navy-light/20 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gold/20 text-gold border-2 border-gold/40 flex items-center justify-center text-xl font-bold shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="leading-tight">
            <h2 className="text-base font-bold text-white font-heading" data-testid="profile-user-name">
              {user?.name || "Pengguna"}
            </h2>
            <div className="text-gold text-xs font-semibold uppercase tracking-wider mt-0.5">
              {user?.role || "SALES"}
            </div>
            <div className="text-slate-300 text-xs mt-1">{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-navy font-bold text-sm">
          <ShieldCheck size={16} className="text-gold" />
          <span>Informasi Akun</span>
        </div>
        <div className="space-y-2 text-xs divide-y divide-slate-100">
          <div className="pt-2 flex justify-between">
            <span className="text-slate-500">Status Akun</span>
            <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {user?.status || "ACTIVE"}
            </span>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-slate-500">Kantor Cabang</span>
            <span className="font-semibold text-slate-800">{user?.office_id ? "Jakarta Head Office" : "-"}</span>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-slate-500">ID Pengguna</span>
            <span className="font-mono text-slate-600 text-[10px] truncate max-w-[160px]">{user?._id || user?.uid || "-"}</span>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-navy font-bold text-sm">
          <KeyRound size={16} className="text-gold" />
          <span>Ubah Kata Sandi</span>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Kata Sandi Lama</Label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kata Sandi Baru</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Konfirmasi Kata Sandi Baru</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-navy text-white text-xs">
            {loading ? <Loader2 className="animate-spin" size={14} /> : "Simpan Kata Sandi Baru"}
          </Button>
        </form>
      </div>

      {/* Logout Button */}
      <Button
        onClick={handleLogout}
        variant="destructive"
        className="w-full text-xs font-bold gap-2 py-3"
      >
        <LogOut size={16} /> Keluar dari Aplikasi
      </Button>
    </div>
  );
}
