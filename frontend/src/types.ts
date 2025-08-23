export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  created_at: string;
}

export interface Server {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  icon_url?: string;
  created_at: string;
  is_owner?: boolean;
}


export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  username?: string;
}

export interface ServerMember {
  id: string;
  server_id: string;
  user_id: string;
  joined_at: string;
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  reply_to_id?: string;
}

export interface FriendWithUser extends Friend {
  friend: User;
}

export interface FriendRequestWithUser extends FriendRequest {
  requester?: User;
  receiver?: User;
}