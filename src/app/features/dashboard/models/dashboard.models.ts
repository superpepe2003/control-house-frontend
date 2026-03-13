import { Transaction } from '../../transactions/models/transaction.models';

export interface ExpenseByCategory {
  categoryName: string;
  total: string | number;
}

export interface DashboardSummary {
  totalBalance: string | number;
  monthlyIncome: string | number;
  monthlyExpenses: string | number;
  previousMonthIncome: string | number;
  previousMonthExpenses: string | number;
  recentTransactions: Transaction[];
  expensesByCategory: ExpenseByCategory[];
  previousMonthExpensesByCategory: ExpenseByCategory[];
}
