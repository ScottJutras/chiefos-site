// app/components/marketing/constants.ts

// ✅ E.164 without the plus sign: 1 + area code + number
export const WHATSAPP_NUMBER = "12316802664"; 

export function whatsappHref(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export const WHATSAPP_HREF = whatsappHref("Try ChiefOS on WhatsApp");
