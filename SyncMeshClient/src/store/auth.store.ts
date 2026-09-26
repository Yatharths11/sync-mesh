import { create } from 'zustand';

type AuthState =  {
  accessToken: string | null;
  setAccessToken: (token: string) => void;
}


const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,

  setAccessToken: (token) => {
    set({ accessToken: token });
  },

}));



export { useAuthStore };