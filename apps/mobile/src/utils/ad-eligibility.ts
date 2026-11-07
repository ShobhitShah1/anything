export function confirmedFreeAccount(
  usagePaid: boolean | undefined,
  billingActive: boolean | undefined,
) {
  return usagePaid === false && billingActive === false;
}
