export type TransactionType = 'INCOME' | 'EXPENSE';

export interface TransactionCategory {
  id: number;
  name: string;
  type: TransactionType;
}

export interface TransactionAccount {
  id: number;
  name: string;
  type: string;
  currency: string;
}

export interface Transaction {
  id: number;
  amount: number;
  description?: string | null;
  date: string;
  type: TransactionType;
  categoryId: number;
  accountId: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
  category: TransactionCategory;
  account: TransactionAccount;
}

export interface CreateTransactionRequest {
  amount: number;
  description?: string;
  date: string;
  type: TransactionType;
  categoryId: number;
  accountId: number;
}

export interface UpdateTransactionRequest {
  amount?: number;
  description?: string;
  date?: string;
  type?: TransactionType;
  categoryId?: number;
  accountId?: number;
}

export interface ListTransactionsParams {
  type?: TransactionType;
  categoryId?: number;
  accountId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
