/* eslint-disable @next/next/no-img-element */
export function TeamLogo({ code, image, size = 24 }: { code: string; image: string; size?: number }) {
  if (!image) {
    return (
      <span className="team-logo fallback" style={{ width: size, height: size }} aria-hidden>
        {code.slice(0, 3)}
      </span>
    );
  }
  return <img className="team-logo" src={image} alt="" width={size} height={size} loading="lazy" />;
}
