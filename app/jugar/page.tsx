export const metadata = { title: "Jugar · Worlds LOL" };

export default function Jugar() {
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="dialog pixel-box gold">
        ¡Hola, invocador! Muy pronto podrás formar tu equipo con los jugadores y campeones de los Worlds y combatir
        por turnos hasta llegar a la final.
        <span className="next">▼</span>
      </div>
      <p className="px-title press-start">Pulsa start</p>
    </div>
  );
}
