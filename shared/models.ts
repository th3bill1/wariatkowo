export type Task = {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  title: string;
  notes?: string | null;
  dueDate?: string | null;
};

export type UpdateTaskInput = {
  title?: string;
  notes?: string | null;
  dueDate?: string | null;
  completed?: boolean;
  sortOrder?: number;
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  checked: boolean;
  checkedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateShoppingItemInput = {
  name: string;
  quantity?: string | null;
  category?: string | null;
};

export type UpdateShoppingItemInput = {
  name?: string;
  quantity?: string | null;
  category?: string | null;
  checked?: boolean;
  sortOrder?: number;
};
