# worlds-lol

Web para seguir los **Worlds 2026 de League of Legends en español**, con estética pixel de RPG de bolsillo.

- **Directo**: reproductor grande con selector entre la emisión oficial en español, la de Latinoamérica, la oficial en inglés y los cooficiales en español. Panel lateral con la clasificación interactiva (filtro por región, orden, ficha de cada equipo con su plantilla) y los partidos en juego, próximos y recientes. Se actualiza solo cada minuto.
- **Worlddex**: equipos del torneo (en el siguiente paso: jugadores y campeones más jugados y baneados).
- **Jugar**: el juego pokelike con los datos del torneo (pendiente).

## Desarrollo

```bash
npm install
npm run dev
```

Si la API de lolesports no responde (por ejemplo sin red), la web muestra datos de demostración y lo avisa.

## Configuración

- `config/streams.ts`: canales del reproductor. Los oficiales en español que la API marque en directo se añaden solos.
- `config/tournament.ts`: torneo que se sigue. Cambiándolo se puede reutilizar para la LEC, el MSI, etc.
- `LOLESPORTS_API_KEY` (opcional): clave de la API de lolesports si la pública cambia.

Los datos vienen de la API que usa lolesports.com, que no es pública ni está documentada y puede cambiar sin aviso.
