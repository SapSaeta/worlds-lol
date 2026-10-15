// Lee la descripción oficial (en español) de cada habilidad y saca qué hace:
// si aturde, ralentiza, cura, protege, se desplaza, ejecuta... y qué tipo de
// daño inflige. Con eso el juego convierte cada habilidad en un movimiento
// que se parece a lo que hace en el LoL.

import type { DmgType, SpellFx } from "@/lib/game/types";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

// Frases de reducción del daño recibido: no cuentan como que la habilidad haga daño.
const TAKEN = /(reduc\w*|mitig\w*) (todo |el |parte del |gran parte del )?dano (fisico |magico |fisico y magico |que )?(recib\w*|sufr\w*)|dano (que )?(recibe|recibido|sufrido)/g;

const RX: [SpellFx, RegExp][] = [
  [
    "stun",
    /aturd|inmoviliz|suprim|por los aires|derrib|empuj|retroced|enraiz|arrastr|\batra(e|en|er|iga|yendo)\b|encanta a |encantad|encantar(a|an|lo|la)?\b|\bhechiza(n|do|da|dos|das|ndo)?\b|asust|aterroriz|provoca a |provocad|provocand|\bburla|duerm|dormir|somnolien|petrific|silenci|paraliz|desequilibr|derriba|suspend\w* en el aire|lanza hacia arriba|eleva a|levanta a|atrapa a |atrapa y |detiene a |aprision|apres|encierr|atonta|cegad|ciega a|estasis|provoca(ra|ran)? (y|a)\b|lanza a los enemigos|lance a los enemigos/,
  ],
  ["slow", /ralentiz|lentitud|reduc\w* (\w+ ){0,2}(su |la )?velocidad de movimiento|aminor/],
  ["shield", /escudo/],
  ["heal", /\bcura\b|\bcuran\b|\bcurar\b|\bse cura|curacion|curarse|curando|recupera\w* (\w+ )?(vida|salud)|restaur\w* (\w+ )?(vida|salud)|regenera|\bsana\b/],
  ["drain", /\broba\w*( \w+){0,5} vida|robo de vida|absorbe\w* (\w+ )?(vida|salud|esencia)|drena|vampir|succion|se alimenta/],
  [
    "dash",
    /se desplaza|se desliza|\bsalta|embist|se abalanz|carga hacia|teletransport|se lanza|avanza rapidamente|vuela hacia|corre hacia|se impulsa|parpade|acomet|da un salto|brinca|se catapult|irrumpe|se precipita|arremete|cabalga|rueda hacia|se zambull|se sumerge|excava|lanzarse|se estira|se traslada/,
  ],
  ["haste", /(obtiene|aumento de|aumenta|otorga|gana|incremento)\w* (\w+ ){0,4}velocidad de movimiento|acelera a/],
  ["empower", /proximo ataque|siguiente ataque|siguientes ataques|potencia (su|sus) ataque|ataques potenciados|ataques basicos (adicional|infligen|aplican)|potencia sus siguientes/],
  [
    "buff",
    /(obtiene|aumenta|gana|incrementa|potencia|otorga)\w* (\w+ ){0,3}velocidad de ataque|aumenta\w* (su |el )?dano|obtiene\w* (\w+ )?dano de ataque|obtiene\w* (\w+ )?poder de habilidad|mejora sus ataques|frenesi|enfurec|furia|capacidad de combate|mejora sus habilidades|potencia su siguiente habilidad|aumenta los efectos|lucha con mas/,
  ],
  [
    "guard",
    /(obtiene\w*|gana\w*|aumenta\w* su|aumentan su|otorga\w* (\w+ )?) (\w+ )?(armadura|resistencia)|(reduc\w*|mitig\w*) (todo |el |parte del |gran parte del )?dano (fisico |magico |fisico y magico |que )?(recib\w*|sufr\w*)|invulnerab|no puede morir|no puede bajar|inmune|imparable|endurec|tenacidad|retrasa su muerte/,
  ],
  ["execute", /vida que le falta|vida faltante|vida perdida|vida que les falta|falta de vida|ejecuta(r)? a[l ]|los ejecuta|las ejecuta|ejecutarlo|remata|(objetivos|enemigos|campeones) con poca vida/],
  [
    "multi",
    /(dos|tres|cuatro|cinco|seis|siete|ocho|varias|multiples|numerosas) (veces|golpes|ataques|disparos|proyectiles|rafagas|cuchillas|kunais|misiles|orbes|balas|flechas|fuegos|rayos|estocadas|tajos|cortes|ondas|oleadas|rocas|dagas)|repetidamente|rafaga|cada segundo|golpe doble|en rapida sucesion|una lluvia|lluvia de|tormenta de/,
  ],
  ["evade", /invisib|camufl|no (puede|se le puede|pueden) (ser )?seleccion|no se le puede seleccionar|inseleccionable|esquiva|bloquea\w* (el |los |todos los |una )?(siguiente |proximo |unica )?(ataque|habilidad|proyectil)|se bloquean los ataques|se oculta|desaparece|solo puede ser objetivo/],
];

/** Hace daño si habla de daño (que no sea el recibido) o de golpear, disparar, explotar... */
const DEALS = /dano|\bdan(a|an|ar|ando)|asola|pisote|\btajo|pierden? (\w+ ){0,5}vida|inflig|golpe|golpea|\batac|dispar|explot|mordisc|apunal|atraviesa|\bcort(a|e)|quema|abrasa|electrocut|aplasta|estall|perfor|desgarr|machac|lacer|explosi|danin|bombarde|venen|escupe fuego|llamarad|rebota|\brayo/;

export function classifySpell(description: string): { dmg: DmgType; fx: SpellFx[] } {
  const text = norm(description);
  const fx = RX.filter(([, rx]) => rx.test(text.replace(/(romp|destru|elimin|quit)\w* (sus |los |el )?escudos?/g, " "))).map(([f]) => f);
  const dealing = text.replace(TAKEN, " ").replace(/dano de ataque|(aumenta\w*|incrementa\w*|mejora\w*) (su |el |sus )?dano|(absorb|bloque|intercept|evit|anul)\w* (\w+ ){0,3}dano/g, " ");
  const deals = DEALS.test(dealing);
  const phys = /dano fisico/.test(dealing);
  const magic = /dano magico/.test(dealing);
  const truedmg = /dano verdadero/.test(dealing);
  let dmg: DmgType = "none";
  if (deals) dmg = phys && !magic ? "phys" : magic && !phys ? "magic" : truedmg && !phys && !magic ? "true" : "auto";
  // Sin daño explícito: si controla, ejecuta, roba vida o golpea varias veces,
  // también pega; si solo se desplaza o ralentiza, pega salvo que sea de apoyo.
  // Y si no se sabe qué hace, es un golpe normal.
  const has = (...xs: SpellFx[]) => xs.some((x) => fx.includes(x));
  if (dmg === "none" && (has("stun", "execute", "drain", "multi", "empower") || (has("dash", "slow") && !has("shield", "heal", "guard", "buff", "evade", "haste")) || !fx.length)) dmg = "auto";
  // Curarse al hacer daño es robar vida.
  if (dmg !== "none" && fx.includes("heal") && !fx.includes("drain")) fx.splice(fx.indexOf("heal"), 1, "drain");
  return { dmg, fx };
}
