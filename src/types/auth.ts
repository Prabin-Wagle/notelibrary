export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phNo: string;
  province: string;
  district: string;
  city: string;
  class: string;
  faculty: string;
  competition: string;
  role: string;
  profile_picture?: string | null;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  googleLogin: (email: string, name: string) => Promise<{ success: boolean; status?: string; message?: string }>;
  register: (data: RegisterFormData, profilePhoto?: File | null) => Promise<{ photoSaved: boolean }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  isAuthenticated: boolean;
}

export interface RegisterFormData {
  name: string;
  username: string;
  email: string;
  phNo: string;
  province: string;
  district: string;
  city: string;
  password: string;
  class: string;
  faculty: string;
  competition: string;
}
