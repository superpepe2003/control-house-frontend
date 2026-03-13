export interface UserProfile {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  password?: string;
}
