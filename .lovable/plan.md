# Plan - Implement Interactive Waiting List Offer in Mobile PWA

The "Smart Waiting List" currently sends a WhatsApp message but lacks an interactive UI within the mobile app for patients to claim the offered slot. This plan will add a prominent notification card and a dedicated dialog to handle these offers.

## User Review Required

- **Confirmation Flow:** When a user clicks "Claim Offer", should it immediately create a confirmed appointment, or should it just mark as "Patient wants it" and let the admin finalize? (Default: create confirmed appointment directly for better UX).
- **Time Limit:** The current system mentions a 2-hour reservation. Should we show a countdown timer in the app?

## Proposed Changes

### 1. Database & Security
- Verify/Update RLS for `waiting_list` table to allow patients to read their own entries and update `notification_status` to 'confirmed' or 'declined'.

### 2. Frontend Components
- **`src/components/mobile/MobileWaitingListOffer.tsx` (New):**
    - A specialized hook/component that queries `waiting_list` for entries with `notification_status === 'notified'` for the logged-in patient.
    - Displays a high-visibility card on the `MobileHomePage` and `MobileAppointmentsPage` if an offer is active.
- **`src/components/mobile/WaitingListOfferDialog.tsx` (New):**
    - Displays slot details (Professional, Date, Time).
    - Buttons: "Confirmar Vaga" and "Agora não".
    - Success/Error feedback.

### 3. Logic & Integration
- **`src/hooks/useWaitingListOffer.ts` (New):**
    - Encapsulates fetching, subscribing (real-time), and accepting/declining logic.
- **`MobileHomePage.tsx`:**
    - Inject `MobileWaitingListOffer` after the welcome card.
- **`MobileAppointmentsPage.tsx`:**
    - Inject `MobileWaitingListOffer` at the top of the upcoming appointments list.

### 4. Edge Function
- **`supabase/functions/accept-waiting-list-offer/index.ts` (New):**
    - Validates the offer is still within the 2-hour window.
    - Creates the `appointments` record.
    - Updates `waiting_list` status to `confirmed`.
    - (Optional) Notifies the clinic via WhatsApp/Internal notification.

## Technical Details
- Use `notification_status` field: `notified` -> `confirmed` (success) or `declined` (user rejected).
- Ensure `offered_appointment_date` and `offered_appointment_time` are correctly parsed.
- Real-time updates via Supabase `waiting_list` channel to show the offer immediately without refresh.
