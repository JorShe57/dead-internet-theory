export type AccessCode = {
  id: string;
  code: string;
  type: "album" | "special" | string;
  active: boolean;
  created_at: string;
};

export type UserSession = {
  id: string;
  session_token: string;
  created_at: string;
  last_active: string;
};

export type Post = {
  id: string;
  content: string;
  author_name: string | null;
  source: string | null;
  care_package_code: string | null;
  created_at: string;
  likes: number;
};

export type Comment = {
  id: string;
  post_id: string;
  content: string;
  author_name: string | null;
  created_at: string;
};
