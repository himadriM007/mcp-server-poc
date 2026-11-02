interface User {
  id: number;
  name: string;
  email?: string;
  address?: string;
  phone?: number | null;
}

export interface UserResponse {
  data: User[] | null;
  code: 0 | 1;
  message: string;
}
