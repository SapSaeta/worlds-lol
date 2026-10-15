export const metadata = { title: "Jugar · Worlds LOL" };

export default function Jugar() {
  return (
    <div className="page" style={{ paddingTop: "12vh" }}>
      <h1 className="screen-title">¡Elige a tu jugador!</h1>
      <p className="screen-subtitle">Muy pronto</p>
      <div className="dialog card" style={{ marginTop: 32 }}>
        Los jugadores de los Worlds serán tus entrenadores, cada uno con su pool de campeones. Combate, pasa por la
        tienda a por componentes y objetos, y comparte tu puntuación al final.
        <span className="next">▼</span>
      </div>
      <p className="press-start">PULSA START</p>
    </div>
  );
}
