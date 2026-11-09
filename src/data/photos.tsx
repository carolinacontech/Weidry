/**
 * Fotografías de Pexels (licencia Pexels: uso gratuito, atribución no obligatoria;
 * https://www.pexels.com/license/). Se incluyen optimizadas en /public/images para
 * que funcionen sin conexión. Se acredita a cada autor en Ajustes → Créditos.
 */
export interface Photo {
  src: string;
  alt: string;
  author: string;
  url: string;
  width: number;
  height: number;
  /** object-position para el recorte. */
  position?: string;
}

export const PHOTOS = {
  objetivo: {
    src: '/images/objetivo.webp',
    alt: 'Mujer de espaldas entrenando con mancuernas frente a un espejo',
    author: 'The Lazy Artist Gallery',
    url: 'https://www.pexels.com/photo/woman-lifting-two-dumbells-on-both-hands-in-front-of-mirror-1886487/',
    width: 667,
    height: 1000,
    position: '30% 25%',
  },
  A: {
    src: '/images/dia-a.webp',
    alt: 'Mujer haciendo zancadas con mancuernas',
    author: 'Anna Shvets',
    url: 'https://www.pexels.com/photo/a-woman-in-black-tank-top-working-out-in-the-room-4587359/',
    width: 1000,
    height: 666,
    position: '70% 50%',
  },
  B: {
    src: '/images/dia-b.webp',
    alt: 'Mujer haciendo remo con mancuerna',
    author: 'Karola G (Kaboompics)',
    url: 'https://www.pexels.com/photo/woman-doing-exercise-inside-gym-2247179/',
    width: 1000,
    height: 699,
    position: '50% 40%',
  },
  C: {
    src: '/images/dia-c.webp',
    alt: 'Mujer haciendo zancada con mancuernas sobre una esterilla',
    author: 'Andrea Piacquadio',
    url: 'https://www.pexels.com/photo/woman-in-active-wear-exercising-on-yoga-mat-4807549/',
    width: 1000,
    height: 666,
    position: '45% 50%',
  },
  D: {
    src: '/images/dia-d.webp',
    alt: 'Mujer haciendo press de hombros con mancuernas',
    author: 'Viridiana Rivera',
    url: 'https://www.pexels.com/photo/gym-meetup-14604685/',
    width: 539,
    height: 1000,
    position: '50% 20%',
  },
  mancuernas: {
    src: '/images/mancuernas.webp',
    alt: 'Manos sosteniendo dos mancuernas moradas',
    author: 'Andrea Piacquadio',
    url: 'https://www.pexels.com/photo/purple-dumbbells-in-hands-of-positive-sportswoman-4498294/',
    width: 1000,
    height: 666,
    position: '50% 55%',
  },
} satisfies Record<string, Photo>;

export function Img({ photo, className = '', decorative }: { photo: Photo; className?: string; decorative?: boolean }) {
  // object-fit lo aplica la clase (Tailwind) o el CSS del contenedor.
  return (
    <img
      src={photo.src}
      alt={decorative ? '' : photo.alt}
      width={photo.width}
      height={photo.height}
      loading="lazy"
      decoding="async"
      className={`object-cover ${className}`}
      style={{ objectPosition: photo.position, objectFit: 'cover' }}
    />
  );
}
