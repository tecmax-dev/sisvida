import HolidaysPage from "@/pages/dashboard/HolidaysPage";

/**
 * Union module wrapper for the Holidays management page.
 * Reuses the existing HolidaysPage which manages clinic_holidays,
 * national_holidays, state_holidays, and municipal_holidays.
 * 
 * The RoleGuard inside HolidaysPage checks "manage_settings" permission,
 * which union admins/owners should have by default.
 */
export default function UnionHolidaysPage() {
  return <HolidaysPage />;
}
