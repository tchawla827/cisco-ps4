export function formatCurrency(amount: number): string {
  return `INR ${amount.toLocaleString('en-US')}`
}
