import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";

const CompanyCtx = createContext(null);

const DEFAULT_COMPANY_PROFILE = {
  _id: "comp-main",
  companyId: "main",
  companyName: "PT Mahameru Distribusi Indonesia",
  companyLegalName: "PT Mahameru Distribusi Indonesia Tbk",
  companyCode: "MHM-JKT",
  companyAddress: "Jl. Tebet Barat Dalam Raya No. 12, Tebet, Jakarta Selatan 12810",
  address: "Jl. Tebet Barat Dalam Raya No. 12, Tebet, Jakarta Selatan 12810",
  city: "Jakarta Selatan",
  postalCode: "12810",
  companyPhone: "+62 21 8370 1234",
  phone: "+62 21 8370 1234",
  companyEmail: "info@mahamerudistribusi.co.id",
  email: "info@mahamerudistribusi.co.id",
  companyWebsite: "https://mahamerudistribusi.co.id",
  website: "https://mahamerudistribusi.co.id",
  companyDescription: "Distributor FMCG & Consumer Goods terkemuka di Indonesia dengan jaringan distribusi modern dan terintegrasi.",
  description: "Distributor FMCG & Consumer Goods terkemuka di Indonesia dengan jaringan distribusi modern dan terintegrasi.",
  npwp: "01.234.567.8-012.000",
  taxId: "01.234.567.8-012.000",
  nib: "9120001234567",
  directorName: "Andis Moch Solihin",
  bankName: "Bank Central Asia (BCA)",
  bankAccountNumber: "8830-1234-5678",
  bankAccountHolder: "PT Mahameru Distribusi Indonesia",
  bankBranch: "KCP Tebet Raya",
  companyLogo: null,
  logoUrl: null,
  logoStoragePath: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: new Date().toISOString(),
  updatedBy: "usr-owner",
};

export function CompanyProvider({ children }) {
  const [companyProfile, setCompanyProfile] = useState(DEFAULT_COMPANY_PROFILE);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get("/company-profile");
      if (res.data) {
        setCompanyProfile((prev) => ({ ...prev, ...res.data }));
      }
    } catch (e) {
      console.warn("Gagal memuat profil perusahaan:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (formData) => {
    const res = await api.put("/company-profile", formData);
    const updated = res.data.company_profile || formData;
    setCompanyProfile((prev) => ({ ...prev, ...updated }));
    return updated;
  };

  const uploadLogo = async (file) => {
    if (!file) throw new Error("File gambar wajib dipilih.");
    if (file.size > 3 * 1024 * 1024) {
      throw new Error("Ukuran file logo maksimal 3MB.");
    }
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      throw new Error("Format file harus berupa PNG, JPG, JPEG, SVG, atau WEBP.");
    }

    const ext = file.name.split(".").pop() || "png";
    const storagePath = `company/main/logo/logo_${Date.now()}.${ext}`;

    const downloadUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await api.post("/company-profile/logo", {
      logoUrl: downloadUrl,
      logoStoragePath: storagePath,
    });
    const updated = res.data.company_profile;
    setCompanyProfile((prev) => ({
      ...prev,
      companyLogo: downloadUrl,
      logoUrl: downloadUrl,
      logoStoragePath: storagePath,
      ...(updated || {}),
    }));
    return downloadUrl;
  };

  const deleteLogo = async () => {
    const res = await api.delete("/company-profile/logo");
    setCompanyProfile((prev) => ({
      ...prev,
      companyLogo: null,
      logoUrl: null,
      logoStoragePath: null,
    }));
    return res.data;
  };

  return (
    <CompanyCtx.Provider
      value={{
        companyProfile,
        loading,
        updateProfile,
        uploadLogo,
        deleteLogo,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </CompanyCtx.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyCtx);
  if (!ctx) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return ctx;
}
