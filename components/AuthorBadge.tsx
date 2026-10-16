import { AUTHOR } from "@/config/site";
import { tr, type Locale } from "@/lib/i18n";

// Firma discreta al final del pie, con el nombre enlazado a LinkedIn
export function AuthorBadge({ locale }: { locale: Locale }) {
  return (
    <p className="author-credit">
      {tr(locale, "Desarrollado por", "Built by")}{" "}
      <a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer">
        {AUTHOR.name}
      </a>
    </p>
  );
}
