import type { PurchasesPackage } from 'react-native-purchases';

export type SubscriptionPlan = {
  id: string;
  title: string;
  price: string;
  period: string;
  detail: string;
  savings: number;
  storePackage: PurchasesPackage;
};

export function subscriptionPlans(packages: readonly PurchasesPackage[]): SubscriptionPlan[] {
  const monthly = packages.find((item) => item.product.subscriptionPeriod === 'P1M');
  return packages
    .filter(
      (item) =>
        !!item.product.priceString?.trim() &&
        ['P1Y', 'P1M'].includes(item.product.subscriptionPeriod || ''),
    )
    .map((item) => {
      const annual = item.product.subscriptionPeriod === 'P1Y';
      const annualPrice = item.product.price;
      const monthlyPrice = monthly?.product.price ?? 0;
      const savings =
        annual &&
        !!item.product.currencyCode &&
        item.product.currencyCode === monthly?.product.currencyCode &&
        Number.isFinite(annualPrice) &&
        annualPrice > 0 &&
        Number.isFinite(monthlyPrice) &&
        monthlyPrice > 0
          ? Math.max(0, Math.min(99, Math.floor((1 - annualPrice / (monthlyPrice * 12)) * 100)))
          : 0;
      return {
        id: item.identifier,
        title: annual ? 'Yearly' : 'Monthly',
        price: item.product.priceString,
        savings,
        period: annual ? 'year' : 'month',
        detail:
          annual && item.product.pricePerMonthString
            ? `${item.product.pricePerMonthString} / month, billed yearly`
            : annual
              ? 'Billed yearly'
              : 'Billed monthly',
        storePackage: item,
      };
    })
    .sort((a, b) => Number(b.period === 'year') - Number(a.period === 'year'));
}
