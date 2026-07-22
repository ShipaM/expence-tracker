// Клиентская публичная поверхность слайса. Серверный getSession() — в ./server
// (он тянет "server-only" и не должен попасть в клиентский бандл через этот barrel).
export { SessionProvider, useSession } from "./model/session-context";
