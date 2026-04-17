import { create } from 'zustand'

const useAppStore = create((set) => ({
  telegramUser: null,
  setTelegramUser: (telegramUser) => set({ telegramUser }),
}))

export default useAppStore
export { useAppStore }
