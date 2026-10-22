// Starter wording shown until an administrator saves their own version on Admin → Terms & privacy.
export const LEGAL_PAGES = {
  terms: {
    title: "Terms and Conditions",
    content: `These terms apply to everyone who uses Usikose360 to discover events, buy tickets or sell tickets. By creating an account or buying a ticket you agree to them.

## 1. Who we are
Usikose360 is an online ticketing platform for events in Kenya. We connect event organizers with attendees and process ticket payments through M-Pesa.

## 2. Accounts
- You must give accurate details when you sign up or buy a ticket.
- You are responsible for keeping your password safe.
- When you buy as a guest, we create an account for the email you enter so you can find your tickets later.

## 3. Buying tickets
- Prices are shown in Kenya Shillings (KES) and include any fees shown at checkout.
- A ticket is confirmed only after M-Pesa confirms your payment. You will receive your ticket by email and in **My tickets**.
- Each ticket has a unique QR code that can be scanned once at the entrance. Do not share it publicly.

## 4. Refunds and cancellations
- Refunds are decided by the event organizer, unless the law requires otherwise.
- If an event is cancelled, the organizer is responsible for refunding ticket holders.
- Usikose360 will help pass refund requests to the organizer.

## 5. Organizers
- Organizers are responsible for the accuracy of their event details, for running the event, and for complying with Kenyan law.
- Ticket revenue is paid out to organizers by M-Pesa after deduction of any agreed platform fees.
- We may remove events that are misleading, unlawful or harmful.

## 6. Acceptable use
You must not misuse the platform, resell tickets fraudulently, attempt to bypass payments, or interfere with the service.

## 7. Liability
Usikose360 is not the organizer of listed events and is not responsible for what happens at an event. Our liability is limited to the amount you paid for the affected ticket.

## 8. Changes
We may update these terms. The date of the latest update is shown on this page.

## 9. Contact
Questions about these terms can be sent to the Usikose360 support team.`,
  },
  privacy: {
    title: "Privacy Policy",
    content: `This policy explains what personal data Usikose360 collects, why, and your rights under the Kenya Data Protection Act, 2019.

## 1. Data we collect
- **Account details:** name, email address, phone number and password (stored encrypted).
- **Ticket and payment details:** the events you buy for, attendee names and emails you enter, your M-Pesa phone number and payment receipt number. We never see or store your M-Pesa PIN.
- **Usage details:** basic technical information such as your browser type, used to keep the service secure.

## 2. How we use it
- To issue and deliver your tickets and confirm payments.
- To let organizers and their admission staff check you in at the event.
- To send you emails about your orders, tickets and account (for example password setup or reset).
- To prevent fraud and keep the platform secure.

## 3. Who we share it with
- **Event organizers** receive attendee names and ticket details for their own events.
- **Safaricom (M-Pesa)** processes your payment.
- **Service providers** that host the platform and send email on our behalf.
We do not sell your personal data.

## 4. How long we keep it
We keep order and ticket records for as long as needed for accounting and legal purposes, and account data until you ask us to delete your account.

## 5. Your rights
You can ask to see, correct or delete your personal data, or object to how it is used, by contacting the Usikose360 support team.

## 6. Security
Data is sent over encrypted connections, passwords are never stored in plain text, and access to payment settings is limited to administrators.

## 7. Changes
We may update this policy. The date of the latest update is shown on this page.`,
  },
} as const;

export type LegalSlug = keyof typeof LEGAL_PAGES;
