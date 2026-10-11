import type { SplitType } from './money';

export interface Profile {
  id: string;
  user_id: string | null;
  email: string | null;
  name: string;
  avatar_color: string;
  default_currency: string;
}

export type GroupKind = 'home' | 'trip' | 'couple' | 'other';

export interface Group {
  id: string;
  name: string;
  emoji: string;
  kind: GroupKind;
  default_currency: string;
  simplify_debts: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ExpenseShare {
  expense_id: string;
  profile_id: string;
  paid: number;
  owed: number;
  split_value: number | null;
}

export interface Expense {
  id: string;
  group_id: string | null;
  description: string;
  amount: number;
  currency: string;
  category: string;
  split_type: SplitType;
  is_payment: boolean;
  spent_on: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  expense_shares: ExpenseShare[];
}

export interface Comment {
  id: string;
  expense_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface Snapshot {
  description: string;
  amount: number;
  currency: string;
  category: string;
  split_type: SplitType;
  spent_on: string;
  notes: string | null;
  is_payment: boolean;
  group_name: string | null;
  shares: { profile_id: string; name: string; paid: number; owed: number }[];
}

export type ActivityKind =
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'expense_restored'
  | 'payment_added'
  | 'comment_added'
  | 'group_created'
  | 'member_added';

export interface Activity {
  id: string;
  actor_id: string | null;
  kind: ActivityKind;
  group_id: string | null;
  expense_id: string | null;
  involved: string[];
  data: {
    before?: Snapshot;
    after?: Snapshot;
    body?: string;
    description?: string;
    group_name?: string;
    member_id?: string;
    member_name?: string;
  };
  created_at: string;
}

/** Positive = they owe me. */
export interface BalanceRow {
  other_id: string;
  group_id: string | null;
  currency: string;
  balance: number;
}

export interface GroupBalanceRow {
  group_id: string;
  currency: string;
  profile_id: string;
  balance: number;
}

export interface PairDebt {
  expense_id: string;
  group_id: string | null;
  currency: string;
  debtor: string;
  creditor: string;
  amount: number;
}

export interface SaveExpensePayload {
  id?: string;
  group_id: string | null;
  description: string;
  amount: number;
  currency: string;
  category: string;
  split_type: SplitType;
  is_payment?: boolean;
  spent_on: string;
  notes?: string | null;
  shares: { profile_id: string; paid: number; owed: number; split_value?: number | null }[];
}
