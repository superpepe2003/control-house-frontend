import { Transaction } from '../../transactions/models/transaction.models';

export interface ExpenseByCategory {
  categoryId: number;
  categoryName: string;
  total: string | number;
}

export interface DashboardSummary {
  totalBalance: string | number;
  monthlyIncome: string | number;
  monthlyExpenses: string | number;
  recentTransactions: Transaction[];
  expensesByCategory: ExpenseByCategory[];
}

export interface PrevMonthTotals {
  income: number;
  expenses: number;
}
