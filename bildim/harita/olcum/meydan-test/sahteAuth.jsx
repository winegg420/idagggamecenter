// MEYDAN ENTEGRASYON SINAMASI — sahte oturum (yalnız yerel)
export function AuthProvider({ children }) { return children; }
export function useAuth() {
  return { user: { id: "test-ida" }, profile: { id: "test-ida", username: "Ida", avatar_url: null }, yukleniyor: false };
}
