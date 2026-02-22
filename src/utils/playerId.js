export const getPlayerId = () => {
  let id = localStorage.getItem("playerId");

  if (!id) {
    id =
      "player-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).substring(2, 10);

    localStorage.setItem("playerId", id);
  }

  return id;
};
