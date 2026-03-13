export type AccountType = 'CASH' | 'BANK' | 'CREDIT' | 'VIRTUAL';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  userId: number;
}

export interface CreateAccountRequest {
  name: string;
  type: AccountType;
  balance?: number;
  currency?: string;
}

export interface UpdateAccountRequest {
  name?: string;
  type?: AccountType;
  balance?: number;
  currency?: string;
}
