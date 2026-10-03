export type UserStatus = 'active' | 'suspended' | 'banned' | 'deleted';

export interface User {
  id: number;
  display_name?: string;
  name?: string;
  username?: string;
  email: string;
  phone?: string | null;
  education_class?: string | null;
  faculty?: string | null;
  city?: string | null;
  avatar_path?: string | null;
  status?: UserStatus;
  status_reason?: string | null;
  suspended_until?: string | null;
  role: 'admin' | 'student';
  email_verified_at?: string | null;
  last_login_at?: string | null;
  created_at?: string;
}

export interface StudentDetails {
  student: User & {
    updated_at?: string;
    date_of_birth?: string | null;
    bio?: string | null;
    province?: string | null;
    district?: string | null;
    city?: string | null;
    education_class?: string | null;
    faculty?: string | null;
    competition?: string | null;
    theme?: string | null;
    locale?: string | null;
    timezone?: string | null;
    cursor_mode?: string | null;
    cursor_size?: string | null;
  };
  enrollments: Array<{ program_name: string; level_name: string; level_type: string; is_primary: number; started_at?: string | null; ended_at?: string | null }>;
  activity: {
    quiz_attempts: number;
    completed_tests: number;
    average_score: number | null;
    saved_resources: number;
    resource_views: number;
    upcoming_targets: number;
    support_tickets: number;
    payment_requests: number;
  };
  recent_attempts: Array<{ title: string; status: string; score: number | null; maximum_score: number | null; started_at: string; submitted_at?: string | null }>;
  recent_tickets: Array<{ id: number; subject: string; category: string; priority: string; status: string; created_at: string; updated_at: string }>;
  recent_payments: Array<{ amount: number; currency: string; provider: string; reference?: string | null; status: string; created_at: string; reviewed_at?: string | null }>;
  status_history: Array<{ previous_status: string; new_status: string; reason?: string | null; suspended_until?: string | null; source: string; created_at: string; actor_email?: string | null; actor_name?: string | null }>;
}

export type UserStatusCounts = Record<UserStatus, number>;

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  meta: Record<string, unknown>;
}
