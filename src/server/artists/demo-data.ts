import type { PortfolioWork, PublicArtist } from "./types";

/**
 * DATOS DE EJEMPLO. Se reemplazan por la base de datos en la Fase 2.
 * Fuente: bio pública de @tattoobyesti. Las fotos son recortes de capturas de Instagram
 * (no versionadas, ver .gitignore); títulos y categorías son provisorios.
 */
export const DEMO_ARTIST: PublicArtist = {
  slug: "esti",
  artistName: "Esti",
  fullName: "Esteban Fernández",
  styles: ["Black & Grey", "Puntillismo de arrastre", "Blackwork"],
  locationLabel: "Estudio privado · Banfield, Buenos Aires",
  bio: null,
  instagram: { handle: "tattoobyesti", url: "https://www.instagram.com/tattoobyesti/" },
  process: [
    { title: "Contás tu idea", description: "Qué te querés tatuar, en qué zona y de qué tamaño. Si tenés referencias, mejor." },
    { title: "Evaluación", description: "Se revisa la idea y se define si es viable o si conviene ajustarla." },
    { title: "Diseño y presupuesto", description: "Se acuerdan el diseño, la cantidad de sesiones y el presupuesto." },
    { title: "Reserva", description: "Con la seña confirmada, el turno queda reservado." },
    { title: "Sesión", description: "Se realiza la sesión en el estudio, en el turno acordado." },
    { title: "Cuidados", description: "Recibís las indicaciones de cuidado para la cicatrización." },
  ],
  faq: [
    { question: "¿Cómo pido un turno?", answer: "Contá tu idea desde el formulario de contacto. Con esa información se evalúa el proyecto y se coordina el turno." },
    { question: "¿Qué tengo que mandar para presentar una idea?", answer: "Una descripción de la idea, la zona del cuerpo, el tamaño aproximado y, si tenés, imágenes de referencia." },
    { question: "¿Cómo se calcula el presupuesto?", answer: "Depende del tamaño, el nivel de detalle, la zona y la cantidad de sesiones. Siempre se confirma antes de reservar." },
    { question: "¿Cómo funciona la seña?", answer: "La seña reserva el turno y se descuenta del total. Las condiciones exactas se informan al confirmar." },
    { question: "¿Qué pasa si tengo que reprogramar?", answer: "Avisá con anticipación y se busca una nueva fecha. Las condiciones se acuerdan al reservar." },
  ],
  isDemo: true,
};

function work(
  id: string,
  title: string,
  category: string,
  bodyZone: string | null,
  alt: string,
): PortfolioWork {
  return {
    id,
    title,
    category,
    bodyZone,
    description: null,
    image: { src: `/demo/${id}.jpg`, alt, width: 800, height: 1000 },
  };
}

export const DEMO_WORKS: PortfolioWork[] = [
  work("cristo-antebrazo", "Cristo con corona de espinas", "Religioso", "Antebrazo", "Rostro de Cristo con corona de espinas y manos en oración, en negro y gris."),
  work("japones-paisaje", "Paisaje japonés con torii", "Oriental", "Brazo", "Paisaje con torii, montañas y una figura meditando junto al agua."),
  work("virgen-rosario", "Virgen con rosario", "Religioso", "Brazo", "Virgen con lágrima y rosario entre las manos."),
  work("caballero-espalda", "Caballero en armadura", "Figurativo", "Espalda", "Caballero medieval sentado con armadura detallada, en proceso."),
  work("tigre", "Tigre", "Animales", "Antebrazo", "Tigre rugiendo de frente, en negro y gris."),
  work("buda", "Buda", "Oriental", "Brazo", "Rostro de Buda sereno con símbolo om y fondo de puntillismo."),
  work("virgen-rostro", "Virgen", "Religioso", "Brazo", "Rostro de virgen con manto, mirando hacia arriba."),
  work("pagoda-antebrazo", "Pagoda", "Oriental", "Antebrazo", "Pagoda japonesa entre pinos y nubes."),
  work("ojo-mano", "Mirada entre los dedos", "Figurativo", null, "Ojo que asoma entre los dedos de una mano con una cruz."),
  work("virgen-brazo", "Virgen dolorosa", "Religioso", "Brazo", "Virgen con corona de espinas sosteniendo un rosario."),
  work("angel-brazo", "Ángel", "Religioso", "Brazo", "Figura de ángel con alas en una manga en negro y gris."),
];
