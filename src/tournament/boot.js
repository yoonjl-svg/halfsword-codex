try {
  // Keep existing lobby migrations/equipment inside an isolated preview namespace.
  const native = window.localStorage,
    prefix = "stillness.tournament.sandbox:";
  window.__oathStorage = native;
  for (const k of ["stillness.lobby.profile.v1", "stillness.lobby.weapon.v1"]) {
    const v = native.getItem(k);
    if (v && !native.getItem(prefix + k)) native.setItem(prefix + k, v);
  }
  const proxy = {
    getItem: (k) => native.getItem(prefix + k),
    setItem: (k, v) => native.setItem(prefix + k, String(v)),
    removeItem: (k) => native.removeItem(prefix + k),
    clear: () => {
      for (const k of Object.keys(native))
        if (k.startsWith(prefix)) native.removeItem(k);
    },
    key: (i) =>
      Object.keys(native)
        .filter((k) => k.startsWith(prefix))
        [i]?.slice(prefix.length) || null,
    get length() {
      return Object.keys(native).filter((k) => k.startsWith(prefix)).length;
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: proxy,
    configurable: true,
  });
  import("./app.js").catch((e) => {
    const p = document.createElement("p");
    p.id = "bootError";
    p.textContent = "생사전을 열지 못했습니다. " + e.message;
    document.getElementById("tournamentApp").replaceChildren(p);
    console.error(e);
  });
} catch (e) {
  document.getElementById("tournamentApp").textContent =
    "기기 저장소에 접근하지 못했습니다. 브라우저의 사이트 저장을 허용한 뒤 다시 열어 주십시오.";
  console.error(e);
}
