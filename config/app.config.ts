export const appConfig = {
  ownerName: "Property Owner",
  ownerPhone: "+977 9800000000",
  ownerAddress: "Kathmandu, Nepal",
  ownerUpiId: "owner@upi",
  currency: "रू",
  currencyCode: "NPR",
  appName: "Rent Manager",
} as const;

export type AppConfig = typeof appConfig;
