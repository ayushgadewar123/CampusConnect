import { io } from "socket.io-client";
import { SOCKET_URL } from "./api";

let socket;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
      withCredentials: true,
    });
  }
  return socket;
};

export default getSocket;
