import { AUTHOR } from "@/config/site";

// Icono "in" de LinkedIn dibujado en rejilla de 10x10 para que case con el pixel art
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 10 10" width="20" height="20" shapeRendering="crispEdges" aria-hidden="true">
      <rect width="10" height="10" fill="#0a66c2" />
      <rect x="2" y="2" width="1" height="1" fill="#fff" />
      <rect x="2" y="4" width="1" height="4" fill="#fff" />
      <rect x="4" y="4" width="1" height="4" fill="#fff" />
      <rect x="5" y="4" width="2" height="1" fill="#fff" />
      <rect x="7" y="5" width="1" height="3" fill="#fff" />
    </svg>
  );
}

export function AuthorBadge() {
  return (
    <a className="author-badge" href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`Desarrollado por ${AUTHOR.name}: LinkedIn`}>
      <LinkedInIcon />
      <span>
        Desarrollado por <b>{AUTHOR.name}</b>
      </span>
    </a>
  );
}
